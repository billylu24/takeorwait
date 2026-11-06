"""Era-adjusted instructor model and cross-validated instructor sensitivity.

See docs/methodology.md sections 1-3 for the reasoning. Summary:

Each regular-quarter offering o of a course gives a logit-scale A-rate
    y_o = logit((k + 0.5) / (n + 1)),   binomial variance v_o = 1/(k + 0.5) + 1/(n - k + 0.5)
and the model, fitted separately per course, is
    y_o = beta[era(o)] + u[instructor(o)] + e_o
    u_j ~ N(0, tau2)            between-instructor spread
    e_o ~ N(0, sw2 + v_o)       same instructor, different offering + binomial noise
beta are era levels for this course. When a course has few offerings in an era, its
era level is pulled toward (course mean + the department's era shift) with a weight of
K0 offerings. tau2 and sw2 are method-of-moments estimates, moderated toward global
medians (pseudo-counts J0 and DF0) so a course with three offerings doesn't get a wild
variance. Era levels are averages of the offerings themselves (not net of instructor
effects), so era and instructor are never traded off against each other; instructor
effects are then estimated on the era-adjusted residuals.

Instructor sensitivity: leave one offering out, predict it from the era level alone
vs era level + the instructor's shrunk effect from their *other* offerings, and report
    score = 1 - SSE(with instructor) / SSE(era only)
with a bootstrap-over-instructors interval.
"""
import numpy as np
import pandas as pd
from scipy.special import expit
from scipy.stats import norm

from load import ERA_LABELS

Z90 = norm.ppf(0.95)
K0 = 2.0     # prior weight on (course mean + dept era shift) for each era level, in offerings
DF0 = 5.0    # pseudo degrees of freedom for sw2
J0 = 3.0     # pseudo instructors for tau2
DEPT_M0 = 20.0  # prior weight (offerings) of the global era shift inside a department
ITERS = 60
BOOT = 400
MIN_REPEAT = 3     # instructors with >= 2 offerings needed for the sensitivity score (bootstrap over instructors)
MIN_OFFERINGS = 6
MIN_GRADED = 5


def regular_offerings(df, count_col="nA"):
    """Regular-quarter offerings with at least MIN_GRADED letter grades, plus logit outcome."""
    d = df[(df.quarter != "Summer") & (df.nGraded >= MIN_GRADED)].copy()
    k, n = d[count_col].astype(float), d.nGraded.astype(float)
    d["y"] = np.log((k + 0.5) / (n - k + 0.5))
    d["v"] = 1 / (k + 0.5) + 1 / (n - k + 0.5)
    d["era"] = d["era"].astype(str)
    return d


def dept_era_shift(off):
    """Average deviation of a course's era mean from its overall mean, per department and era.

    Departments with few offerings in an era are pulled toward the all-campus shift.
    Returns {(dept, era): shift} with a ("*", era) entry for the global shift.
    """
    c_mean = off.groupby("course").y.transform("mean")
    dev = (off.y - c_mean).rename("dev")
    g = pd.concat([off[["dept", "era"]], dev], axis=1)
    glob = g.groupby("era").dev.mean()
    by = g.groupby(["dept", "era"]).dev.agg(["sum", "size"])
    shift = {("*", e): glob[e] for e in glob.index}
    for (dept, era), row in by.iterrows():
        shift[(dept, era)] = (row["sum"] + DEPT_M0 * glob[era]) / (row["size"] + DEPT_M0)
    return shift


def fit_course(y, v, era, ins, D, sw2_0, tau2_0):
    """Fit era levels, then shrunk instructor effects on the era-adjusted residuals, for one course.

    era, ins: integer codes 0..E-1 and 0..J-1. D: prior era shift for each era code.
    Returns a dict of arrays (see bottom).
    """
    E, J = len(D), ins.max() + 1
    cnt = np.bincount(ins, minlength=J)
    rep = cnt[ins] >= 2
    dfw = float((cnt[cnt >= 2] - 1).sum())
    u = np.zeros(J)
    sw2, tau2 = sw2_0, tau2_0
    for _ in range(ITERS):
        # era levels from the offerings themselves, NOT net of instructor effects: if every
        # instructor in an era graded low, we call that the era, not the instructors
        # (conservative when instructors and eras are confounded)
        wt = 1 / (sw2 + tau2 + v)
        wbar = wt.mean()
        mu = np.sum(wt * (y - D[era])) / wt.sum()
        num = np.bincount(era, wt * y, E) + K0 * wbar * (mu + D)
        den = np.bincount(era, wt, E) + K0 * wbar
        beta = num / den
        r = y - beta[era]
        w = 1 / (sw2 + v)
        P = np.bincount(ins, w, J)
        rbar = np.bincount(ins, w * r, J) / P
        u = rbar * tau2 * P / (1 + tau2 * P)

        # method-of-moments variance components, moderated toward the global values
        if dfw > 0:
            m_unw = np.bincount(ins, r, J) / cnt
            s2_raw = np.sum((r - m_unw[ins])[rep] ** 2) / dfw - v[rep].mean()
        else:
            s2_raw = np.nan
        tau_raw = np.mean(rbar ** 2 - 1 / P)
        sw2 = (dfw * max(s2_raw, 0) + DF0 * sw2_0) / (dfw + DF0) if dfw > 0 else sw2_0
        tau2 = max((J * max(tau_raw, 0) + J0 * tau2_0) / (J + J0), 1e-4)

    w = 1 / (sw2 + v)
    P = np.bincount(ins, w, J)
    return {"beta": beta, "beta_var": 1 / den, "u": u, "u_var": tau2 / (1 + tau2 * P), "P": P, "cnt": cnt,
                "r": y - beta[era], "w": w, "rbar": rbar, "sw2": sw2, "tau2": tau2,
                "s2_raw": s2_raw, "tau_raw": tau_raw, "dfw": dfw}


def cv_sensitivity(fit, ins, rng):
    """Leave-one-offering-out comparison of era-only vs era + instructor predictions.

    Era levels and variance components are held at their full-data values (a small
    leak that affects both predictions alike). Returns (score, lo90, hi90).
    """
    r, w, P, rbar, tau2, cnt = fit["r"], fit["w"], fit["P"], fit["rbar"], fit["tau2"], fit["cnt"]
    J = len(cnt)
    P_o = P[ins] - w
    with np.errstate(invalid="ignore", divide="ignore"):
        rbar_o = np.where(P_o > 0, (P[ins] * rbar[ins] - w * r) / P_o, 0.0)
    u_o = np.where(cnt[ins] >= 2, rbar_o * tau2 * P_o / (1 + tau2 * P_o), 0.0)
    sse_with = np.bincount(ins, w * (r - u_o) ** 2, J)
    sse_base = np.bincount(ins, w * r ** 2, J)
    if sse_base.sum() <= 0:
        return np.nan, np.nan, np.nan
    score = 1 - sse_with.sum() / sse_base.sum()
    idx = rng.integers(0, J, size=(BOOT, J))
    boot = 1 - sse_with[idx].sum(1) / np.maximum(sse_base[idx].sum(1), 1e-12)
    lo, hi = np.quantile(boot, [0.05, 0.95])
    return score, lo, hi


def _course_arrays(d, shift):
    eras = [e for e in ERA_LABELS if e in set(d.era)]
    era = d.era.map({e: i for i, e in enumerate(eras)}).to_numpy()
    ins_names = sorted(d.instructor.unique())
    ins = d.instructor.map({n: i for i, n in enumerate(ins_names)}).to_numpy()
    dept = d.dept.iloc[0]
    D = np.array([shift.get((dept, e), shift[("*", e)]) for e in eras])
    return eras, era, ins_names, ins, D


def fit_all(df, count_col="nA", seed=0):
    """Two passes: estimate global variance priors, then refit every course with them."""
    off = regular_offerings(df, count_col)
    shift = dept_era_shift(off)
    groups = {c: d.sort_values("t") for c, d in off.groupby("course")}
    arrays = {c: _course_arrays(d, shift) for c, d in groups.items()}

    # pass 1: rough priors, keep raw estimates from well-identified courses
    s2s, taus = [], []
    for c, d in groups.items():
        eras, era, names, ins, D = arrays[c]
        f = fit_course(d.y.to_numpy(), d.v.to_numpy(), era, ins, D, 0.3, 0.1)
        if f["dfw"] >= 10 and len(names) >= 3:
            s2s.append(f["s2_raw"])
            taus.append(f["tau_raw"])
    sw2_0 = max(float(np.median(s2s)), 0.01)
    tau2_0 = max(float(np.median(taus)), 0.01)

    rng = np.random.default_rng(seed)
    out = {}
    for c, d in groups.items():
        eras, era, names, ins, D = arrays[c]
        f = fit_course(d.y.to_numpy(), d.v.to_numpy(), era, ins, D, sw2_0, tau2_0)
        repeat_ins = int((f["cnt"] >= 2).sum())
        if repeat_ins >= MIN_REPEAT and len(d) >= MIN_OFFERINGS:
            f["sens"] = cv_sensitivity(f, ins, rng)
        else:
            f["sens"] = (np.nan, np.nan, np.nan)
        f.update(eras=eras, era_idx=era, names=names, ins_idx=ins, repeat_ins=repeat_ins,
                 v_typ=float(np.median(d.v)))
        out[c] = f
    return out, {"sw2_0": sw2_0, "tau2_0": tau2_0, "n_prior_courses": len(s2s)}, groups


def instructor_table(f):
    """Per-instructor estimates on the probability scale, at the course's latest era level."""
    cur = len(f["eras"]) - 1
    b, bv = f["beta"][cur], f["beta_var"][cur]
    u, uv = f["u"], f["u_var"]
    sd = np.sqrt(uv + bv)
    sd_pred = np.sqrt(uv + bv + f["sw2"] + f["v_typ"])
    return pd.DataFrame({
        "instructor": f["names"],
        "offerings": f["cnt"],
        "est": expit(b + u),
        "lo": expit(b + u - Z90 * sd),
        "hi": expit(b + u + Z90 * sd),
        "pred_lo": expit(b + u - Z90 * sd_pred),
        "pred_hi": expit(b + u + Z90 * sd_pred),
        "p_above": norm.cdf(u / np.sqrt(uv)),
    })


def baseline(f):
    """A typical (or new) instructor at the latest era level: estimate, 90% interval, prediction."""
    cur = len(f["eras"]) - 1
    b, bv = f["beta"][cur], f["beta_var"][cur]
    sd = np.sqrt(f["tau2"] + bv)
    sd_pred = np.sqrt(f["tau2"] + bv + f["sw2"] + f["v_typ"])
    return {"era": f["eras"][cur], "est": expit(b), "lo": expit(b - Z90 * sd), "hi": expit(b + Z90 * sd),
                "pred_lo": expit(b - Z90 * sd_pred), "pred_hi": expit(b + Z90 * sd_pred)}
