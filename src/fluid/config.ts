// ==== KNOBS ====
// WHAT: every number worth tweaking, in one place.
// LIFECYCLE: constants. Read every frame, never changed by the code.
// IN REACT TERMS: a constants/theme file you import.

export const FLUID = {
  /** Velocity + pressure grid, cells on the short side. Low = cheap and blobby. */
  simResolution: 128,
  /** The colored ink texture. High = crisp ink edges. */
  dyeResolution: 1024,
  /** How fast the smoothed cursor chases the real one, per second. */
  smoothing: 5,
  /** 1 = the fluid is pushed at the cursor's own speed. */
  splatForce: 0.45,
  /** Size of each push (squared, in screen heights). */
  splatRadius: 0.0035,
  /** How much color one push adds. */
  inkStrength: 0.15,
  /** How fast motion dies out, per second. Higher = the smoke settles sooner. */
  velocityFade: 0.6,
  /** How fast ink fades, per second. Lower = it lingers. */
  dyeFade: 0.55,
  /** Extra swirl. 0 = smooth and syrupy, high = turbulent. */
  curlStrength: 14,
  /** Speed of the idle drift, 1 = the original pace. */
  autopilotSpeed: 0.45,
  /** How many times pressure is refined each frame. */
  pressureIterations: 20,
  /** How much of last frame's pressure is kept as a head start. */
  pressureFade: 0.8,
  /** Autopilot takes over after this long without input. */
  idleAfterMs: 1800,
  /** The dark stage color, as 0..1 RGB. */
  background: [0.035, 0.04, 0.07] as const,
};

export type FluidView = 'dye' | 'velocity' | 'pressure';
