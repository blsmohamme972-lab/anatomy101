// One heartbeat at 75 bpm, as a pure function of time in the cycle.
// Numbers are textbook resting values for an adult: LV end-diastolic volume
// 120 mL, end-systolic 50 mL (stroke volume 70 mL, ejection fraction 58%),
// LV peak about 120 mmHg, aorta 120/80, RV peak about 25 mmHg, pulmonary
// artery 25/10. Phases follow the Wiggers diagram.

export const BEAT = 0.8; // s per beat at 75 bpm
export const EDV = 120;
export const ESV = 50;

export const PHASES = [
  { name: "atrial systole", from: 0.0, to: 0.1 },
  { name: "isovolumetric contraction", from: 0.1, to: 0.15 },
  { name: "ejection", from: 0.15, to: 0.4 },
  { name: "isovolumetric relaxation", from: 0.4, to: 0.48 },
  { name: "ventricular filling", from: 0.48, to: 0.8 },
];

export function phaseAt(t) {
  const s = ((t % BEAT) + BEAT) % BEAT;
  const index = PHASES.findIndex((phase) => s >= phase.from && s < phase.to);
  const phase = PHASES[index < 0 ? PHASES.length - 1 : index];
  return { index: index < 0 ? PHASES.length - 1 : index, phase, u: (s - phase.from) / (phase.to - phase.from), s };
}

export function heartAt(t) {
  const { index, u, s } = phaseAt(t);
  const ease = (x) => x * x * (3 - 2 * x);
  let lvVolume;
  let lvPressure;
  if (index === 0) {
    lvVolume = 110 + 10 * ease(u);
    lvPressure = 4 + 6 * ease(u);
  } else if (index === 1) {
    lvVolume = EDV;
    lvPressure = 10 + 70 * ease(u);
  } else if (index === 2) {
    lvVolume = EDV - (EDV - ESV) * (1 - (1 - u) * (1 - u));
    lvPressure = 80 + 20 * u + 32 * Math.sin(Math.PI * u);
  } else if (index === 3) {
    lvVolume = ESV;
    lvPressure = 100 - 94 * ease(u);
  } else {
    lvVolume = ESV + 60 * (1 - Math.exp(-4 * u)) / (1 - Math.exp(-4));
    lvPressure = 6 - 2 * u;
  }
  // Aorta: follows the ventricle while the aortic valve is open, then runs off
  // from 100 (dicrotic notch) toward 80 until the next ejection.
  let aorta;
  if (index === 2) aorta = lvPressure - 2 * Math.sin(Math.PI * u);
  else {
    const since = s >= 0.4 ? s - 0.4 : s + BEAT - 0.4; // 0 .. 0.55 s
    aorta = 80 + 20 * (1 - ease(since / 0.55));
  }
  // Right side: the same rhythm at about a fifth of the pressure.
  const rvPressure = lvPressure < 10 ? lvPressure * 0.6 : 6 + ((lvPressure - 10) * 19) / 110;
  const pulmonary = 10 + ((aorta - 80) / 40) * 15;
  // Atria: fill while the AV valves are shut, empty in rapid filling, squeeze in atrial systole.
  // 0 is empty, 1 is full; after rapid filling it stays part-full until its own systole.
  let atrium;
  if (index === 0) atrium = 0.45 * (1 - ease(u));
  else if (index <= 3) atrium = (s - 0.1) / 0.38;
  else atrium = 1 - 0.55 * ((1 - Math.exp(-5 * u)) / (1 - Math.exp(-5)));
  const avOpen = index === 0 || index === 4;
  const outOpen = index === 2;
  return { t: s, index, lvVolume, lvPressure, aorta, rvPressure, pulmonary, atrium, avOpen, outOpen };
}
