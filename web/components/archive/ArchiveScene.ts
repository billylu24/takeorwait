// The archive drawer: one lane of instructor cassettes (ranked by era-adjusted A-rate) between lanes of blank files.
// Camera, lighting and motion follow RhineLabUI's archive scene (MIT, github.com/LBEILC/RhineLabUI): a long lens
// from far away, a breathing idle wave, a ripple from the selected file, extraction, and a top-down "decryption".
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { Cassette, DARK, H, LIGHT, fillerMesh, type CassetteData, type Palette } from "./cassette";
import { damp, idleWave, selectionWave, smooth, spring, swapWave, type Spring } from "./motion";

const ROW = 0.62; // spacing between files in a lane (z)
const LANE = 5.2; // spacing between lanes (x)
const SIDE_LANES = 2; // blank lanes each side
const PAD = 14; // blank rows before and after the instructors
const LIFT_PREVIEW = 0.85;
const LIFT_DETAIL = 4.05;
const HEIGHT_PER_A = 2.2; // a 100% A-rate stands 2.2 units out of the drawer
const YAW = THREE.MathUtils.degToRad(55);
const DIST = 80;

type Mode = "overview" | "detail";

type Slot = {
  cassette: Cassette;
  index: number; // position in the ranked list
  presence: Spring; // 0 = sunk out of view, 1 = in place
  delay: number;
  leaving: boolean;
  lift: Spring;
  hover: Spring;
  yaw: Spring;
};

export type SceneEvents = {
  onPick?: (index: number) => void;
  onHover?: (index: number | null) => void;
  onReveal?: () => void;
};

export class ArchiveScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(8, 1, 20, 220);
  private composer: EffectComposer;
  private bokeh: BokehPass;
  private key: THREE.DirectionalLight;
  private palette: Palette;
  private fillers: THREE.InstancedMesh;
  private fillerCount: number;
  private dummy = new THREE.Object3D();
  private slots: Slot[] = [];
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
  private hoverIndex: number | null = null;
  private drag: { x: number; yaw: number } | null = null;
  private dragYaw = spring(0);
  private abort = new AbortController();
  private resizeObserver: ResizeObserver;
  private portrait = false;

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

    this.fillerCount = (SIDE_LANES * 2 + 1) * (PAD * 2 + 160);
    this.fillers = fillerMesh(this.palette, this.fillerCount, shadows);
    this.scene.add(this.fillers);

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: DIST, aperture: 0.0012, maxblur: 0.008 });
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.bindInput();
    this.renderer.setAnimationLoop((t) => this.tick(t / 1000));
  }

  // ---------------------------------------------------------------- data

  /** Replace the lane's contents. Old files sink, new files rise in a travelling wave. */
  setFiles(files: CassetteData[], selected: number) {
    const animate = this.slots.length > 0 && !this.reduced;
    for (const s of this.slots) {
      s.leaving = true;
      s.delay = this.time + (animate ? Math.abs(s.index - this.selected) * 0.012 : 0);
    }
    const shadows = this.renderer.shadowMap.enabled;
    const fresh = files.map((d, index): Slot => {
      const cassette = new Cassette(d, this.palette, shadows);
      cassette.setReveal(0);
      this.scene.add(cassette.group);
      return {
        cassette,
        index,
        presence: spring(animate ? 0 : this.reduced ? 1 : 0),
        delay: this.time + (animate ? 0.45 : 0.1) + Math.abs(index - selected) * 0.025,
        leaving: false,
        lift: spring(0),
        hover: spring(0),
        yaw: spring(0),
      };
    });
    this.slots = [...this.slots.filter((s) => s.leaving), ...fresh];
    this.rows = files.length;
    this.selected = Math.min(selected, files.length - 1);
    if (!animate) this.rail.value = this.selected;
    this.swapTime = this.time;
    this.decryptTime = -1;
    this.revealed = false;
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
    for (const s of this.slots) {
      if (s.leaving || s.index === index || Math.abs(s.index - index) > 7) continue;
      top = Math.max(top, s.cassette.data.est * HEIGHT_PER_A);
    }
    return top;
  }

  private live() {
    return this.slots.filter((s) => !s.leaving);
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

    // ---- instructor cassettes
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      const c = s.cassette;
      const isSel = !s.leaving && s.index === this.selected;
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
      damp(s.hover, !s.leaving && this.hoverIndex === s.index && !isSel ? 0.22 : 0, 8 * fast, dt);
      const clear = isSel && this.mode === "detail" ? smooth((s.lift.value - (liftTarget - 1.4)) / 1.2) : 0;
      damp(s.yaw, -YAW * clear + (isSel ? this.dragYaw.value : 0), this.reduced ? 40 : 5, dt);
      const row = s.index + PAD;
      const z = (this.rail.value - s.index) * ROW;
      const sink = (1 - smooth(s.presence.value)) * -7.5;
      const y = stand + this.field(row, 0) + s.lift.value + s.hover.value + sink;
      c.group.position.set(0, y, z);
      c.group.rotation.set(0, s.yaw.value, 0);
      c.group.visible = s.presence.value > 0.002 || !s.leaving;
      c.step(dt, this.reduced ? 60 : isSel ? 3.2 : 6);
      if (s.leaving && s.presence.value < 0.003 && started) {
        this.scene.remove(c.group);
        c.dispose();
        this.slots.splice(i, 1);
      }
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
    for (const s of this.slots)
      if (s !== sel) {
        s.cassette.setScan(0, 0);
        s.cassette.setReveal(0);
      }

    // ---- blank files
    let n = 0;
    const first = Math.floor(this.rail.value) - PAD - 30;
    const last = Math.ceil(this.rail.value) + PAD + 40;
    for (let lane = -SIDE_LANES; lane <= SIDE_LANES; lane++) {
      for (let r = first; r <= last && n < this.fillerCount; r++) {
        if (lane === 0 && r >= 0 && r < this.rows) continue; // instructor slot
        const z = (this.rail.value - r) * ROW;
        const y = this.field(r + PAD, lane) + (lane === 0 ? 0 : 0.0);
        this.dummy.position.set(lane * LANE, y, z);
        this.dummy.rotation.set((this.field(r + PAD + 0.5, lane) - this.field(r + PAD - 0.5, lane)) * 0.024, 0, 0);
        this.dummy.updateMatrix();
        this.fillers.setMatrixAt(n++, this.dummy.matrix);
      }
    }
    this.fillers.count = n;
    this.fillers.instanceMatrix.needsUpdate = true;

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

    if (this.frame % 3 === 0) this.updateHover();
  }

  // ---------------------------------------------------------------- input

  private ndc = new THREE.Vector2(-9, -9);

  private updateHover() {
    if (this.drag || this.ndc.x < -2) {
      this.setHover(null);
      return;
    }
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const shells = this.live().map((s) => s.cassette.shell);
    const hit = this.raycaster.intersectObjects(shells, false)[0];
    const c = hit?.object.userData.cassette as Cassette | undefined;
    const slot = c ? this.live().find((s) => s.cassette === c) : undefined;
    this.setHover(slot ? slot.index : null);
  }

  private setHover(i: number | null) {
    if (i === this.hoverIndex) return;
    this.hoverIndex = i;
    this.renderer.domElement.style.cursor = i == null ? "" : "pointer";
    this.events.onHover?.(i);
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
        if (this.hoverIndex != null) this.events.onPick?.(this.hoverIndex);
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
    for (const s of this.slots) s.cassette.dispose();
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
