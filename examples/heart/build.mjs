import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { BEAT, EDV, ESV, PHASES, heartAt } from "./model.mjs";
import { makeLive } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 440;

// Bench
const BASE = { x: -124, y: -62, w: 248, d: 124, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

// Valve deck on four posts: the heart's fibrous skeleton, which carries all four valves.
const DECK = { x: -102, y: -42, w: 204, d: 84, r: 6 };
const DECK_Z = 98;
const DECK_H = 6;
const DECK_TOP = DECK_Z + DECK_H;
const POSTS = [[-94, -34], [94, -34], [-94, 34], [94, 34]];

// Ventricles: bellows hanging under the deck. Bellows height is chamber volume.
const RV_X = -58;
const LV_X = 58;
const FLANGE_H = 3;
const MM_PER_ML = 0.36;
const D = {
  HANG: DECK_Z - FLANGE_H,
  V_R: 28,
  PLEATS: 6,
  APEX_H: 4,
  GLAND_TOP: 14,
  ROD_R: 2.4,
  A_R: 13,
  A_PLEATS: 4,
  CAGE_TOP: DECK_TOP + 16,
  DIAL_FROM: -0.75 * Math.PI,
  DIAL_SPAN: 1.5 * Math.PI,
};
const lengthOf = (ml) => ml * MM_PER_ML;

// Valves: check-valve cages on the deck. A poppet disc in each cage.
const RING_H = 2.5;
const POPPET_H = 2.2;
const VALVES = {
  tricuspid: { at: [-46, -18], r: 11, av: true },
  pulmonary: { at: [-70, 18], r: 9, av: false },
  mitral: { at: [70, -18], r: 11, av: true },
  aortic: { at: [46, 18], r: 9, av: false },
};
// Semilunar poppets lift off the lower seat; AV poppets drop away from the upper seat.
const poppetZ = (valve, open) =>
  valve.av ? D.CAGE_TOP - RING_H - POPPET_H - open * 6.8 : DECK_TOP + RING_H + open * 6.6;

// Outflow columns with gauges on top.
const OUTLETS = {
  pulmonary: { valve: "pulmonary", top: 130, dial: 13, full: 50 },
  aortic: { valve: "aortic", top: 138, dial: 15, full: 200 },
};
const COLUMN_R = 5.6;
const NECK_H = 4;
const PUCK_H = 7;
const dialTop = (outlet) => outlet.top + 2 + NECK_H + PUCK_H;

// Atrium stack above each AV cage: bellows, cap, inlet pipe, funnel. Built at zero length and lifted.
const A_MIN = 16;
const A_SPAN = 8;
const CAP_H = 3;

const tallest = D.CAGE_TOP + A_MIN + A_SPAN + CAP_H + 14 + 3 + 6;
const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -PLATE_H - FOOT_H, 0),
    ...[VALVES.tricuspid, VALVES.mitral].map((v) => [v.at[0], v.at[1], tallest]),
    ...Object.values(OUTLETS).map((o) => [VALVES[o.valve].at[0], VALVES[o.valve].at[1], dialTop(o)]),
  ],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: 58 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y]) => k.depthOf([x, y, 0], P);
const byDepth = (points) => [...points].sort((a, b) => depth(a) - depth(b));
const facingSplit = (cx, cy, angles) => {
  const [vx, vy] = k.towardViewer(P);
  const back = [];
  const front = [];
  for (const angle of angles) (Math.cos(angle) * vx + Math.sin(angle) * vy > 0 ? front : back).push(angle);
  return { back, front };
};
const live = makeLive(k, P, D);

// ---------------------------------------------------------------- base
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -PLATE_H * 0.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ruler strip along the front: 1 unit per 1/0.36 mL of ventricular volume.
  const strip = { x: -104, y: BASE.y + BASE.d - 14, w: 208, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

function post([x, y]) {
  const out = [];
  out.push(S(k.cylinder(x, y, 6, 0, 3, P, 28), { tone: "mid" }));
  out.push(Dots([at([x, y, 3])], { size: 0.45, tone: "lo" }));
  out.push(S(k.cylinder(x, y, 3.6, 3, DECK_Z - 6, P, 24), { tone: "mid", crease: "none" }));
  out.push(L([28, 56].map((z) => k.sideArc(x, y, 3.6, z, P, 14)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 5.4, DECK_Z - 3, 3, P, 28), { tone: "mid" }));
  return out.join("");
}

// The gland block that guides a ventricle's pushrod, with its drive shaft port.
function gland(cx) {
  const out = [];
  const block = { x: cx - 10, y: -10, w: 20, d: 20, r: 2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(block, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(block, 0, 10, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(block, 4, P, 4), { tone: "faint" }) }));
  const screws = k.corners(block, 3);
  out.push(Dots(screws.map(([x, y]) => at([x, y, 10])), { size: 0.45, tone: "lo" }));
  out.push(S(k.cylinder(cx, 0, 5.2, 10, D.GLAND_TOP - 10, P, 32), { tone: "mid" }));
  out.push(L(k.ring(cx, 0, D.ROD_R + 0.5, D.GLAND_TOP, P, 20), { tone: "faint" }));
  return out.join("");
}

// The pacemaker: a drive box that times both ventricles from one cam shaft (the SA node's job).
function pacer() {
  const out = [];
  const box = { x: -18, y: -14, w: 36, d: 28, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(box, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(box, 0, 16, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(box, 5, P, 5), { tone: "faint" }) }));
  const lid = k.insetPlan(box, 2.4);
  out.push(L(k.planOutline(lid, 16, P, 4), { tone: "faint" }));
  out.push(Dots(k.corners(box, 4.6).map(([x, y]) => at([x, y, 16])), { size: 0.45 }));
  out.push(Dots(k.dotGrid(-10, -8, 5, 4, 3, 16, P), { size: 0.4, tone: "lo" }));
  // Rate knob
  const knob = [8, 4];
  out.push(S(k.cylinder(knob[0], knob[1], 5, 16, 4, P, 32), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 5, 16, 20, 30, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([knob[0], knob[1]], [knob[0] + 3.4, knob[1] - 3.4], 20, P), { tone: "hi" }));
  out.push(Dots([at([knob[0], knob[1], 20])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// A drive shaft from the pacer to a gland block, on two bearing blocks.
function shaft(from, to) {
  const out = [];
  const x0 = Math.min(from, to);
  const x1 = Math.max(from, to);
  out.push(S(k.slabOf({ x: x0, y: -1.8, w: x1 - x0, d: 3.6, r: 1.6 }, 4.2, 3.6, P, 4, 0.3), { tone: "mid", crease: "none" }));
  const mid = (x0 + x1) / 2;
  out.push(S(k.slabOf({ x: mid - 3, y: -4.5, w: 6, d: 9, r: 1 }, 0, 9, P, 3, 0.4), { tone: "mid" }));
  out.push(Dots([at([mid, -2.5, 9]), at([mid, 2.5, 9])], { size: 0.4, tone: "lo" }));
  return out.join("");
}

// The static flange the bellows hangs from, under the deck.
function ventricleFlange(cx) {
  const out = [];
  out.push(S(k.cylinder(cx, 0, D.V_R + 2.5, D.HANG, FLANGE_H, P, 72, 0.5), { tone: "mid" }));
  const bolts = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  const { front } = facingSplit(cx, 0, bolts);
  out.push(Dots(front.map((a) => at([cx + Math.cos(a) * (D.V_R + 2.5), 0 + Math.sin(a) * (D.V_R + 2.5), D.HANG + FLANGE_H * 0.5])), { size: 0.45, tone: "lo" }));
  return out.join("");
}

// A volume scale beside the left ventricle: a strip from base to deck, read
// by a pointer arm on the apex plate. One tick per 10 mL, a long one per 50.
const SCALE = { x: LV_X + D.V_R + 3.5, y: 1, w: 3, d: 12, r: 0.5 };
const ARM = { x: LV_X + D.V_R + 1, y: -3.4, w: SCALE.x + SCALE.w + 3 - LV_X - D.V_R - 1, d: 4, r: 0.6 };
const ARM_H = 2.4;
const apexAt = (ml) => D.HANG - lengthOf(ml) - D.APEX_H;
const markAt = (ml) => apexAt(ml) + ARM_H / 2;
function volumeScale() {
  const out = [];
  const face = SCALE.x + SCALE.w;
  const arm = S(k.slabOf(ARM, 0, ARM_H, P, 3, 0.3), { tone: "hi", crease: "lo" });
  out.push(`<g data-part="lv-arm" transform="${k.translateAlong(P, [0, 0, apexAt(EDV - 10)])}">${arm}</g>`);
  out.push(S(k.slabOf(SCALE, 0, DECK_Z, P, 3, 0.3), { tone: "lo" }));
  const minor = [];
  const major = [];
  for (let ml = 40; ml <= 130; ml += 10) {
    const z = markAt(ml);
    (ml % 50 === 0 ? major : minor).push(k.segment([face, SCALE.y, z], [face, SCALE.y + (ml % 50 === 0 ? 6 : 3.6), z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(Dots([at([face, SCALE.y + SCALE.d - 2.5, 4]), at([face, SCALE.y + SCALE.d - 2.5, DECK_Z - 4])], { size: 0.45, tone: "mid" }));
  return out.join("");
}

function ventricle(name, cx, lit) {
  const length = lengthOf(EDV - 10);
  return [
    gland(cx),
    `<g data-part="${name}-rod">${live.pushrod(cx, length, lit)}</g>`,
    `<g data-part="${name}-bellows">${live.ventricle(cx, length)}</g>`,
    ventricleFlange(cx),
  ].join("");
}

function deck() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(DECK, 4), DECK_Z - 1, 0.1, P)}" style="filter:blur(5px);opacity:.6"/>`];
  out.push(S(k.slabOf(DECK, DECK_Z, DECK_H, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(DECK, DECK_Z + DECK_H * 0.5, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(DECK, 4), DECK_TOP, P), { tone: "faint" }));
  const screws = POSTS;
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, DECK_TOP, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, DECK_TOP])), { size: 0.5 }));
  // Label plate
  const plate = { x: 66, y: 24, w: 24, d: 12, r: 1 };
  out.push(S(k.slabOf(plate, DECK_TOP, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.6), DECK_TOP + 0.8, P, 4), { tone: "faint" }));
  const z = DECK_TOP + 0.8;
  out.push(L(k.lineOnTop([plate.x + 4, plate.y + 4], [plate.x + 18, plate.y + 4], z, P) + k.lineOnTop([plate.x + 4, plate.y + 6.2], [plate.x + 14, plate.y + 6.2], z, P) + k.lineOnTop([plate.x + 4, plate.y + 8.4], [plate.x + 16, plate.y + 8.4], z, P), { tone: "lo", free: true }));
  // Bolt circles round each valve seat
  for (const valve of Object.values(VALVES)) {
    const [cx, cy] = valve.at;
    const bolts = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + Math.PI / 8);
    out.push(L(k.ring(cx, cy, valve.r + 4.4, DECK_TOP, P, 48), { tone: "faint" }));
    out.push(Dots(bolts.map((a) => at([cx + Math.cos(a) * (valve.r + 4.4), cy + Math.sin(a) * (valve.r + 4.4), DECK_TOP])), { size: 0.42, tone: "mid" }));
  }
  return out.join("");
}

// The interventricular septum: a wall between the two pumps.
function septum() {
  const wall = { x: -2.5, y: -34, w: 5, d: 68, r: 1 };
  const top = DECK_TOP + 22;
  const out = [];
  out.push(S(k.slabOf(wall, DECK_TOP, top - DECK_TOP, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -6, y: -36, w: 12, d: 6, r: 1.2 }, DECK_TOP, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -6, y: 30, w: 12, d: 6, r: 1.2 }, DECK_TOP, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(Dots([at([-3.8, -33, DECK_TOP + 4]), at([3.8, -33, DECK_TOP + 4]), at([-3.8, 33, DECK_TOP + 4]), at([3.8, 33, DECK_TOP + 4])], { size: 0.4, tone: "lo" }));
  out.push(L(k.lineOnTop([0, -34], [0, 34], top, P), { tone: "faint" }));
  return out.join("");
}

// A valve cage: lower seat ring, four posts, poppet, upper seat ring.
function cage(name, valve) {
  const [cx, cy] = valve.at;
  const R = valve.r;
  const out = [];
  out.push(S(k.cylinder(cx, cy, R + 2, DECK_TOP, RING_H, P, 56, 0.4), { tone: "mid" }));
  out.push(L(k.ring(cx, cy, R - 0.6, DECK_TOP + RING_H, P, 48), { tone: "lo" }));
  const angles = [0.25, 0.75, 1.25, 1.75].map((q) => q * Math.PI);
  const { back, front } = facingSplit(cx, cy, angles);
  const postAt = (a) => S(k.cylinder(cx + Math.cos(a) * (R + 0.6), cy + Math.sin(a) * (R + 0.6), 1.1, DECK_TOP + RING_H, D.CAGE_TOP - RING_H * 2 - DECK_TOP, P, 14), { tone: "mid", crease: "none" });
  out.push(back.map(postAt).join(""));
  const closed = poppetZ(valve, 0);
  const poppet = [];
  if (valve.av) {
    poppet.push(S(k.cylinder(cx, cy, 1.6, closed - 2.2, 2.2, P, 16), { tone: "hi", crease: "none" }));
    poppet.push(S(k.cylinder(cx, cy, R - 1, closed, POPPET_H, P, 48, 0.5), { tone: "hi", crease: "lo" }));
  } else {
    poppet.push(S(k.cylinder(cx, cy, R - 1, closed, POPPET_H, P, 48, 0.5), { tone: "hi", crease: "lo" }));
    poppet.push(S(k.cylinder(cx, cy, 1.6, closed + POPPET_H, 2, P, 16), { tone: "hi", crease: "none" }));
  }
  out.push(`<g data-part="${name}-poppet">${poppet.join("")}</g>`);
  out.push(front.map(postAt).join(""));
  out.push(S(k.cylinder(cx, cy, R + 2, D.CAGE_TOP - RING_H, RING_H, P, 56, 0.4), { tone: "mid" }));
  return out.join("");
}

// Atrium: bellows on the AV cage, then a cap, an inlet pipe and a funnel (the veins' return).
function atriumStack(name, valve) {
  const [cx, cy] = valve.at;
  const out = [`<g data-part="${name}-atrium">${live.atrium(cx, cy, A_MIN + A_SPAN * 0.5)}</g>`];
  const z0 = D.CAGE_TOP;
  const top = [];
  top.push(S(k.cylinder(cx, cy, D.A_R + 1, z0, CAP_H, P, 56, 0.5), { tone: "mid" }));
  const bolts = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
  top.push(Dots(bolts.map((a) => at([cx + Math.cos(a) * (D.A_R - 1.4), cy + Math.sin(a) * (D.A_R - 1.4), z0 + CAP_H])), { size: 0.4, tone: "lo" }));
  top.push(S(k.cylinder(cx, cy, 6.4, z0 + CAP_H, 2, P, 32), { tone: "mid" }));
  top.push(S(k.cylinder(cx, cy, 4.2, z0 + CAP_H + 2, 12, P, 28), { tone: "mid", crease: "none" }));
  top.push(L(k.sideArc(cx, cy, 4.2, z0 + CAP_H + 8, P, 14), { tone: "faint" }));
  const cup = z0 + CAP_H + 14;
  top.push(S(k.cylinder(cx, cy, 6, cup, 3, P, 32), { tone: "mid" }));
  top.push(S(k.cylinder(cx, cy, 9.5, cup + 3, 6, P, 48, 0.6), { tone: "mid" }));
  top.push(L(k.ring(cx, cy, 8.2, cup + 9, P, 40), { tone: "lo" }));
  top.push(L(k.ring(cx, cy, 4.2, cup + 9, P, 28), { tone: "faint" }));
  top.push(L(k.sideArc(cx, cy, 9.5, cup + 5, P, 24), { tone: "faint" }));
  out.push(`<g data-part="${name}-cap" transform="${k.translateAlong(P, [0, 0, A_MIN + A_SPAN * 0.5])}">${top.join("")}</g>`);
  return out.join("");
}

// Outflow column with a band, a top flange and a face-up pressure gauge.
function outletStack(name, outlet) {
  const valve = VALVES[outlet.valve];
  const [cx, cy] = valve.at;
  const out = [];
  out.push(S(k.cylinder(cx, cy, COLUMN_R + 1.8, D.CAGE_TOP, 2, P, 32), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, COLUMN_R, D.CAGE_TOP + 2, outlet.top - D.CAGE_TOP - 2, P, 32), { tone: "hi", crease: "none" }));
  const band = D.CAGE_TOP + (outlet.top - D.CAGE_TOP) * 0.45;
  out.push(S(k.cylinder(cx, cy, COLUMN_R + 1, band, 3, P, 32), { tone: "mid" }));
  out.push(L(k.sideArc(cx, cy, COLUMN_R, D.CAGE_TOP + 9, P, 16), { tone: "faint" }));
  out.push(S(k.cylinder(cx, cy, COLUMN_R + 2, outlet.top, 2, P, 32), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, 4, outlet.top + 2, NECK_H, P, 24), { tone: "mid" }));
  const R = outlet.dial;
  const z = outlet.top + 2 + NECK_H;
  const top = z + PUCK_H;
  out.push(S(k.cylinder(cx, cy, R, z, PUCK_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, R, top - 3, top, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(cx, cy, R, top - 3, P, 40), { tone: "faint" }));
  out.push(L(k.ring(cx, cy, R - 2, top, P, 64), { tone: "lo" }));
  const per = outlet.full / 10;
  const ticks = k.radialTicks(cx, cy, R - 2.2, per, 5, top, [1.2, 2.6], P, D.DIAL_FROM, D.DIAL_SPAN);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  if (name === "aortic") out.push(k.faceTextSvg(k.topMatrix([cx + 6.5, cy], top, P, "y"), "mmHg", { size: 2.2, tone: "lo", anchor: "middle" }));
  out.push(L(k.ring(cx, cy, 1.4, top, P, 16), { tone: "mid" }));
  const lit = name === "aortic";
  const first = heartAt(0.25);
  const reading = name === "aortic" ? first.aorta : first.pulmonary;
  out.push(`<path data-part="${name}-needle" class="iso-line" data-tone="${lit ? "lit" : "hi"}" data-free="" d="${live.needle(cx, cy, R, top, reading, outlet.full)}" style="stroke-width:${lit ? 1.1 : 0.9}"/>`);
  return out.join("");
}

// ---------------------------------------------------------------- assemble
const below = [
  { depth: depth(POSTS[0]), svg: post(POSTS[0]) },
  { depth: depth(POSTS[1]), svg: post(POSTS[1]) },
  { depth: depth(POSTS[2]), svg: post(POSTS[2]) },
  { depth: depth(POSTS[3]), svg: post(POSTS[3]) },
  { depth: depth([RV_X, 0]), svg: ventricle("rv", RV_X, false) },
  { depth: depth([RV_X / 2, 0]) + 0.01, svg: shaft(-18, RV_X + 10) },
  { depth: depth([0, 0]), svg: pacer() },
  { depth: depth([LV_X / 2, 0]), svg: shaft(18, LV_X - 10) },
  { depth: depth([LV_X, 0]), svg: ventricle("lv", LV_X, true) },
  { depth: depth([LV_X, 0]) + 0.01, svg: volumeScale() },
].sort((a, b) => a.depth - b.depth);

const above = [
  { depth: depth(VALVES.tricuspid.at), svg: cage("tricuspid", VALVES.tricuspid) + atriumStack("ra", VALVES.tricuspid) },
  { depth: depth(VALVES.pulmonary.at), svg: cage("pulmonary", VALVES.pulmonary) + outletStack("pulmonary", OUTLETS.pulmonary) },
  { depth: 0, svg: septum() },
  { depth: depth(VALVES.mitral.at), svg: cage("mitral", VALVES.mitral) + atriumStack("la", VALVES.mitral) },
  { depth: depth(VALVES.aortic.at), svg: cage("aortic", VALVES.aortic) + outletStack("aortic", OUTLETS.aortic) },
].sort((a, b) => a.depth - b.depth);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench model of the human heart as a four-chamber pump. Two bellows hang under a valve deck: the right and left ventricles, each squeezed from below by a pushrod that a pacer box drives. On the deck stand four check-valve cages: the tricuspid and mitral valves under two small bellows, the atria, which take in blood from funnels at the top, and the pulmonary and aortic valves under two outflow columns with pressure gauges. A wall between the two sides is the septum.",
  body: [base(), ...below.map((item) => item.svg), deck(), ...above.map((item) => item.svg)],
});

// ---------------------------------------------------------------- live
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const DATA = {
  P,
  D,
  RV_X,
  LV_X,
  MM_PER_ML,
  A_MIN,
  A_SPAN,
  VALVES,
  OUTLETS: Object.fromEntries(Object.entries(OUTLETS).map(([name, o]) => [name, { ...o, top: dialTop(o) }])),
  closed: Object.fromEntries(Object.entries(VALVES).map(([name, v]) => [name, poppetZ(v, 0)])),
  opened: Object.fromEntries(Object.entries(VALVES).map(([name, v]) => [name, poppetZ(v, 1)])),
};

const LIVE = `
${strip("model.mjs")}
${strip("parts.mjs")}
const DATA = ${JSON.stringify(DATA)};
const { P, D, VALVES, OUTLETS } = DATA;
const kit = { cylinder, solidSvg, lineSvg, sideArc, lineOnTop };
const live = makeLive(kit, P, D);
const SLOW = 0.25;
const SHORT = ["atrial systole", "isovolumic contraction", "ejection", "isovolumic relaxation", "filling"];
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const els = {
  rvRod: part("rv-rod"), rvBellows: part("rv-bellows"), lvRod: part("lv-rod"), lvBellows: part("lv-bellows"),
  ra: part("ra-atrium"), raCap: part("ra-cap"), la: part("la-atrium"), laCap: part("la-cap"),
  arm: part("lv-arm"), aortic: part("aortic-needle"), pulmonary: part("pulmonary-needle"),
};
const poppets = Object.fromEntries(Object.keys(VALVES).map((name) => [name, part(name + "-poppet")]));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const wrap = (s) => ((s % BEAT) + BEAT) % BEAT;
let t = 0.25, target = 0.25, touring = true, visible = false, frame = 0, last = 0, idleTimer = 0;
const open = Object.fromEntries(Object.keys(VALVES).map((name) => [name, 0]));
let drawn = {};
function draw(h) {
  const lv = h.lvVolume * DATA.MM_PER_ML;
  // The right ventricle moves the same stroke volume in step with the left.
  const rv = lv;
  const key = lv.toFixed(2);
  if (drawn.v !== key) {
    els.lvBellows.innerHTML = live.ventricle(DATA.LV_X, lv);
    els.lvRod.innerHTML = live.pushrod(DATA.LV_X, lv, true);
    els.rvBellows.innerHTML = live.ventricle(DATA.RV_X, rv);
    els.rvRod.innerHTML = live.pushrod(DATA.RV_X, rv, false);
    els.arm.setAttribute("transform", translateAlong(P, [0, 0, D.HANG - lv - D.APEX_H]));
    drawn.v = key;
  }
  const a = DATA.A_MIN + DATA.A_SPAN * h.atrium;
  const akey = a.toFixed(2);
  if (drawn.a !== akey) {
    els.ra.innerHTML = live.atrium(VALVES.tricuspid.at[0], VALVES.tricuspid.at[1], a);
    els.la.innerHTML = live.atrium(VALVES.mitral.at[0], VALVES.mitral.at[1], a);
    const lift = translateAlong(P, [0, 0, a]);
    els.raCap.setAttribute("transform", lift);
    els.laCap.setAttribute("transform", lift);
    drawn.a = akey;
  }
  for (const name of Object.keys(VALVES)) {
    const z = DATA.closed[name] + (DATA.opened[name] - DATA.closed[name]) * open[name];
    poppets[name].setAttribute("transform", translateAlong(P, [0, 0, z - DATA.closed[name]]));
  }
  const o = OUTLETS.aortic, q = OUTLETS.pulmonary;
  els.aortic.setAttribute("d", live.needle(VALVES.aortic.at[0], VALVES.aortic.at[1], o.dial, o.top, h.aorta, o.full));
  els.pulmonary.setAttribute("d", live.needle(VALVES.pulmonary.at[0], VALVES.pulmonary.at[1], q.dial, q.top, h.pulmonary, q.full));
  const text = SHORT[h.index] + " · LV " + Math.round(h.lvPressure) + " mmHg · " + Math.round(h.lvVolume) + " mL";
  if (readout.textContent !== text) readout.textContent = text;
  const ms = Math.round(h.t * 1000);
  stage.setAttribute("aria-valuenow", String(ms));
  stage.setAttribute("aria-valuetext", PHASES[h.index].name + ", " + ms + " ms into the beat; left ventricle " + Math.round(h.lvPressure) + " mmHg and " + Math.round(h.lvVolume) + " mL; aorta " + Math.round(h.aorta) + " mmHg");
}
function settleValves(h, dt, calm) {
  let moving = false;
  for (const [name, valve] of Object.entries(VALVES)) {
    const want = (valve.av ? h.avOpen : h.outOpen) ? 1 : 0;
    open[name] = calm ? want : open[name] + (want - open[name]) * (1 - Math.exp(-dt / 0.07));
    if (Math.abs(want - open[name]) < 0.002) open[name] = want;
    else moving = true;
  }
  return moving;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { t = wrap(t + dt * SLOW); target = t; }
  else {
    let gap = wrap(target - t);
    if (gap > BEAT / 2) gap -= BEAT;
    t = calm ? target : wrap(t + gap * (1 - Math.exp(-dt / 0.22)));
    if (Math.abs(gap) < 0.0005) t = target;
  }
  const h = heartAt(t);
  const moving = settleValves(h, dt, calm);
  draw(h);
  const settled = !touring && t === target && !moving;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  target = wrap(next);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, ((event.clientX - box.left) / box.width - 0.12) / 0.76));
  steer(share * BEAT * 0.999);
});
stage.addEventListener("pointerleave", () => steer(target));
const mids = PHASES.map((p) => p.from + (p.to - p.from) * 0.5);
stage.addEventListener("keydown", (event) => {
  const here = heartAt(target).index;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = (here + 1) % PHASES.length;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = (here + PHASES.length - 1) % PHASES.length;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = PHASES.length - 1;
  if (to === null) return;
  event.preventDefault();
  steer(mids[to]);
});
{
  const h = heartAt(t);
  settleValves(h, 1, true);
  draw(h);
}
`;

const first = heartAt(0.25);
const body = k.plateHtml({
  fig: "Fig 1",
  title: "The heart, as a pump",
  hint: "Hover to scrub one heartbeat",
  readout: `ejection · LV ${Math.round(first.lvPressure)} mmHg · ${Math.round(first.lvVolume)} mL`,
  keys: [
    { mark: "lit", label: "Left ventricle pushrod and aortic gauge: the stroke and the pressure it makes" },
    { mark: "raised", label: "Chambers and valves: two atria, two ventricles, four one-way valves" },
  ],
  caption: `A bench model of the heart at 75 beats a minute, slowed 4×. Each ventricle is a bellows under the valve deck; it fills to ${EDV} mL and empties to ${ESV} mL, so each beat pushes ${EDV - ESV} mL (an ejection fraction of ${Math.round(((EDV - ESV) / EDV) * 100)}%). The tricuspid and mitral poppets drop open while the ventricles fill and are pushed shut as they squeeze; the pulmonary and aortic poppets lift only while ventricular pressure beats the artery's. The aortic gauge swings between 80 and 120 mmHg, the pulmonary gauge between about 10 and 25, because the right side drives the lungs at a fifth of the pressure. Hover across the card, or use the arrow keys, to step through the ${PHASES.length} phases.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Heart model: arrow keys step through the phases of one beat" aria-valuemin="0" aria-valuemax="${Math.round(BEAT * 1000)}" aria-valuenow="250">${svg}</div>`,
});

const file = theme === "light" ? "heart-light.html" : "heart.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "The heart, as a pump", theme, body, script: kitScript() + LIVE }));
console.log("wrote", file);
