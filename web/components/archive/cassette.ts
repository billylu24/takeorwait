// One instructor = one archive cassette: a frosted glass slab with a ceramic plate and two rings inside.
// The 3D form follows RhineLabUI's archive cassette (MIT); every visible part of ours encodes data:
//   big ring, copper arc ......... era-adjusted A-rate estimate (0–100% clockwise from 12 o'clock)
//   big ring, outer band ......... its 90% interval
//   big ring, ink tick ........... a typical (new) instructor in this course
//   small ring, copper arc ....... P(above typical)
//   glass clarity ................ certainty: wide interval = frosted, narrow = clear
//   block on the top edge ........ green: on next quarter's schedule; amber: history only
//   name plate + photo ........... who it is (photo only when verified on an official UCSB page)
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const W = 4.0; // width (x)
export const H = 3.7; // height (y); origin at the bottom centre
export const D = 0.42; // thickness (z); the face looks down +z
/** Layer of everything inside the glass. The depth-of-field pass leaves it out: the shell in front already
 * gives that depth. */
export const INTERIOR = 1;

const BIG = { x: -0.5, y: 1.9, r: 0.9, tube: 0.095 };
const SMALL = { x: 1.3, y: 1.3, r: 0.36, tube: 0.08 };
const PHOTO = { x: 1.3, y: 2.64, w: 0.62, h: 0.76 };
const NAME = { x: 0, y: 0.42, w: 3.44, h: 0.5 };
// label and photo share one canvas (one texture, one draw call): label at the left, photo at the right
const SHEET = {
  w: 760,
  h: 304,
  label: { w: 512, h: 240 },
  photo: { x: 512, w: 248, h: 304 },
};

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
  last: string; // last quarter taught ("" for a new instructor)
  nameLast: string; // name plate: large
  nameRest: string; // name plate: small (initials or given name)
  next: boolean; // on next quarter's schedule
  quarter: string; // next quarter, e.g. "Winter 2027"
  photo?: string; // same-origin URL, only for verified photos
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
  next: string;
  past: string;
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
  next: "#4f9a62",
  past: "#c99a45",
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
  next: "#6fbf82",
  past: "#d6a752",
};

// ---------------------------------------------------------------------------------------------
// Shared geometry (built once)

let shared: ReturnType<typeof buildShared> | null = null;

/** A copy of `g` moved by (x, y, z), with constant per-vertex attributes (to tell merged parts apart in a shader). */
function part(g: THREE.BufferGeometry, x: number, y: number, z: number, attrs: Record<string, number[]> = {}) {
  const c = g.clone().translate(x, y, z);
  const n = c.attributes.position.count;
  for (const [k, v] of Object.entries(attrs))
    c.setAttribute(
      k,
      new THREE.Float32BufferAttribute(
        new Float32Array(n * v.length).map((_, i) => v[i % v.length]),
        v.length,
      ),
    );
  return c;
}

function buildShared() {
  const shell = new RoundedBoxGeometry(W, H, D, 3, 0.07);
  shell.translate(0, H / 2, 0);
  // blank files are only ever seen from afar: 300 triangles instead of 588
  const fillerShell = new RoundedBoxGeometry(W, H, D, 2, 0.07);
  fillerShell.translate(0, H / 2, 0);
  const plate = new RoundedBoxGeometry(W - 0.34, H - 0.34, 0.05, 2, 0.03);
  plate.translate(0, H / 2, -D / 2 + 0.07);
  // arcs end where the shader discards, so the segment counts only shape the silhouette (< 0.1 px off at detail size)
  const screw = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20).rotateX(Math.PI / 2);
  // both ring tracks and both screws in one draw call; aPart 0 = ceramic, 1 = metal (see fixtureMaterial)
  const fixtures = mergeGeometries([
    part(new THREE.TorusGeometry(BIG.r, BIG.tube, 12, 96), BIG.x, BIG.y, -0.02, { aPart: [0] }),
    part(new THREE.TorusGeometry(SMALL.r, SMALL.tube, 10, 64), SMALL.x, SMALL.y, -0.02, { aPart: [0] }),
    part(screw, W / 2 - 0.22, H - 0.22, D / 2 - 0.01, { aPart: [1] }),
    part(screw, -W / 2 + 0.22, 0.22, D / 2 - 0.01, { aPart: [1] }),
  ])!;
  // both copper arcs in one draw call; aArc = (ring centre, 0 big / 1 small) (see arcPairMaterial)
  const arcs = mergeGeometries([
    part(new THREE.TorusGeometry(BIG.r, BIG.tube * 1.18, 12, 128), BIG.x, BIG.y, -0.02, { aArc: [BIG.x, BIG.y, 0] }),
    part(new THREE.TorusGeometry(SMALL.r, SMALL.tube * 1.2, 10, 80), SMALL.x, SMALL.y, -0.02, {
      aArc: [SMALL.x, SMALL.y, 1],
    }),
  ])!;
  const band = new THREE.RingGeometry(BIG.r + 0.18, BIG.r + 0.28, 128, 1);
  const tick = new THREE.BoxGeometry(0.035, 0.22, 0.03);
  const block = new THREE.BoxGeometry(0.28, 0.07, 0.2);
  // label and photo: two planes reading their halves of the sheet canvas (texture v runs bottom-up)
  const label = part(new THREE.PlaneGeometry(1.0, 0.46), -1.3, 3.27, -0.04);
  const photo = part(new THREE.PlaneGeometry(PHOTO.w, PHOTO.h), PHOTO.x, PHOTO.y, -0.04);
  const remap = (g: THREE.BufferGeometry, f: (u: number, v: number) => [number, number]) => {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ...f(uv.getX(i), uv.getY(i)));
    return g;
  };
  const sheet = mergeGeometries([
    remap(label, (u, v) => [(u * SHEET.label.w) / SHEET.w, 1 - ((1 - v) * SHEET.label.h) / SHEET.h]),
    remap(photo, (u, v) => [(SHEET.photo.x + u * SHEET.photo.w) / SHEET.w, v]),
  ])!;
  const name = new THREE.PlaneGeometry(NAME.w, NAME.h);
  const scan = new THREE.PlaneGeometry(1, 0.012);
  return {
    shell,
    fillerShell,
    plate,
    fixtures,
    arcs,
    band,
    tick,
    block,
    sheet,
    name,
    scan,
  };
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

// Both copper arcs (big: estimate, small: P(above typical)) as one mesh; each runs from 12 o'clock to its own value.
type ArcPairUniforms = {
  uToBig: { value: number };
  uToSmall: { value: number };
};

function arcPairMaterial(p: Palette): THREE.MeshPhysicalMaterial & { userData: { arc: ArcPairUniforms } } {
  const m = new THREE.MeshPhysicalMaterial({
    color: p.copper,
    metalness: 0.5,
    roughness: 0.3,
    clearcoat: 0.4,
  });
  const arc: ArcPairUniforms = { uToBig: { value: 0 }, uToSmall: { value: 0 } };
  m.userData.arc = arc;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uToBig = arc.uToBig;
    shader.uniforms.uToSmall = arc.uToSmall;
    shader.vertexShader =
      "attribute vec3 aArc;\nvarying vec2 vArcPos;\nvarying float vArcId;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvArcPos = position.xy - aArc.xy;\nvArcId = aArc.z;",
      );
    shader.fragmentShader =
      "varying vec2 vArcPos;\nvarying float vArcId;\nuniform float uToBig;\nuniform float uToSmall;\n" +
      shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float turn = atan(vArcPos.x, vArcPos.y) / 6.2831853;
        turn = turn < 0.0 ? turn + 1.0 : turn;
        if (turn > (vArcId < 0.5 ? uToBig : uToSmall)) discard;`,
      );
  };
  m.customProgramCacheKey = () => "arcPair";
  return m as THREE.MeshPhysicalMaterial & {
    userData: { arc: ArcPairUniforms };
  };
}

// Ring tracks (ceramic) and screws (metal) in one mesh: per-vertex aPart picks colour, roughness and metalness.
function fixtureMaterial(p: Palette) {
  const glsl = (c: string) => {
    const k = new THREE.Color(c); // linear, as the shader works
    return `vec3(${k.r.toFixed(5)}, ${k.g.toFixed(5)}, ${k.b.toFixed(5)})`;
  };
  const m = new THREE.MeshStandardMaterial();
  m.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute float aPart;\nvarying float vPart;\n" +
      shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPart = aPart;");
    shader.fragmentShader =
      "varying float vPart;\n" +
      shader.fragmentShader
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\ndiffuseColor.rgb = mix(${glsl(p.ceramic)}, ${glsl("#b9b4ac")}, vPart);`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.55, 0.3, vPart);",
        )
        .replace(
          "#include <metalnessmap_fragment>",
          "#include <metalnessmap_fragment>\nmetalnessFactor = mix(0.0, 0.85, vPart);",
        );
  };
  m.customProgramCacheKey = () => `fixtures-${p.ceramic}`;
  return m;
}

// Shell glass: roughness clears from the top down as uReveal goes 0 → 1 (the "decryption").
type GlassUniforms = { uReveal: { value: number }; uFrost: { value: number } };

function glassMaterial(
  p: Palette,
  glass: GlassUniforms = { uReveal: { value: 0 }, uFrost: { value: 0.6 } },
): THREE.MeshPhysicalMaterial & { userData: { glass: GlassUniforms } } {
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

function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number, d: CassetteData, p: Palette) {
  const font = fontFamily();
  ctx.fillStyle = p.label;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "top";
  ctx.fillStyle = p.labelMuted;
  ctx.font = `600 26px ${font}`;
  ctx.fillText("INSTRUCTOR FILE", 34, 34);
  ctx.fillStyle = p.labelInk;
  ctx.fillRect(w - 150, 32, 116, 24);
  ctx.fillStyle = p.label;
  ctx.font = `700 17px ${font}`;
  ctx.fillText(d.no ? "RANKED" : "NEW", w - 138, 36);
  ctx.fillStyle = p.labelMuted;
  ctx.font = `600 22px ${font}`;
  ctx.fillText(`${d.offerings} OFFERING${d.offerings === 1 ? "" : "S"}`, 34, 72);
  ctx.fillStyle = p.labelInk;
  ctx.font = `500 92px ${font}`;
  ctx.fillText(d.no ? `NO.${String(d.no).padStart(3, "0")}` : "NO.NEW", 30, 116);
  ctx.strokeStyle = p.labelInk;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(w - 92, 164, 20, 0, Math.PI * 2);
  ctx.moveTo(w - 52 + 20, 164);
  ctx.arc(w - 52, 164, 20, 0, Math.PI * 2);
  ctx.stroke();
}

/** Bottom name plate: large last name, smaller initials or given name, and the schedule status on the right. */
function drawName(canvas: HTMLCanvasElement, d: CassetteData, p: Palette) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const w = canvas.width;
  const h = canvas.height;
  const font = fontFamily();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = p.label;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.labelInk;
  ctx.fillRect(0, 0, w, 5);
  ctx.textBaseline = "alphabetic";

  // status block on the right
  const status = d.next
    ? `TEACHING ${d.quarter.toUpperCase()}`
    : d.last
      ? `LAST TAUGHT ${d.last.toUpperCase()}`
      : "NO GRADE HISTORY";
  ctx.font = `600 30px ${font}`;
  const sw = ctx.measureText(status).width;
  const sx = w - 34 - sw;
  ctx.fillStyle = d.next ? p.next : p.labelMuted;
  ctx.fillRect(sx - 34, h / 2 - 4, 20, 20);
  ctx.fillStyle = d.next ? p.labelInk : p.labelMuted;
  ctx.fillText(status, sx, h / 2 + 16);

  // name, shrunk to fit the space left of the status
  const room = sx - 70 - 34;
  const last = d.nameLast.toUpperCase();
  const rest = d.nameRest.toUpperCase();
  let size = 128;
  const measure = () => {
    ctx.font = `800 ${size}px ${font}`;
    const a = ctx.measureText(last).width;
    ctx.font = `300 ${Math.round(size * 0.46)}px ${font}`;
    return a + (rest ? 22 + ctx.measureText(rest).width : 0);
  };
  while (size > 40 && measure() > room) size -= 4;
  ctx.fillStyle = p.labelInk;
  ctx.font = `800 ${size}px ${font}`;
  const base = h / 2 + size * 0.36;
  ctx.fillText(last, 34, base);
  if (rest) {
    const lx = 34 + ctx.measureText(last).width + 22;
    ctx.font = `300 ${Math.round(size * 0.46)}px ${font}`;
    ctx.fillText(rest, lx, base);
  }
}

/** Photo frame: a warm monochrome print (the sources are low resolution), or initials when there is no verified photo. */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  d: CassetteData,
  p: Palette,
  img?: HTMLImageElement,
) {
  const font = fontFamily();
  ctx.fillStyle = p.label;
  ctx.fillRect(0, 0, w, h);
  const pad = 14;
  const iw = w - pad * 2;
  const ih = h - pad * 2 - 34;
  if (img) {
    const scale = Math.max(iw / img.width, ih / img.height);
    const sw = iw / scale;
    const sh = ih / scale;
    ctx.save();
    ctx.filter = "grayscale(1) sepia(0.35) contrast(1.06) brightness(1.03)";
    ctx.drawImage(img, (img.width - sw) / 2, Math.max(0, (img.height - sh) * 0.3), sw, sh, pad, pad, iw, ih);
    ctx.restore();
  } else {
    ctx.fillStyle = p.plate;
    ctx.fillRect(pad, pad, iw, ih);
    ctx.fillStyle = p.labelMuted;
    ctx.font = `300 ${Math.round(iw * 0.42)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = (d.nameRest.replace(/[^A-Za-z ]/g, "").split(" ")[0]?.[0] ?? "") + (d.nameLast[0] ?? "");
    ctx.fillText(initials.toUpperCase(), w / 2, pad + ih / 2);
    ctx.textAlign = "left";
  }
  ctx.strokeStyle = p.labelInk;
  ctx.lineWidth = 3;
  ctx.strokeRect(pad, pad, iw, ih);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.labelMuted;
  ctx.font = `600 17px ${font}`;
  ctx.fillText(img ? "ID / DEPT PAGE" : "ID / NO PHOTO", pad, h - 14);
}

/** The label and photo, side by side on one canvas. */
function drawSheet(canvas: HTMLCanvasElement, d: CassetteData, p: Palette, img?: HTMLImageElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = p.label;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const region = (x: number, w: number, h: number, draw: () => void) => {
    ctx.save();
    ctx.translate(x, 0);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    draw();
    ctx.restore();
  };
  region(0, SHEET.label.w, SHEET.label.h, () => drawLabel(ctx, SHEET.label.w, SHEET.label.h, d, p));
  region(SHEET.photo.x, SHEET.photo.w, SHEET.photo.h, () => drawPhoto(ctx, SHEET.photo.w, SHEET.photo.h, d, p, img));
}

// Materials that are the same on every file, one set per palette (they live as long as the page).
const common = new Map<Palette, ReturnType<typeof buildCommon>>();
function buildCommon(p: Palette) {
  return {
    plate: new THREE.MeshStandardMaterial({ color: p.plate, roughness: 0.7 }),
    fixtures: fixtureMaterial(p),
    ink: new THREE.MeshStandardMaterial({ color: p.ink, roughness: 0.5 }),
  };
}

type Interior = {
  arcs: ReturnType<typeof arcPairMaterial>;
  band: ReturnType<typeof arcMaterial>;
  tick: THREE.Mesh;
  scan: THREE.Mesh;
  name: THREE.MeshBasicMaterial;
  objects: THREE.Object3D[];
  canvases: { sheet: HTMLCanvasElement; name: HTMLCanvasElement };
  textures: THREE.CanvasTexture[]; // sheet, name
  materials: THREE.Material[];
};

export class Cassette {
  readonly group = new THREE.Group();
  readonly shell: THREE.Mesh;
  private glass: ReturnType<typeof glassMaterial>; // see-through, for files shown in full
  private liteGlass: ReturnType<typeof glassMaterial>; // opaque, for far lanes (no transmission pass)
  private blockMat: THREE.MeshStandardMaterial;
  private palette: Palette;
  private shadows: boolean;
  /** Everything inside the glass. Built on first use: side columns only ever show the shell and block. */
  private inner: Interior | null = null;
  private photoImg?: HTMLImageElement;
  private lite = true;
  private stage = 0; // preparation: 0 build, 1–2 upload each canvas, 3 compile, 4 ready
  data: CassetteData;
  /** shown values, sprung toward data so arcs sweep */
  private shown = { est: 0, lo: 0, hi: 0, p: 0, typical: 0 };
  frost: number; // roughness when fully revealed

  constructor(data: CassetteData, p: Palette, shadows: boolean) {
    shared ??= buildShared();
    const g = shared;
    this.data = data;
    this.palette = p;
    this.shadows = shadows;
    this.glass = glassMaterial(p);
    this.liteGlass = glassMaterial(p, this.glass.userData.glass);
    this.liteGlass.transmission = 0;
    this.shell = new THREE.Mesh(g.shell, this.liteGlass);
    this.shell.castShadow = shadows;
    this.shell.receiveShadow = shadows;
    this.shell.userData.cassette = this;
    this.blockMat = new THREE.MeshStandardMaterial({
      color: data.next ? p.next : p.past,
      roughness: 0.45,
    });
    const block = new THREE.Mesh(g.block, this.blockMat);
    block.position.set(-W / 2 + 0.55, H - 0.01, 0);
    this.group.add(this.shell, block);
    this.frost = frostFor(data);
    this.shown = {
      est: 0,
      lo: data.typical,
      hi: data.typical,
      p: 0,
      typical: data.typical,
    };
  }

  get prepared() {
    return this.stage >= 4;
  }

  /** After a lost WebGL context is restored: everything uploaded or compiled is gone, so prepare again. */
  unprepare() {
    this.stage = Math.min(this.stage, this.inner ? 1 : 0);
  }

  /** One slice (≈1–2 ms) of getting ready to be shown in full: build, upload a canvas, or compile. */
  prepareStep(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene) {
    if (this.stage === 0) this.build();
    else if (this.stage <= 2) renderer.initTexture(this.inner!.textures[this.stage - 1]);
    else if (this.stage === 3) {
      // the full look's materials, so the first frame that shows them does no setup
      const m = this.shell.material;
      this.shell.material = this.glass;
      renderer.compile(this.group, camera, scene);
      this.shell.material = m;
    }
    this.stage = Math.min(4, this.stage + 1);
  }

  /** Build the interior: plate, rings, plates with canvas text, photo. */
  build() {
    if (this.inner) return;
    const g = shared!;
    const p = this.palette;
    const data = this.data;
    const m = (common.get(p) ?? common.set(p, buildCommon(p)).get(p))!;

    const plate = new THREE.Mesh(g.plate, m.plate);
    plate.receiveShadow = this.shadows;
    const fixtures = new THREE.Mesh(g.fixtures, m.fixtures);
    const arcsMat = arcPairMaterial(p);
    const arcs = new THREE.Mesh(g.arcs, arcsMat);
    // opaque on purpose: transparent meshes are not visible through transmissive glass
    const bandMat = arcMaterial({
      color: new THREE.Color(p.plate).lerp(new THREE.Color(p.copper), 0.5),
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const band = new THREE.Mesh(g.band, bandMat);
    band.position.set(BIG.x, BIG.y, -0.04);
    const tick = new THREE.Mesh(g.tick, m.ink);
    tick.position.z = 0.01;

    // CPU-backed canvases (willReadFrequently, set where they are drawn): uploading a GPU canvas to WebGL forces a
    // synchronous readback, 1–30 ms each; from CPU memory it is a plain copy
    const canvas = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
    const canvases = {
      sheet: canvas(SHEET.w, SHEET.h),
      name: canvas(1376, 200),
    };
    drawSheet(canvases.sheet, data, p);
    drawName(canvases.name, data, p);
    const textures = [canvases.sheet, canvases.name].map((c) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    const [sheetMat, nameMat] = textures.map((map) => new THREE.MeshBasicMaterial({ map, toneMapped: false }));
    nameMat.transparent = true; // outside the glass: fades with it
    const sheet = new THREE.Mesh(g.sheet, sheetMat);
    const name = new THREE.Mesh(g.name, nameMat);
    // printed on the outside of the glass, so the name stays sharp however frosted the file is
    name.position.set(NAME.x, NAME.y, D / 2 + 0.004);

    const scanMat = new THREE.MeshBasicMaterial({
      color: p.ink,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const scan = new THREE.Mesh(g.scan, scanMat);
    scan.position.set(0, H / 2, D / 2 + 0.012);
    scan.rotation.z = Math.atan2(H * 0.74, W * 0.9);
    scan.renderOrder = 2;
    scan.visible = false;

    const objects = [plate, fixtures, arcs, band, tick, sheet, name];
    for (const o of objects) o.visible = !this.lite;
    for (const o of [...objects, scan]) o.layers.set(INTERIOR);
    this.group.add(...objects, scan);
    this.inner = {
      arcs: arcsMat,
      band: bandMat,
      tick,
      scan,
      name: nameMat,
      objects,
      canvases,
      textures,
      materials: [arcsMat, bandMat, sheetMat, nameMat, scanMat],
    };
    this.applyShown();
    this.loadPhoto();
    // canvas text needs the web font; redraw once it is ready
    if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => this.redraw());
  }

  private redraw() {
    const i = this.inner;
    if (!i) return;
    drawSheet(i.canvases.sheet, this.data, this.palette, this.photoImg);
    drawName(i.canvases.name, this.data, this.palette);
    for (const t of i.textures) t.needsUpdate = true;
  }

  private loadPhoto() {
    const url = this.data.photo;
    if (!url) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const i = this.inner;
      if (this.data.photo !== url || !i) return;
      this.photoImg = img;
      drawSheet(i.canvases.sheet, this.data, this.palette, img);
      i.textures[0].needsUpdate = true;
    };
    img.src = url;
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
    const i = this.inner;
    if (!i) return;
    const s = this.shown;
    i.arcs.userData.arc.uToBig.value = s.est;
    i.arcs.userData.arc.uToSmall.value = s.p;
    i.band.userData.arc.uFrom.value = s.lo;
    i.band.userData.arc.uTo.value = s.hi;
    const a = s.typical * Math.PI * 2;
    const r = BIG.r + 0.23;
    i.tick.position.set(BIG.x + Math.sin(a) * r, BIG.y + Math.cos(a) * r, 0.01);
    i.tick.rotation.z = -a;
  }

  /** 0 = lite: an opaque shell and the status block (two draw calls instead of nine); up to 1 = the glass clears
   * and the interior shows. Builds the interior if it was not prepared. */
  setFullness(v: number) {
    const lite = v < 0.002;
    if (lite !== this.lite) {
      if (!lite) this.build();
      this.lite = lite;
      for (const o of this.inner?.objects ?? []) o.visible = !lite;
      this.shell.material = lite ? this.liteGlass : this.glass;
    }
    if (lite) return;
    this.glass.transmission = 0.9 * v;
    this.inner!.name.opacity = v;
  }

  /** reveal: 0 = frosted (in the drawer), 1 = decrypted (clear to this file's certainty). */
  setReveal(reveal: number, frosted = 0.62) {
    this.glass.userData.glass.uReveal.value = reveal;
    this.glass.userData.glass.uFrost.value = frosted;
    this.glass.roughness = this.frost;
    this.liteGlass.roughness = this.frost;
  }

  /** Diagonal scan line across the face: length 0..1, opacity 0..1. */
  setScan(length: number, opacity: number) {
    const scan = this.inner?.scan;
    if (!scan) return;
    (scan.material as THREE.MeshBasicMaterial).opacity = opacity;
    scan.visible = opacity > 0.001 && length > 0.001;
    scan.scale.set(Math.max(0.001, length) * Math.hypot(W * 0.9, H * 0.74), 1, 1);
  }

  dispose() {
    this.glass.dispose();
    this.liteGlass.dispose();
    this.blockMat.dispose();
    this.inner?.materials.forEach((m) => m.dispose());
    this.inner?.textures.forEach((t) => t.dispose());
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
  const mesh = new THREE.InstancedMesh(shared.fillerShell, mat, count);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
}
