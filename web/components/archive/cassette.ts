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

export const W = 4.0; // width (x)
export const H = 3.7; // height (y); origin at the bottom centre
export const D = 0.42; // thickness (z); the face looks down +z

const BIG = { x: -0.5, y: 1.9, r: 0.9, tube: 0.095 };
const SMALL = { x: 1.3, y: 1.3, r: 0.36, tube: 0.08 };
const PHOTO = { x: 1.3, y: 2.64, w: 0.62, h: 0.76 };
const NAME = { x: 0, y: 0.42, w: 3.44, h: 0.5 };

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
function buildShared() {
  const shell = new RoundedBoxGeometry(W, H, D, 3, 0.07);
  shell.translate(0, H / 2, 0);
  const plate = new RoundedBoxGeometry(W - 0.34, H - 0.34, 0.05, 2, 0.03);
  plate.translate(0, H / 2, -D / 2 + 0.07);
  const bigTrack = new THREE.TorusGeometry(BIG.r, BIG.tube, 20, 160);
  const bigArc = new THREE.TorusGeometry(BIG.r, BIG.tube * 1.18, 20, 200);
  const band = new THREE.RingGeometry(BIG.r + 0.18, BIG.r + 0.28, 200, 1);
  const smallTrack = new THREE.TorusGeometry(SMALL.r, SMALL.tube, 16, 96);
  const smallArc = new THREE.TorusGeometry(SMALL.r, SMALL.tube * 1.2, 16, 120);
  const tick = new THREE.BoxGeometry(0.035, 0.22, 0.03);
  const screw = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20);
  screw.rotateX(Math.PI / 2);
  const block = new THREE.BoxGeometry(0.28, 0.07, 0.2);
  const label = new THREE.PlaneGeometry(1.0, 0.46);
  const photo = new THREE.PlaneGeometry(PHOTO.w, PHOTO.h);
  const name = new THREE.PlaneGeometry(NAME.w, NAME.h);
  const scan = new THREE.PlaneGeometry(1, 0.012);
  // engraved guide lines on the plate, like a circuit trace
  const pts: THREE.Vector3[] = [];
  const z = -D / 2 + 0.1;
  const seg = (a: [number, number], b: [number, number]) =>
    pts.push(new THREE.Vector3(a[0], a[1], z), new THREE.Vector3(b[0], b[1], z));
  seg([-1.75, 0.74], [0.9, 0.74]);
  seg([0.9, 0.74], [1.02, 0.86]);
  seg([1.75, 0.78], [1.75, 1.9]);
  seg([0.92, 1.3], [0.82, 1.3]);
  seg([-0.7, 3.42], [0.86, 3.42]);
  seg([0.86, 3.42], [0.98, 3.3]);
  for (let i = 0; i < 6; i++) seg([1.08 + i * 0.09, 0.78], [1.16 + i * 0.09, 0.9]);
  const lines = new THREE.BufferGeometry().setFromPoints(pts);
  return {
    shell,
    plate,
    bigTrack,
    bigArc,
    band,
    smallTrack,
    smallArc,
    tick,
    screw,
    block,
    label,
    photo,
    name,
    scan,
    lines,
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
  const ctx = canvas.getContext("2d")!;
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
function drawPhoto(canvas: HTMLCanvasElement, d: CassetteData, p: Palette, img?: HTMLImageElement) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
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
  private nameCanvas: HTMLCanvasElement;
  private nameTex: THREE.CanvasTexture;
  private photoCanvas: HTMLCanvasElement;
  private photoTex: THREE.CanvasTexture;
  private photoImg?: HTMLImageElement;
  private blockMat: THREE.MeshStandardMaterial;
  private palette: Palette;
  private interior: THREE.Object3D[] = [];
  private lite = false;
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
    this.palette = p;
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
    this.blockMat = new THREE.MeshStandardMaterial({ color: data.next ? p.next : p.past, roughness: 0.45 });
    const block = new THREE.Mesh(g.block, this.blockMat);
    block.position.set(-W / 2 + 0.55, H - 0.01, 0);

    this.canvas = document.createElement("canvas");
    this.canvas.width = 512;
    this.canvas.height = 240;
    drawLabel(this.canvas, data, p);
    this.labelTex = new THREE.CanvasTexture(this.canvas);
    this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.labelTex.anisotropy = 4;
    const labelMat = new THREE.MeshBasicMaterial({ map: this.labelTex, toneMapped: false });
    const label = new THREE.Mesh(g.label, labelMat);
    label.position.set(-1.3, 3.27, -0.04);

    const tex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    this.nameCanvas = document.createElement("canvas");
    this.nameCanvas.width = 1376;
    this.nameCanvas.height = 200;
    drawName(this.nameCanvas, data, p);
    this.nameTex = tex(this.nameCanvas);
    const nameMat = new THREE.MeshBasicMaterial({ map: this.nameTex, toneMapped: false });
    const name = new THREE.Mesh(g.name, nameMat);
    // printed on the outside of the glass, so the name stays sharp however frosted the file is
    name.position.set(NAME.x, NAME.y, D / 2 + 0.004);

    this.photoCanvas = document.createElement("canvas");
    this.photoCanvas.width = 248;
    this.photoCanvas.height = 304;
    drawPhoto(this.photoCanvas, data, p);
    this.photoTex = tex(this.photoCanvas);
    const photoMat = new THREE.MeshBasicMaterial({ map: this.photoTex, toneMapped: false });
    const photo = new THREE.Mesh(g.photo, photoMat);
    photo.position.set(PHOTO.x, PHOTO.y, -0.04);
    this.loadPhoto();
    // canvas text needs the web font; redraw once it is ready
    document.fonts?.ready.then(() => this.redraw());

    const lineMat = new THREE.LineBasicMaterial({ color: p.ceramic, transparent: true, opacity: 0.8 });
    const lines = new THREE.LineSegments(g.lines, lineMat);

    this.scan = new THREE.Mesh(
      g.scan,
      new THREE.MeshBasicMaterial({ color: p.ink, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.scan.position.set(0, H / 2, D / 2 + 0.012);
    this.scan.rotation.z = Math.atan2(H * 0.74, W * 0.9);
    this.scan.renderOrder = 2;

    this.interior = [
      plate,
      bigTrack,
      bigArc,
      band,
      this.tick,
      smallTrack,
      smallArc,
      ...screws,
      label,
      name,
      photo,
      lines,
    ];
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
      name,
      photo,
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
      this.blockMat,
      labelMat,
      nameMat,
      photoMat,
      lineMat,
      this.scan.material as THREE.Material,
    ];
    this.frost = frostFor(data);
    this.shown = { est: 0, lo: data.typical, hi: data.typical, p: 0, typical: data.typical };
    this.applyShown();
  }

  update(data: CassetteData, p: Palette) {
    const photoChanged = data.photo !== this.data.photo;
    this.data = data;
    this.palette = p;
    this.frost = frostFor(data);
    this.blockMat.color.set(data.next ? p.next : p.past);
    if (photoChanged) {
      this.photoImg = undefined;
      this.loadPhoto();
    }
    this.redraw();
  }

  private redraw() {
    drawLabel(this.canvas, this.data, this.palette);
    drawName(this.nameCanvas, this.data, this.palette);
    drawPhoto(this.photoCanvas, this.data, this.palette, this.photoImg);
    this.labelTex.needsUpdate = true;
    this.nameTex.needsUpdate = true;
    this.photoTex.needsUpdate = true;
  }

  private loadPhoto() {
    const url = this.data.photo;
    if (!url) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (this.data.photo !== url) return;
      this.photoImg = img;
      drawPhoto(this.photoCanvas, this.data, this.palette, img);
      this.photoTex.needsUpdate = true;
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
    const s = this.shown;
    this.bigArc.userData.arc.uFrom.value = 0;
    this.bigArc.userData.arc.uTo.value = s.est;
    this.band.userData.arc.uFrom.value = s.lo;
    this.band.userData.arc.uTo.value = s.hi;
    this.smallArc.userData.arc.uFrom.value = 0;
    this.smallArc.userData.arc.uTo.value = s.p;
    const a = s.typical * Math.PI * 2;
    const r = BIG.r + 0.23;
    this.tick.position.set(BIG.x + Math.sin(a) * r, BIG.y + Math.cos(a) * r, 0.01);
    this.tick.rotation.z = -a;
  }

  /** reveal: 0 = frosted (in the drawer), 1 = decrypted (clear to this file's certainty). */
  /** Side columns: only the frosted shell and the status block (two draw calls instead of sixteen). */
  setLite(lite: boolean) {
    if (lite === this.lite) return;
    this.lite = lite;
    for (const o of this.interior) o.visible = !lite;
    this.glass.transmission = lite ? 0 : 0.9;
    this.glass.needsUpdate = true;
  }

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
    this.nameTex.dispose();
    this.photoTex.dispose();
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
