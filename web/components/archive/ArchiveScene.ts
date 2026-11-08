// The archive drawer: one column per course (neighbouring courses of a department side by side); in each column the
// instructors are ranked by era-adjusted A-rate. The centre column is active; the others slide in from the sides.
// Camera, lighting and motion follow RhineLabUI's archive scene (MIT, github.com/LBEILC/RhineLabUI): a long lens
// from far away, a breathing idle wave, a ripple from the selected file, extraction, and a top-down "decryption".
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { Cassette, DARK, H, INTERIOR, LIGHT, fillerMesh, type CassetteData, type Palette } from "./cassette";
import { damp, idleWave, selectionWave, smooth, spring, swapWave, type Spring } from "./motion";

const ROW = 0.62; // spacing between files in a lane (z)
const LANE = 5.2; // spacing between lanes (x)
const SIDE_LANES = 4; // lanes drawn each side of the active column (data or blank)
const PAD = 14; // row offset for the wave phase
const LIFT_PREVIEW = 0.85;
const LIFT_DETAIL = 4.05;
const HEIGHT_PER_A = 2.2; // a 100% A-rate stands 2.2 units out of the drawer
const YAW = THREE.MathUtils.degToRad(55);
const DIST = 80;
const NEAR = 1; // lanes each side of the centre shown in full; farther lanes show opaque shells
const FILLER_REACH = 5; // filler bounding sphere plus the length of its shadow, for culling against the view

type Mode = "overview" | "detail";

type Slot = {
  cassette: Cassette;
  index: number; // position in the column's ranked list
  presence: Spring; // 0 = sunk out of view, 1 = in place
  delay: number;
  leaving: boolean;
  lift: Spring;
  hover: Spring;
  yaw: Spring;
  full: Spring; // 0 = lite shell, 1 = glass with the interior showing
};

/** A column as given by the app: a course key and its ranked files (null = blank lane). */
export type ColumnSpec = { key: string; files: CassetteData[] | null };

type Column = {
  key: string;
  files: CassetteData[] | null;
  pos: Spring; // lane position relative to the active column (0 = centre)
  target: number;
  slots: Slot[];
  leaving: boolean;
};

export type SceneEvents = {
  onPick?: (index: number, column: string) => void;
  onHover?: (index: number | null) => void;
  onReveal?: () => void;
};

export class ArchiveScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(8, 1, 20, 220);
  private depthCamera = new THREE.PerspectiveCamera(); // the camera without file interiors, for depth of field
  private composer: EffectComposer;
  private bokeh: BokehPass;
  private key: THREE.DirectionalLight;
  private palette: Palette;
  private fillers: THREE.InstancedMesh;
  private fillerCount: number;
  private dummy = new THREE.Object3D();
  private columns: Column[] = [];
  private active = "";
  private rows = 0;
  private mode: Mode = "overview";
  private selected = 0;
  private rail = spring(0);
  private detail = spring(0);
  private aim = new THREE.Vector3();
  private ripples: { row: number; time: number }[] = [];
  private swapTime = -10;
  private decryptTime = -1;
  private revealed = false;
  private time = 0;
  private last = 0;
  private frame = 0;
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private hover: { column: string; index: number } | null = null;
  private drag: { x: number; yaw: number } | null = null;
  private dragYaw = spring(0);
  private abort = new AbortController();
  private resizeObserver: ResizeObserver;
  private portrait = false;
  private frustum = new THREE.Frustum();
  private viewProj = new THREE.Matrix4();
  private sphere = new THREE.Sphere(new THREE.Vector3(), FILLER_REACH);
  private samples: number[] = [];
  private quality = 0; // steps taken down: 1 no depth of field, 2 pixel ratio 1, 3 no shadows

  constructor(
    private container: HTMLElement,
    private events: SceneEvents,
    private reduced: boolean,
    dark: boolean,
  ) {
    this.palette = dark ? DARK : LIGHT;
    const shadows = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = dark ? 1.15 : 1.05;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(this.palette.background);
    this.scene.fog = new THREE.Fog(this.palette.background, 80, 110);

    // studio light, as in the reference: room environment + hemisphere + warm key + cool fill
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environmentIntensity = dark ? 0.5 : 0.48;
    this.scene.add(new THREE.HemisphereLight("#fffaf5", dark ? "#3a3027" : "#b4a18c", dark ? 0.35 : 0.65));
    this.key = new THREE.DirectionalLight("#fff7ed", dark ? 1.1 : 1.4);
    this.key.castShadow = shadows;
    Object.assign(this.key.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, near: 0.1, far: 60 });
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0003;
    this.key.shadow.normalBias = 0.035;
    this.key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight("#ffffff", 0.6);
    fill.position.set(7, 8, -10);
    this.scene.add(this.key, this.key.target, fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: this.palette.floor, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = shadows;
    this.scene.add(floor);

    this.fillerCount = (SIDE_LANES * 2 + 2) * 72;
    this.fillers = fillerMesh(this.palette, this.fillerCount, shadows);
    this.scene.add(this.fillers);

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.camera.layers.enable(INTERIOR);
    this.bokeh = new BokehPass(this.scene, this.depthCamera, { focus: DIST, aperture: 0.0012, maxblur: 0.008 });
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.bindInput();
    this.renderer.setAnimationLoop((t) => this.tick(t / 1000));
    this.schedulePrepare();
  }

  // ---------------------------------------------------------------- data

  /** Lay out the columns (left to right, the active one included). Columns already on screen slide to their new
   * lane; a column whose files changed swaps them (old files sink, new ones rise in a travelling wave). */
  setColumns(specs: ColumnSpec[], activeKey: string, selected: number) {
    const centre = specs.findIndex((c) => c.key === activeKey);
    const anyOld = this.columns.length > 0;
    const shifted = anyOld && activeKey !== this.active;
    const keep = new Set(specs.map((c) => c.key));
    for (const col of this.columns)
      if (!keep.has(col.key) && !col.leaving) {
        col.leaving = true;
        for (const s of col.slots) this.retire(s, 0);
      }
    specs.forEach((spec, i) => {
      const pos = i - centre;
      let col = this.columns.find((c) => c.key === spec.key && !c.leaving);
      if (!col) {
        // enter from beyond the far side when the drawer is sliding, else in place
        const from = shifted ? pos + Math.sign(pos || 1) : pos;
        col = {
          key: spec.key,
          files: null,
          pos: spring(this.reduced ? pos : from),
          target: pos,
          slots: [],
          leaving: false,
        };
        this.columns.push(col);
      }
      col.target = pos;
      if (!sameFiles(col.files, spec.files)) this.fill(col, spec.files, spec.key === activeKey ? selected : 0, anyOld);
    });
    if (activeKey !== this.active) {
      this.active = activeKey;
      this.decryptTime = -1;
      this.revealed = false;
    }
    const act = this.activeColumn();
    this.rows = act?.files?.length ?? 0;
    this.selected = Math.max(0, Math.min(selected, this.rows - 1));
    if (!anyOld) this.rail.value = this.selected;
  }

  private fill(col: Column, files: CassetteData[] | null, selected: number, animate: boolean) {
    const swap = animate && !this.reduced;
    for (const s of col.slots) this.retire(s, swap ? Math.abs(s.index - selected) * 0.012 : 0);
    col.files = files;
    const shadows = this.renderer.shadowMap.enabled;
    const fresh = (files ?? []).map((d, index): Slot => {
      const cassette = new Cassette(d, this.palette, shadows);
      cassette.setReveal(0);
      this.scene.add(cassette.group);
      return {
        cassette,
        index,
        presence: spring(this.reduced ? 1 : 0),
        delay: this.time + (swap ? 0.45 : 0.1) + Math.abs(index - selected) * 0.025,
        leaving: false,
        lift: spring(0),
        hover: spring(0),
        yaw: spring(0),
        full: spring(0),
      };
    });
    col.slots = [...col.slots.filter((s) => s.leaving), ...fresh];
    if (col.key === this.active || !this.active) {
      this.swapTime = this.time;
      this.decryptTime = -1;
      this.revealed = false;
    }
  }

  private retire(s: Slot, delay: number) {
    if (s.leaving) return;
    s.leaving = true;
    s.delay = this.time + delay;
  }

  private activeColumn() {
    return this.columns.find((c) => c.key === this.active && !c.leaving);
  }

  setSelection(index: number, mode: Mode) {
    const changed = index !== this.selected;
    const modeChanged = mode !== this.mode;
    this.selected = Math.max(0, Math.min(index, this.rows - 1));
    this.mode = mode;
    if (changed && !this.reduced) this.ripples.push({ row: this.selected, time: this.time });
    if (changed || modeChanged) {
      this.decryptTime = -1;
      this.revealed = false;
      this.dragYaw.value = 0;
    }
  }

  // ---------------------------------------------------------------- frame

  /** Highest standing top among nearby files in the lane (so an extracted file never cuts through one). */
  private neighbourTop(index: number) {
    let top = 0;
    for (const s of this.activeColumn()?.slots ?? []) {
      if (s.leaving || s.index === index || Math.abs(s.index - index) > 7) continue;
      top = Math.max(top, s.cassette.data.est * HEIGHT_PER_A);
    }
    return top;
  }

  private live() {
    return (this.activeColumn()?.slots ?? []).filter((s) => !s.leaving);
  }

  private field(row: number, lane: number) {
    let y = this.reduced ? 0 : idleWave(row, lane, this.time);
    for (const r of this.ripples) y += selectionWave(Math.hypot(row - r.row, lane * 1.6), this.time - r.time);
    if (!this.reduced)
      y += swapWave(Math.abs(row - this.selected) + Math.abs(lane) * 0.65, this.time - this.swapTime) * 0.6;
    return y;
  }

  private tick(now: number) {
    const dt = Math.min(0.05, this.last ? now - this.last : 0.016);
    this.last = now;
    this.update(dt);
    this.composer.render(dt);
    this.adapt(dt);
  }

  /** A machine that cannot hold 45 fps loses, in turn, depth of field, the high pixel ratio and shadows. */
  private adapt(dt: number) {
    if (this.time < 3 || this.quality >= 3) return; // skip start-up (shader compilation)
    this.samples.push(dt);
    if (this.samples.length < 90) return;
    const median = this.samples.sort((a, b) => a - b)[45];
    this.samples = [];
    if (median <= 1 / 45) return;
    this.quality++;
    if (this.quality === 1) this.bokeh.enabled = false;
    if (this.quality === 2) {
      this.renderer.setPixelRatio(1);
      this.composer.setPixelRatio(1);
      this.resize();
    }
    if (this.quality === 3) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true;
      });
    }
  }

  /** Debug/testing: advance the simulation without rendering each step (software WebGL is too slow to watch). */
  advance(seconds: number) {
    for (let t = 0; t < seconds; t += 1 / 60) this.update(1 / 60);
  }

  private update(dt: number) {
    this.time += dt;
    this.frame++;
    this.ripples = this.ripples.filter((r) => this.time - r.time < 3.4);
    const fast = this.reduced ? 40 : 1;

    damp(this.rail, this.selected, this.reduced ? 40 : 3.2, dt);
    damp(this.detail, this.mode === "detail" ? 1 : 0, this.reduced ? 40 : 3.4, dt);
    damp(this.dragYaw, this.drag ? this.drag.yaw : 0, 6, dt);
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const detail = THREE.MathUtils.clamp(this.detail.value, 0, 1);

    // ---- columns slide to their lanes; files in every column
    for (let ci = this.columns.length - 1; ci >= 0; ci--) {
      const col = this.columns[ci];
      damp(col.pos, col.target, this.reduced ? 40 : 4.2, dt);
      const isActive = col.key === this.active && !col.leaving;
      for (let i = col.slots.length - 1; i >= 0; i--) {
        const s = col.slots[i];
        const c = s.cassette;
        const isSel = isActive && !s.leaving && s.index === this.selected;
        const started = this.time >= s.delay;
        damp(s.presence, s.leaving ? (started ? 0 : 1) : started ? 1 : 0, this.reduced ? 40 : 5.5, dt);
        // Clear the neighbours' tops before turning toward the camera; turn back before descending.
        const stand = c.data.est * HEIGHT_PER_A;
        let liftTarget = 0;
        if (isSel)
          liftTarget =
            this.mode === "detail" ? LIFT_DETAIL + Math.max(0, this.neighbourTop(s.index) - stand) : LIFT_PREVIEW;
        const turning = Math.abs(s.yaw.value) > 0.04 && !(isSel && this.mode === "detail");
        if (!turning) damp(s.lift, liftTarget, this.reduced ? 40 : isSel && this.mode === "detail" ? 3.6 : 4.5, dt);
        const hovered = this.hover?.column === col.key && this.hover.index === s.index;
        damp(s.hover, !s.leaving && hovered && !isSel ? 0.22 : 0, 8 * fast, dt);
        const clear = isSel && this.mode === "detail" ? smooth((s.lift.value - (liftTarget - 1.4)) / 1.2) : 0;
        damp(s.yaw, -YAW * clear + (isSel ? this.dragYaw.value : 0), this.reduced ? 40 : 5, dt);
        const lane = col.pos.value;
        const z = (this.rail.value - s.index) * ROW;
        const sink = (1 - smooth(s.presence.value)) * -7.5;
        const y = stand + this.field(s.index + PAD, lane) + s.lift.value + s.hover.value + sink;
        c.group.position.set(lane * LANE, y, z);
        c.group.rotation.set(0, s.yaw.value, 0);
        // only files near the visible rows are drawn
        const near = Math.abs(s.index - this.rail.value) < 34 && Math.abs(lane) < SIDE_LANES + 0.5;
        c.group.visible = near && (s.presence.value > 0.002 || !s.leaving);
        // near lanes in full once their files are prepared (they fade in); far lanes as shells
        const inFull = Math.abs(lane) < NEAR + 0.5 && !col.leaving;
        damp(s.full, inFull && c.prepared ? 1 : 0, this.reduced ? 40 : 6, dt);
        c.setFullness(THREE.MathUtils.clamp(s.full.value, 0, 1));
        c.step(dt, this.reduced ? 60 : isSel ? 3.2 : 6);
        if (s.leaving && s.presence.value < 0.003 && started) {
          this.scene.remove(c.group);
          c.dispose();
          col.slots.splice(i, 1);
        }
      }
      if (col.leaving && col.slots.length === 0) this.columns.splice(ci, 1);
    }
    // ---- decryption of the extracted file
    const sel = this.live().find((s) => s.index === this.selected);
    if (sel) {
      const c = sel.cassette;
      const ready = this.mode === "detail" && sel.lift.value > LIFT_DETAIL - 0.75 && detail > 0.8;
      if (ready && this.decryptTime < 0) this.decryptTime = this.time;
      if (this.decryptTime >= 0) {
        const t = this.reduced ? 10 : this.time - this.decryptTime;
        const grow = smooth(t / 0.55);
        const retract = 1 - smooth((t - 0.95) / 0.35);
        c.setScan(grow * retract, smooth(t / 0.1) * retract);
        c.setReveal(smooth((t - 1.05) / 0.6));
        if (!this.revealed && t > 0.35) {
          this.revealed = true;
          this.events.onReveal?.();
        }
      } else {
        c.setScan(0, 0);
        c.setReveal(0);
      }
    }
    for (const col of this.columns)
      for (const s of col.slots)
        if (s !== sel) {
          s.cassette.setScan(0, 0);
          s.cassette.setReveal(0);
        }

    // ---- camera: a long lens far away, re-aimed so the selected file sits beside the text panel
    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(26, 13, detail));
    const yaw = YAW + this.pointerSmooth.x * 0.012 * (this.reduced ? 0 : 1);
    const view = new THREE.Vector3(-Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), view).normalize();
    const up = new THREE.Vector3().crossVectors(view, right).normalize();
    const selY = sel ? sel.cassette.group.position.y : 1.5;
    const span = this.portrait ? THREE.MathUtils.lerp(10, 7, detail) : THREE.MathUtils.lerp(7.6, 6.9, detail);
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    const pixelScale = height / span;
    // where the selected file should appear on screen (fractions of the canvas)
    const fx = this.portrait ? 0.5 : THREE.MathUtils.lerp(0.36, 0.3, detail);
    const fy = this.portrait ? 0.5 : THREE.MathUtils.lerp(0.5, 0.45, detail);
    const target = new THREE.Vector3(0, THREE.MathUtils.lerp(selY + H * 0.62, selY + H / 2, detail), 0);
    target.addScaledVector(right, ((0.5 - fx) * width) / pixelScale);
    target.addScaledVector(up, ((fy - 0.5) * height) / pixelScale);
    this.aim.lerp(target, this.reduced ? 1 : 1 - Math.exp(-dt * 6));
    this.camera.position.copy(this.aim).addScaledVector(view, DIST);
    this.camera.position.addScaledVector(up, -this.pointerSmooth.y * 0.1 * (this.reduced ? 0 : 1));
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(span / 2 / DIST));
    this.camera.aspect = width / height;
    this.camera.lookAt(this.aim);
    this.camera.updateProjectionMatrix();
    this.depthCamera.copy(this.camera);
    this.depthCamera.layers.set(0);

    const fog = this.scene.fog as THREE.Fog;
    fog.near = DIST + THREE.MathUtils.lerp(4, -1, detail);
    fog.far = DIST + THREE.MathUtils.lerp(26, 14, detail);
    this.key.position.copy(this.aim).add(new THREE.Vector3(-6, 14, -5));
    this.key.target.position.copy(this.aim);

    const focusPoint = sel ? sel.cassette.group.position.clone().setY(selY + H / 2) : this.aim;
    (this.bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = this.camera.position.distanceTo(focusPoint);
    (this.bokeh.uniforms as Record<string, THREE.IUniform>).aperture.value = THREE.MathUtils.lerp(
      0.0007,
      0.0016,
      detail,
    );

    // ---- blank files: every lane, in the rows a column's files do not occupy
    this.camera.updateMatrixWorld();
    this.viewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProj);
    let n = 0;
    const first = Math.floor(this.rail.value) - 30;
    const last = Math.ceil(this.rail.value) + 40;
    const lanes: { x: number; rows: number }[] = this.columns
      .filter((c) => !c.leaving)
      .map((c) => ({ x: c.pos.value, rows: c.slots.some((sl) => !sl.leaving) ? (c.files?.length ?? 0) : 0 }));
    const taken = new Set(this.columns.filter((c) => !c.leaving).map((c) => c.target));
    for (let l = -SIDE_LANES; l <= SIDE_LANES; l++) if (!taken.has(l)) lanes.push({ x: l, rows: 0 });
    for (const { x, rows } of lanes) {
      if (Math.abs(x) > SIDE_LANES + 0.5) continue;
      for (let r = first; r <= last && n < this.fillerCount; r++) {
        if (r >= 0 && r < rows) continue; // a file stands here
        const z = (this.rail.value - r) * ROW;
        const y = this.field(r + PAD, x);
        // instanced meshes are not culled per instance: skip blanks outside the view (about 3 in 4)
        this.sphere.center.set(x * LANE, y + H / 2, z);
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        this.dummy.position.set(x * LANE, y, z);
        this.dummy.rotation.set((this.field(r + PAD + 0.5, x) - this.field(r + PAD - 0.5, x)) * 0.024, 0, 0);
        this.dummy.updateMatrix();
        this.fillers.setMatrixAt(n++, this.dummy.matrix);
      }
    }
    this.fillers.count = n;
    this.fillers.instanceMatrix.needsUpdate = true;

    if (this.frame % 3 === 0) this.updateHover();
  }

  /** Prepare files in the browser's idle time after each frame, so the work never lengthens a frame whatever the
   * refresh rate (Safari has no requestIdleCallback: there, one slice per frame). */
  private schedulePrepare() {
    if (this.abort.signal.aborted) return;
    if (typeof requestIdleCallback === "function")
      requestIdleCallback(
        (d) => {
          this.prepareFiles(() => d.timeRemaining(), d.didTimeout);
          this.schedulePrepare();
        },
        { timeout: 400 },
      );
    else
      requestAnimationFrame(() => {
        this.prepareFiles(() => 0, true);
        this.schedulePrepare();
      });
  }

  /** Get files ready to be shown in full, a slice at a time while `left()` ms remain (one slice when `force`d): near
   * lanes first, then the far lanes, so a switch finds them ready. */
  private prepareFiles(left: () => number, force: boolean) {
    const todo: { s: Slot; lane: number }[] = [];
    for (const col of this.columns) {
      const lane = Math.abs(col.target);
      if (col.leaving) continue;
      for (const s of col.slots)
        if (!s.leaving && !s.cassette.prepared && Math.abs(s.index - this.rail.value) < 34) todo.push({ s, lane });
    }
    if (!todo.length) return;
    const dist = (s: Slot) => Math.abs(s.index - this.rail.value);
    todo.sort((a, b) => a.lane - b.lane || dist(a.s) - dist(b.s));
    let first = true;
    for (const { s } of todo)
      while (!s.cassette.prepared) {
        if (!(first && force) && left() < 1.5) return; // a slice takes up to ~1.5 ms
        first = false;
        s.cassette.prepareStep(this.renderer, this.camera, this.scene);
      }
  }

  // ---------------------------------------------------------------- input

  private ndc = new THREE.Vector2(-9, -9);

  private updateHover() {
    if (this.drag || this.ndc.x < -2) {
      this.setHover(null);
      return;
    }
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const shells: THREE.Object3D[] = [];
    for (const col of this.columns)
      if (!col.leaving)
        for (const sl of col.slots) if (!sl.leaving && sl.cassette.group.visible) shells.push(sl.cassette.shell);
    const hit = this.raycaster.intersectObjects(shells, false)[0];
    const c = hit?.object.userData.cassette as Cassette | undefined;
    for (const col of this.columns) {
      const sl = c && col.slots.find((x) => x.cassette === c);
      if (sl) return this.setHover({ column: col.key, index: sl.index });
    }
    this.setHover(null);
  }

  private setHover(h: { column: string; index: number } | null) {
    if (h?.column === this.hover?.column && h?.index === this.hover?.index) return;
    this.hover = h;
    this.renderer.domElement.style.cursor = h ? "pointer" : "";
    this.events.onHover?.(h && h.column === this.active ? h.index : null);
  }

  private bindInput() {
    const el = this.renderer.domElement;
    const signal = this.abort.signal;
    let down: { x: number; y: number } | null = null;
    el.addEventListener(
      "pointermove",
      (e) => {
        const r = el.getBoundingClientRect();
        this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        this.pointer.set(this.ndc.x, this.ndc.y);
        if (this.drag) this.drag.yaw = THREE.MathUtils.clamp((e.clientX - this.drag.x) / 160, -1.2, 1.2);
      },
      { signal },
    );
    el.addEventListener("pointerleave", () => this.ndc.set(-9, -9), { signal });
    el.addEventListener(
      "webglcontextrestored",
      () => {
        for (const col of this.columns) for (const s of col.slots) s.cassette.unprepare();
      },
      { signal },
    );
    el.addEventListener(
      "pointerdown",
      (e) => {
        down = { x: e.clientX, y: e.clientY };
        if (this.mode === "detail") {
          this.drag = { x: e.clientX, yaw: 0 };
          el.setPointerCapture(e.pointerId);
        }
      },
      { signal },
    );
    el.addEventListener(
      "pointerup",
      (e) => {
        const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) : 99;
        this.drag = null;
        down = null;
        if (moved > 6) return;
        this.updateHover();
        if (this.hover) this.events.onPick?.(this.hover.index, this.hover.column);
      },
      { signal },
    );
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.portrait = w / h < 0.9;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.abort.abort();
    this.resizeObserver.disconnect();
    for (const col of this.columns) for (const s of col.slots) s.cassette.dispose();
    this.fillers.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
  } catch {
    return false;
  }
}

function sameFiles(a: CassetteData[] | null, b: CassetteData[] | null) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(
    (f, i) => f.name === b[i].name && f.est === b[i].est && f.next === b[i].next && f.photo === b[i].photo,
  );
}
