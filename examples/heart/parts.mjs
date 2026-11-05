// The parts whose shape changes with the beat. The build calls these for the
// first frame and the page calls the same source every frame, with `k` bound
// to the kit (an import in Node, the inlined globals in the page).
export function makeLive(k, P, D) {
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);

  // A ventricle: a convoluted bellows hanging from the valve deck, closed by
  // an apex plate. `length` is the bellows height, which is the chamber volume.
  function ventricle(cx, length) {
    const out = [];
    const top = D.HANG;
    const bottom = top - length;
    const plate = D.APEX_H;
    out.push(S(k.cylinder(cx, 0, D.V_R + 1.5, bottom - plate, plate, P, 72, 0.8), { tone: "mid" }));
    out.push(L(k.sideArc(cx, 0, D.V_R + 1.5, bottom - plate * 0.5, P, 48), { tone: "faint" }));
    const pitch = length / D.PLEATS;
    out.push(S(k.cylinder(cx, 0, D.V_R - 3, bottom, pitch * 0.18, P, 64), { tone: "hi", crease: "lo" }));
    for (let index = 0; index < D.PLEATS; index++) {
      const z = bottom + index * pitch;
      out.push(S(k.cylinder(cx, 0, D.V_R, z + pitch * 0.18, pitch * 0.64, P, 72, Math.min(1.2, pitch * 0.16)), { tone: "hi", crease: "lo" }));
      out.push(S(k.cylinder(cx, 0, D.V_R - 3, z + pitch * 0.82, pitch * (index === D.PLEATS - 1 ? 0.18 : 0.36), P, 64), { tone: "hi", crease: "lo" }));
    }
    return out.join("");
  }

  // The pushrod from its gland on the base to the apex plate. Rebuilt every
  // frame; it stands on the gland's seal face.
  function pushrod(cx, length, lit) {
    const bottom = D.HANG - length - D.APEX_H;
    const from = D.GLAND_TOP;
    return S(k.cylinder(cx, 0, D.ROD_R, from, bottom - from, P, 24), { tone: "hi", crease: "none", lit });
  }

  // An atrium: a short bellows standing on its AV valve cage.
  function atrium(cx, cy, length) {
    const out = [];
    const pitch = length / D.A_PLEATS;
    out.push(S(k.cylinder(cx, cy, D.A_R - 2.4, D.CAGE_TOP, pitch * 0.2, P, 48), { tone: "hi", crease: "lo" }));
    for (let index = 0; index < D.A_PLEATS; index++) {
      const z = D.CAGE_TOP + index * pitch;
      out.push(S(k.cylinder(cx, cy, D.A_R, z + pitch * 0.2, pitch * 0.6, P, 56, Math.min(1, pitch * 0.16)), { tone: "hi", crease: "lo" }));
      out.push(S(k.cylinder(cx, cy, D.A_R - 2.4, z + pitch * 0.8, pitch * (index === D.A_PLEATS - 1 ? 0.2 : 0.4), P, 48), { tone: "hi", crease: "lo" }));
    }
    return out.join("");
  }

  // A gauge needle on a face-up dial, from a reading in its own units.
  function needle(cx, cy, r, z, value, full) {
    const angle = D.DIAL_FROM + (D.DIAL_SPAN * Math.max(0, Math.min(full, value))) / full;
    const sx = Math.sin(angle);
    const sy = -Math.cos(angle);
    return k.lineOnTop([cx - sx * 2.6, cy - sy * 2.6], [cx + sx * (r - 4.2), cy + sy * (r - 4.2)], z + 0.2, P);
  }

  return { ventricle, pushrod, atrium, needle };
}
