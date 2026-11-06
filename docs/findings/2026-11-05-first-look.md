# Findings 2026-11-05: first look

Generated with the `project-for-acm` env from data fetched on 2026-11-06T07:06:14Z (courseGrades.csv sha256 cb8ab64eaff5).

Shrinkage below is **not era-adjusted yet**; see `docs/methodology.md`.

## `python analysis/prof_compare.py "CMPSC 24" "PHYS 7A" "PHYS 7B" "MATH 4B"`

```text

==================== CMPSC 24: 59 offerings (48 non-summer), 2010-2026, 5125 graded students
course mean A-rate per offering = 57.1%, between-offering sd = 20.3%
              offerings  students  quarters    last   raw    lo    hi  shrunk    sd  pctile   DF%   gpa
instructor                                                                                             
BOYLAND P             1        53        Fa  2025Fa  96.2  96.2  96.2    76.1  14.2   100.0   0.0  3.96
BURK K T              4       451  Fa,Sp,Wi  2025Wi  74.5  64.4  82.1    74.5   3.7    82.0   5.8  3.52
KOZERAWSKI J          1        97        Wi  2021Wi  88.7  88.7  88.7    72.4  14.2    91.0   5.2  3.71
MIRZA D              15      1855  Fa,Sp,Wi  2026Sp  70.3  33.1  83.7    69.4   3.5    64.0   4.0  3.49
NICHOLS L H           1        81        Fa  2019Fa  72.8  72.8  72.8    64.7  14.2    73.0   6.2  3.50
AGRAWAL D             9       748  Fa,Sp,Wi  2020Fa  56.4  37.5  86.4    56.2   4.8    55.0  10.2  3.15
BUONI M J             1        95        Sp  2014Sp  51.6  51.6  51.6    54.4  14.2    45.0   4.2  3.20
MAJEDI M              1        62        Fa  2024Fa  48.4  48.4  48.4    52.9  14.2    36.0  14.5  3.02
BOE B A               1        61        Fa  2013Fa  37.7  37.7  37.7    47.7  14.2    27.0  18.0  2.70
COSTANZO C            6       563  Fa,Sp,Wi  2016Fa  37.3  24.2  46.9    38.5   3.1    18.0   6.2  2.99
FRANKLIN D M          8       787  Fa,Sp,Wi  2015Sp  33.4  20.2  53.8    33.7   3.5     9.0  11.8  2.86
A-rate by era: 09-14: 39% | 15-19: 55% | 20-21: 82% | 22-26: 69%
recent rotation: Wi2024 MIRZA -> Sp2024 BURK -> Fa2024 MAJEDI -> Wi2025 BURK -> Sp2025 MIRZA -> Fa2025 BOYLAND -> Wi2026 MIRZA -> Sp2026 MIRZA

==================== PHYS 7A: 9 offerings (6 non-summer), 2024-2026, 1988 graded students
course mean A-rate per offering = 45.6%, between-offering sd = 12.8%
              offerings  students quarters    last   raw    lo    hi  shrunk   sd  pctile   DF%   gpa
instructor                                                                                           
KOUTROULAKIS          3      1460       Wi  2026Wi  57.0  54.0  59.5    56.6  1.6   100.0   7.8  3.24
FREUND E G            1       114       Sp  2026Sp  36.8  36.8  36.8    41.3  8.9    67.0   9.6  2.89
POPESCU P F           2       207       Sp  2025Sp  32.9  29.1  37.1    34.3  3.8    33.0  16.9  2.64
A-rate by era: 22-26: 53%
recent rotation: Wi2024 KOUTROULAKIS -> Sp2024 POPESCU -> Wi2025 KOUTROULAKIS -> Sp2025 POPESCU -> Wi2026 KOUTROULAKIS -> Sp2026 FREUND

==================== PHYS 7B: 8 offerings (5 non-summer), 2024-2026, 1536 graded students
course mean A-rate per offering = 39.4%, between-offering sd = 11.0%
              offerings  students quarters    last   raw    lo    hi  shrunk   sd  pctile   DF%   gpa
instructor                                                                                           
OEHLMANN P            1       430       Sp  2025Sp  57.7  57.7  57.7    48.2  7.7   100.0   2.3  3.42
KOUTROULAKIS          2       750       Sp  2026Sp  38.9  38.2  39.5    38.9  0.7    67.0   4.5  3.06
POPESCU P F           2       114       Fa  2025Fa  30.7  29.8  31.6    30.8  0.9    33.0  12.3  2.76
A-rate by era: 22-26: 44%
recent rotation: Sp2024 KOUTROULAKIS -> Fa2024 POPESCU -> Sp2025 OEHLMANN -> Fa2025 POPESCU -> Sp2026 KOUTROULAKIS

==================== MATH 4B: 119 offerings (88 non-summer), 2013-2026, 19708 graded students
course mean A-rate per offering = 52.7%, between-offering sd = 20.3%
               offerings  students  quarters    last   raw    lo    hi  shrunk    sd  pctile  DF%   gpa
instructor                                                                                             
GARFIELD P M           2       846        Sp  2021Sp  85.5  82.4  88.6    84.7   3.1    95.0  1.7  3.76
CHIANG H               2       290     Fa,Wi  2026Wi  79.0  76.6  81.4    78.6   2.4    91.0  0.3  3.70
GARCIA-CERVER          1       349        Wi  2020Wi  90.8  90.8  90.8    71.5  14.3   100.0  0.9  3.87
ATZBERGER P J          1       354        Wi  2022Wi  88.1  88.1  88.1    70.1  14.3    98.0  0.6  3.81
EBRAHIM E              2       296     Fa,Sp  2020Sp  73.3  64.6  81.6    70.0   7.8    86.0  2.7  3.57
PORTER M J             7      1504  Fa,Sp,Wi  2024Fa  73.0  47.4  89.4    68.0   5.6    84.0  4.8  3.49
CHO G                  4       510     Fa,Sp  2024Sp  67.8  56.7  74.4    67.8   3.9    77.0  2.7  3.50
KELZ J M               3       746     Sp,Wi  2019Sp  72.1  55.3  79.6    67.1   6.8    81.0  4.7  3.49
RATHORE J              2       291     Sp,Wi  2025Sp  70.1  60.6  78.6    66.7   8.2    79.0  1.7  3.56
CHEN H                 1       143        Fa  2019Fa  79.7  79.7  79.7    66.0  14.3    93.0  2.8  3.66
TIAN W                 1       140        Sp  2024Sp  78.6  78.6  78.6    65.4  14.3    88.0  0.0  3.69
ZHANG Q                3       500     Sp,Wi  2025Wi  64.8  46.7  72.6    62.2   7.9    72.0  5.2  3.38
SCHLEY N B             4       733  Fa,Sp,Wi  2025Fa  64.7  41.2  82.4    61.8   7.8    70.0  9.3  3.29
NAGY A                 5       626  Fa,Sp,Wi  2022Fa  63.3  50.0  82.2    60.6   5.9    65.0  6.1  3.35
A-rate by era: 09-14: 28% | 15-19: 44% | 20-21: 70% | 22-26: 63%
recent rotation: Fa2025 CHIANG -> Fa2025 SCHLEY -> Fa2025 SCROGGIN -> Wi2026 CHIANG -> Wi2026 YANG -> Wi2026 YANG -> Sp2026 MCCAMMOND -> Sp2026 SCROGGIN
```

## `python analysis/variance_share.py`

```text
660 courses with >=15 regular offerings and >=3 instructors
       era_R2  instructor_R2_after_era
count  658.00                   658.00
mean     0.38                     0.24
std      0.24                     0.20
min      0.00                     0.00
25%      0.19                     0.06
50%      0.36                     0.19
75%      0.55                     0.37
max      0.95                     0.83

Most instructor-sensitive (era-adjusted):
    course  offerings  instructors  era_R2  instructor_R2_after_era
    EEMB 2         52            7    0.38                     0.83
 WRIT 105G         42            7    0.05                     0.78
 GLOBL 130         44           10    0.20                     0.76
  PHYS 131         16            6    0.15                     0.75
  ED 199RA         22            7    0.29                     0.75
   CHEM 1C         65           19    0.05                     0.74
WRIT 109ST         61           11    0.00                     0.73
  ECON 171         47            8    0.23                     0.72
     SOC 1         52           12    0.28                     0.72
 WRIT 107L         57            5    0.42                     0.71

Least instructor-sensitive:
    course  offerings  instructors  era_R2  instructor_R2_after_era
  COMM 145         21            3    0.30                      0.0
 POL S 162         15            4    0.39                      0.0
 EEMB W 22         19            3    0.36                      0.0
   PSY 148         21            3    0.46                      0.0
  EEMB 171         17            3    0.31                      0.0
ENV S 135A         17            3    0.39                      0.0
  ECON 130         24            6    0.54                      0.0
  EEMB 112         34            3    0.41                      0.0
MCDB 126AL         19            4    0.92                      0.0
 CNCSP 114         15            7    0.65                      0.0
```
