// One instructor = one archive cassette: a frosted glass slab with a ceramic plate and two rings inside.
// The 3D form follows RhineLabUI's archive cassette (MIT); every visible part of ours encodes data:
//   big ring, copper arc ......... era-adjusted A-rate estimate (0–100% clockwise from 12 o'clock)
//   big ring, outer band ......... its 90% interval
//   big ring, ink tick ........... a typical (new) instructor in this course
//   small ring, copper arc ....... P(above typical)
//   glass clarity ................ certainty: wide interval = frosted, narrow = clear
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const W = 4.0; // width (x)
export const H = 3.7; // height (y); origin at the bottom centre
export const D = 0.42; // thickness (z); the face looks down +z

const BIG = { x: -0.42, y: 1.5, r: 1.0, tube: 0.1 };
const SMALL = { x: 1.18, y: 2.42, r: 0.4, tube: 0.085 };

export type CassetteData = {
  name: string;
  no: number; // rank in the course, 1-based
  total: number;
  est: number;
  lo: number;
  hi: number;
  pAbove: number;
  typical: number;
  offerings: number;
  students: number;
  last: string;
};

export type Palette = {
  background: string;
  floor: string;
  shell: string;
  edge: string;
  plate: string;
  ceramic: string;
  copper: string;
  ink: string;
  label: string;
  labelInk: string;
  labelMuted: string;
};

export const LIGHT: Palette = {
  background: "#eae5e1",
  floor: "#d8c9b9",
  shell: "#fff7ed",
  edge: "#f0e7df",
  plate: "#e2dad4",
  ceramic: "#c7beb6",
  copper: "#c07a45",
  ink: "#24221f",
  label: "#eae5dc",
  labelInk: "#171713",
  labelMuted: "#77756d",
};

export const DARK: Palette = {
  background: "#151513",
  floor: "#1d1c19",
  shell: "#b3aba0",
  edge: "#8a8278",
  plate: "#4a453e",
  ceramic: "#8d857a",
  copper: "#e0965a",
  ink: "#ece9e4",
  label: "#2f2c27",
  labelInk: "#ece9e4",
  labelMuted: "#a39f95",
};

// ---------------------------------------------------------------------------------------------
// Shared geometry (built once)

let shared: ReturnType<typeof buildShared> | null = null;
function buildShared() {
  const shell = new RoundedBoxGeometry(W, H, D, 3, 0.07);
  shell.translate(0, H / 2, 0);
  const plate = new RoundedBoxGeometry(W - 0.34, H - 0.34, 0.05, 2, 0.03);
  plate.translate(0, H / 2, -D / 2 + 0.07);
  const bigTrack = new THREE.TorusGeometry(BIG.r, BIG.tube, 20, 160);
  const bigArc = new THREE.TorusGeometry(BIG.r, BIG.tube * 1.18, 20, 200);
  const band = new THREE.RingGeometry(BIG.r + 0.2, BIG.r + 0.3, 200, 1);
  const smallTrack = new THREE.TorusGeometry(SMALL.r, SMALL.tube, 16, 96);
  const smallArc = new THREE.TorusGeometry(SMALL.r, SMALL.tube * 1.2, 16, 120);
  const tick = new THREE.BoxGeometry(0.035, 0.22, 0.03);
  const screw = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20);
  screw.rotateX(Math.PI / 2);
  const block = new THREE.BoxGeometry(0.2, 0.06, 0.16);
  const label = new THREE.PlaneGeometry(1.12, 0.52);
  const scan = new THREE.PlaneGeometry(1, 0.012);
  // engraved guide lines on the plate, like a circuit trace
  const pts: THREE.Vector3[] = [];
  const z = -D / 2 + 0.1;
  const seg = (a: [number, number], b: [number, number]) =>
    pts.push(new THREE.Vector3(a[0], a[1], z), new THREE.Vector3(b[0], b[1], z));
  seg([-1.75, 0.32], [1.6, 0.32]);
  seg([1.6, 0.32], [1.75, 0.47]);
  seg([1.75, 0.47], [1.75, 1.7]);
  seg([0.66, 2.42], [0.78, 2.42]);
  seg([-1.75, 3.38], [0.2, 3.38]);
  seg([0.2, 3.38], [0.32, 3.26]);
  for (let i = 0; i < 9; i++) seg([0.9 + i * 0.09, 0.5], [0.98 + i * 0.09, 0.66]);
  const lines = new THREE.BufferGeometry().setFromPoints(pts);
  return { shell, plate, bigTrack, bigArc, band, smallTrack, smallArc, tick, screw, block, label, scan, lines };
}

// ---------------------------------------------------------------------------------------------
// Arc materials: a full torus/ring that discards fragments outside [from, to] (fractions of a turn,
// clockwise from 12 o'clock). Uniforms are animated, so the arc can sweep smoothly.

type ArcUniforms = { uFrom: { value: number }; uTo: { value: number } };

function arcMaterial(
  params: THREE.MeshPhysicalMaterialParameters,
): THREE.MeshPhysicalMaterial & { userData: { arc: ArcUniforms } } {
  const m = new THREE.MeshPhysicalMaterial(params) as THREE.MeshPhysicalMaterial & { userData: { arc: ArcUniforms } };
  const arc: ArcUniforms = { uFrom: { value: 0 }, uTo: { value: 0 } };
  m.userData.arc = arc;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFrom = arc.uFrom;
    shader.uniforms.uTo = arc.uTo;
    shader.vertexShader =
      "varying vec2 vArcPos;\n" +
      shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvArcPos = position.xy;");
    shader.fragmentShader =
      "varying vec2 vArcPos;\nuniform float uFrom;\nuniform float uTo;\n" +
      shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float turn = atan(vArcPos.x, vArcPos.y) / 6.2831853;
        turn = turn < 0.0 ? turn + 1.0 : turn;
        if (turn < uFrom || turn > uTo) discard;`,
      );
  };
  m.customProgramCacheKey = () => "arc";
  return m;
}

// Shell glass: roughness clears from the top down as uReveal goes 0 → 1 (the "decryption").
type GlassUniforms = { uReveal: { value: number }; uFrost: { value: number } };

function glassMaterial(p: Palette): THREE.MeshPhysicalMaterial & { userData: { glass: GlassUniforms } } {
  const m = new THREE.MeshPhysicalMaterial({
    color: p.shell,
    transmission: 0.9,
    thickness: 0.18,
    roughness: 0.2,
    ior: 1.46,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
    attenuationColor: new THREE.Color("#eee6df"),
    attenuationDistance: 2,
    envMapIntensity: 0.6,
  }) as THREE.MeshPhysicalMaterial & { userData: { glass: GlassUniforms } };
  const glass: GlassUniforms = { uReveal: { value: 0 }, uFrost: { value: 0.6 } };
  m.userData.glass = glass;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = glass.uReveal;
    shader.uniforms.uFrost = glass.uFrost;
    shader.vertexShader =
      "varying float vPanelY;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nvPanelY = position.y / ${H.toFixed(2)};`,
      );
    shader.fragmentShader =
      "varying float vPanelY;\nuniform float uReveal;\nuniform float uFrost;\n" +
      shader.fragmentShader
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          float clearAmt = smoothstep(1.0 - uReveal * 1.15 - 0.1, 1.0 - uReveal * 1.15, vPanelY);
          roughnessFactor = mix(uFrost, roughnessFactor, clearAmt);`,
        )
        .replace(
          "#include <color_fragment>",
          // warm, darker toward the base: the slab reads as a solid object in the drawer
          "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(0.84, 0.79, 0.73), vec3(1.0), smoothstep(0.0, 0.8, vPanelY));",
        );
  };
  m.customProgramCacheKey = () => "glass";
  return m;
}

// ---------------------------------------------------------------------------------------------

export function fontFamily() {
  if (typeof document === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  return v || "sans-serif";
}

function drawLabel(canvas: HTMLCanvasElement, d: CassetteData, p: Palette) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const font = fontFamily();
  ctx.fillStyle = p.label;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.labelMuted;
  ctx.font = `600 34px ${font}`;
  ctx.textBaseline = "top";
  const name = d.name.length > 16 ? d.name.slice(0, 15) + "…" : d.name;
  ctx.fillStyle = p.labelInk;
  ctx.font = `500 44px ${font}`;
  ctx.fillText(name.toUpperCase(), 34, 30);
  ctx.fillStyle = p.labelInk;
  ctx.fillRect(w - 150, 30, 116, 22);
  ctx.fillStyle = p.label;
  ctx.font = `700 16px ${font}`;
  ctx.fillText("FILE", w - 140, 33);
  ctx.fillStyle = p.labelMuted;
  ctx.font = `600 22px ${font}`;
  ctx.fillText(`${d.offerings} OFFERING${d.offerings === 1 ? "" : "S"}`, w - 230, 70);
  ctx.fillStyle = p.labelInk;
  ctx.font = `500 92px ${font}`;
  ctx.fillText(`NO.${String(d.no).padStart(3, "0")}`, 30, 118);
  ctx.strokeStyle = p.labelInk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(w - 92, 168, 20, 0, Math.PI * 2);
  ctx.moveTo(w - 52 + 20, 168);
  ctx.arc(w - 52, 168, 20, 0, Math.PI * 2);
  ctx.stroke();
}

export class Cassette {
  readonly group = new THREE.Group();
  readonly shell: THREE.Mesh;
  private glass: ReturnType<typeof glassMaterial>;
  private bigArc: ReturnType<typeof arcMaterial>;
  private band: ReturnType<typeof arcMaterial>;
  private smallArc: ReturnType<typeof arcMaterial>;
  private tick: THREE.Mesh;
  private scan: THREE.Mesh;
  private labelTex: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private owned: THREE.Material[] = [];
  data: CassetteData;
  /** shown values, sprung toward data so arcs sweep */
  private shown = { est: 0, lo: 0, hi: 0, p: 0, typical: 0 };
  clarity = 0; // animated reveal 0..1
  frost: number; // roughness when fully revealed

  constructor(data: CassetteData, p: Palette, shadows: boolean) {
    shared ??= buildShared();
    const g = shared;
    this.data = data;
    this.glass = glassMaterial(p);
    this.shell = new THREE.Mesh(g.shell, this.glass);
    this.shell.castShadow = shadows;
    this.shell.receiveShadow = shadows;
    this.shell.userData.cassette = this;

    const plateMat = new THREE.MeshStandardMaterial({ color: p.plate, roughness: 0.7 });
    const plate = new THREE.Mesh(g.plate, plateMat);
    plate.receiveShadow = shadows;

    const ceramic = new THREE.MeshStandardMaterial({ color: p.ceramic, roughness: 0.55 });
    const bigTrack = new THREE.Mesh(g.bigTrack, ceramic);
    bigTrack.position.set(BIG.x, BIG.y, -0.02);
    this.bigArc = arcMaterial({ color: p.copper, metalness: 0.5, roughness: 0.3, clearcoat: 0.4 });
    const bigArc = new THREE.Mesh(g.bigArc, this.bigArc);
    bigArc.position.copy(bigTrack.position);
    // opaque on purpose: transparent meshes are not visible through transmissive glass
    this.band = arcMaterial({
      color: new THREE.Color(p.plate).lerp(new THREE.Color(p.copper), 0.5),
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const band = new THREE.Mesh(g.band, this.band);
    band.position.set(BIG.x, BIG.y, -0.04);
    this.tick = new THREE.Mesh(g.tick, new THREE.MeshStandardMaterial({ color: p.ink, roughness: 0.5 }));
    this.tick.position.z = 0.01;

    const smallTrack = new THREE.Mesh(g.smallTrack, ceramic);
    smallTrack.position.set(SMALL.x, SMALL.y, -0.02);
    this.smallArc = arcMaterial({ color: p.copper, metalness: 0.5, roughness: 0.3, clearcoat: 0.4 });
    const smallArc = new THREE.Mesh(g.smallArc, this.smallArc);
    smallArc.position.copy(smallTrack.position);

    const metal = new THREE.MeshStandardMaterial({ color: "#b9b4ac", metalness: 0.85, roughness: 0.3 });
    const screws = [
      [W / 2 - 0.22, H - 0.22],
      [-W / 2 + 0.22, 0.22],
    ].map(([x, y]) => {
      const s = new THREE.Mesh(g.screw, metal);
      s.position.set(x, y, D / 2 - 0.01);
      return s;
    });
    const block = new THREE.Mesh(g.block, new THREE.MeshStandardMaterial({ color: "#c99a45", roughness: 0.5 }));
    block.position.set(-W / 2 + 0.55, H - 0.02, 0);

    this.canvas = document.createElement("canvas");
    this.canvas.width = 512;
    this.canvas.height = 240;
    drawLabel(this.canvas, data, p);
    this.labelTex = new THREE.CanvasTexture(this.canvas);
    this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.labelTex.anisotropy = 4;
    const labelMat = new THREE.MeshBasicMaterial({ map: this.labelTex, toneMapped: false });
    const label = new THREE.Mesh(g.label, labelMat);
    label.position.set(-W / 2 + 0.76, H - 0.6, -0.04);

    const lineMat = new THREE.LineBasicMaterial({ color: p.ceramic, transparent: true, opacity: 0.8 });
    const lines = new THREE.LineSegments(g.lines, lineMat);

    this.scan = new THREE.Mesh(
      g.scan,
      new THREE.MeshBasicMaterial({ color: p.ink, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.scan.position.set(0, H / 2, D / 2 + 0.012);
    this.scan.rotation.z = Math.atan2(H * 0.74, W * 0.9);
    this.scan.renderOrder = 2;

    this.group.add(
      this.shell,
      plate,
      bigTrack,
      bigArc,
      band,
      this.tick,
      smallTrack,
      smallArc,
      ...screws,
      block,
      label,
      lines,
      this.scan,
    );
    this.owned = [
      this.glass,
      plateMat,
      ceramic,
      this.bigArc,
      this.band,
      this.tick.material as THREE.Material,
      this.smallArc,
      metal,
      block.material as THREE.Material,
      labelMat,
      lineMat,
      this.scan.material as THREE.Material,
    ];
    this.frost = frostFor(data);
    this.shown = { est: 0, lo: data.typical, hi: data.typical, p: 0, typical: data.typical };
    this.applyShown();
  }

  update(data: CassetteData, p: Palette) {
    this.data = data;
    this.frost = frostFor(data);
    drawLabel(this.canvas, data, p);
    this.labelTex.needsUpdate = true;
  }

  /** Arcs ease toward the data; call every frame. */
  step(dt: number, rate = 6) {
    const k = 1 - Math.exp(-dt * rate);
    const s = this.shown;
    const d = this.data;
    s.est += (d.est - s.est) * k;
    s.lo += (d.lo - s.lo) * k;
    s.hi += (d.hi - s.hi) * k;
    s.p += (d.pAbove - s.p) * k;
    s.typical += (d.typical - s.typical) * k;
    this.applyShown();
  }

  private applyShown() {
    const s = this.shown;
    this.bigArc.userData.arc.uFrom.value = 0;
    this.bigArc.userData.arc.uTo.value = s.est;
    this.band.userData.arc.uFrom.value = s.lo;
    this.band.userData.arc.uTo.value = s.hi;
    this.smallArc.userData.arc.uFrom.value = 0;
    this.smallArc.userData.arc.uTo.value = s.p;
    const a = s.typical * Math.PI * 2;
    const r = BIG.r + 0.25;
    this.tick.position.set(BIG.x + Math.sin(a) * r, BIG.y + Math.cos(a) * r, 0.01);
    this.tick.rotation.z = -a;
  }

  /** reveal: 0 = frosted (in the drawer), 1 = decrypted (clear to this file's certainty). */
  setReveal(reveal: number, frosted = 0.62) {
    this.glass.userData.glass.uReveal.value = reveal;
    this.glass.userData.glass.uFrost.value = frosted;
    this.glass.roughness = this.frost;
  }

  /** Diagonal scan line across the face: length 0..1, opacity 0..1. */
  setScan(length: number, opacity: number) {
    const m = this.scan.material as THREE.MeshBasicMaterial;
    m.opacity = opacity;
    this.scan.visible = opacity > 0.001 && length > 0.001;
    this.scan.scale.set(Math.max(0.001, length) * Math.hypot(W * 0.9, H * 0.74), 1, 1);
  }

  dispose() {
    this.owned.forEach((m) => m.dispose());
    this.labelTex.dispose();
  }
}

/** Interval width → resting roughness. A 10-point interval is clear glass; 40+ points stays frosted. */
function frostFor(d: CassetteData) {
  const width = d.hi - d.lo;
  return THREE.MathUtils.clamp(0.04 + (width - 0.1) * 1.1, 0.04, 0.42);
}

/** Blank filler cassettes for the rest of the drawer (decorative, no data). */
export function fillerMesh(p: Palette, count: number, shadows: boolean) {
  shared ??= buildShared();
  const mat = new THREE.MeshPhysicalMaterial({
    color: p.shell,
    roughness: 0.32,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
    sheen: 0.3,
    sheenColor: new THREE.Color(p.edge),
    envMapIntensity: 0.6,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying float vPanelY;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nvPanelY = position.y / ${H.toFixed(2)};`,
      );
    shader.fragmentShader =
      "varying float vPanelY;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(0.42, 0.33, 0.24), vec3(1.0, 0.98, 0.94), smoothstep(0.08, 1.0, vPanelY));",
      );
  };
  const mesh = new THREE.InstancedMesh(shared.shell, mat, count);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
}
