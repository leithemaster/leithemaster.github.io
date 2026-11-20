/*
 * GLSL for every pass of the fluid simulation.
 * Each fragment shader runs once per pixel of whatever it draws into.
 */

// ==== SHADERS ====
// WHAT: the GLSL programs. Each fragment shader below is one "pass".
//   A pass = draw one rectangle covering a texture; the GPU runs the
//   fragment shader once per pixel of that texture, all in parallel.
// LIFECYCLE: plain strings. Compiled once at mount (engine.ts, COMPILE AND LINK).
// IN REACT TERMS: a Reanimated worklet, but for every pixel at once.
//   A pixel can't see what its neighbors are computing right now. It can
//   only READ textures (last pass's results) and RETURN one color.
//   Inputs:  `in`  = per-pixel values (vUv = this pixel's position 0..1)
//            `uniform` = the same value for every pixel (like props)
//   Output:  `out vec4 outColor` = what this pixel writes. Here
//            the "color" is often not a color: velocity stores x,y speed
//            in .r and .g, pressure stores one number in .r.

export const SHADERS = {

  // ---- Vertex shader (shared by every pass) ----
  // Runs 4 times, once per corner of the rectangle. Its job: place the
  // corner on screen and work out texture coordinates. The GPU then
  // blends (interpolates) the `out` values across every pixel between
  // the corners, which is how each fragment gets its own vUv.
  vertex: `#version 300 es
    in vec2 aPosition;        // corner position, -1..1 (WebGL's screen space)
    uniform vec2 uTexel;      // size of one cell: 1/width, 1/height
    out vec2 vUv;             // this pixel's position in 0..1 texture space
    out vec2 vL, vR, vT, vB;  // positions of the left, right, top, bottom neighbors
    void main() {
      vUv = aPosition * 0.5 + 0.5;          // -1..1  ->  0..1
      vL = vUv - vec2(uTexel.x, 0.0);
      vR = vUv + vec2(uTexel.x, 0.0);
      vT = vUv + vec2(0.0, uTexel.y);
      vB = vUv - vec2(0.0, uTexel.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`,

  // ---- SPLAT: add a soft dot of something at the cursor ----
  // Used twice per cursor step: once to add force to velocity,
  // once to add color to the ink.
  splat: `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    uniform sampler2D uTarget;  // the texture we are adding to
    uniform float uAspect;      // width / height, so the dot is round, not stretched
    uniform vec2 uPoint;        // cursor position, 0..1
    uniform vec3 uValue;        // what to add: (force.x, force.y, 0) or (r, g, b)
    uniform float uRadius;
    void main() {
      vec2 d = vUv - uPoint;                        // how far this pixel is from the cursor
      d.x *= uAspect;                               // measure x in the same units as y
      float falloff = exp(-dot(d, d) / uRadius);    // 1 at the center, fades smoothly to 0 (a Gaussian)
      vec3 base = texture(uTarget, vUv).xyz;        // what was already here
      outColor = vec4(base + falloff * uValue, 1.0);
    }`,

  // ---- ADVECT: move a texture along the velocity field ----
  // The trick: instead of pushing each pixel forward (hard on a GPU,
  // pixels can't write to other pixels), each pixel looks BACKWARD:
  // "where was the stuff that will be here after dt?" and copies it.
  advect: `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    uniform sampler2D uVelocity;  // the field that does the moving
    uniform sampler2D uSource;    // the thing being moved (velocity itself, or ink)
    uniform vec2 uSimTexel;       // one velocity cell in 0..1 units
    uniform float uDt;            // seconds since last frame
    uniform float uFade;          // how fast it fades, per second
    void main() {
      vec2 velocity = texture(uVelocity, vUv).xy;        // cells per second at this pixel
      vec2 from = vUv - uDt * velocity * uSimTexel;      // step back in time
      vec4 moved = texture(uSource, from);               // linear filtering blends neighbors for free
      outColor = moved / (1.0 + uFade * uDt);            // fade a little every frame
    }`,

  // ---- CURL: how much each spot is spinning ----
  // Compares neighbors: if the right side moves up and the left side
  // moves down, this spot is spinning counter-clockwise.
  curl: `#version 300 es
    precision highp float;
    in vec2 vUv, vL, vR, vT, vB;
    out vec4 outColor;
    uniform sampler2D uVelocity;
    void main() {
      float L = texture(uVelocity, vL).y;
      float R = texture(uVelocity, vR).y;
      float T = texture(uVelocity, vT).x;
      float B = texture(uVelocity, vB).x;
      float spin = R - L - T + B;
      outColor = vec4(0.5 * spin, 0.0, 0.0, 1.0);        // one number, stored in .r
    }`,

  // ---- VORTICITY: push spinning areas to keep spinning ----
  // Real simulations lose small swirls to rounding (numerical blur).
  // This adds a little force toward the center of each swirl to put
  // that detail back. It is what makes the ink curl instead of smear.
  vorticity: `#version 300 es
    precision highp float;
    in vec2 vUv, vL, vR, vT, vB;
    out vec4 outColor;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float uCurlStrength;
    uniform float uDt;
    void main() {
      float L = texture(uCurl, vL).x;
      float R = texture(uCurl, vR).x;
      float T = texture(uCurl, vT).x;
      float B = texture(uCurl, vB).x;
      float C = texture(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));  // points toward stronger spin
      force /= length(force) + 0.0001;                            // keep only the direction
      force *= uCurlStrength * C;                                 // scale by how much this spot spins
      force.y *= -1.0;                                            // turn 90 degrees
      vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
      outColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
    }`,

  // ---- DIVERGENCE: is fluid piling up here, or thinning out? ----
  // Positive = more flowing out than in. Real water can't do either,
  // so the next two passes fix it. Edges act like walls.
  divergence: `#version 300 es
    precision highp float;
    in vec2 vUv, vL, vR, vT, vB;
    out vec4 outColor;
    uniform sampler2D uVelocity;
    void main() {
      float L = texture(uVelocity, vL).x;
      float R = texture(uVelocity, vR).x;
      float T = texture(uVelocity, vT).y;
      float B = texture(uVelocity, vB).y;
      vec2 C = texture(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x;    // walls: bounce back off the edges
      if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y;
      if (vB.y < 0.0) B = -C.y;
      outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,

  // ---- SCALE: multiply a texture by a number ----
  // Used to fade last frame's pressure, and with uValue = 1.0 as a plain copy.
  scale: `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    uniform sampler2D uTexture;
    uniform float uValue;
    void main() {
      outColor = uValue * texture(uTexture, vUv);
    }`,

  // ---- PRESSURE: one step of solving for pressure ----
  // Each pixel sets its pressure to the average of its neighbors, nudged
  // by divergence. Run it once and it's rough; run it 20 times (Jacobi
  // iteration) and the answer settles. Each run reads the last run's
  // output, so this is where ping-pong matters most.
  pressure: `#version 300 es
    precision highp float;
    in vec2 vUv, vL, vR, vT, vB;
    out vec4 outColor;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    void main() {
      float L = texture(uPressure, vL).x;
      float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x;
      float B = texture(uPressure, vB).x;
      float div = texture(uDivergence, vUv).x;
      outColor = vec4((L + R + T + B - div) * 0.25, 0.0, 0.0, 1.0);
    }`,

  // ---- GRADIENT SUBTRACT: remove the piling up ----
  // Fluid flows from high pressure to low. Subtracting the pressure
  // slope from velocity leaves a field that neither piles up nor
  // thins out. This one step is what makes it read as liquid.
  gradient: `#version 300 es
    precision highp float;
    in vec2 vUv, vL, vR, vT, vB;
    out vec4 outColor;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    void main() {
      float L = texture(uPressure, vL).x;
      float R = texture(uPressure, vR).x;
      float T = texture(uPressure, vT).x;
      float B = texture(uPressure, vB).x;
      vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
      outColor = vec4(velocity, 0.0, 1.0);
    }`,

  // ---- DISPLAY: the only pass that draws to the screen ----
  display: `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    uniform sampler2D uTexture;
    uniform int uView;          // 0 = ink, 1 = velocity, 2 = pressure (the Lens buttons)
    uniform vec3 uBackground;
    void main() {
      vec3 color;
      if (uView == 1) {
        vec2 v = texture(uTexture, vUv).xy;
        color = vec3(0.5 + v * 0.004, 0.55);              // still = grey, x speed tints red, y speed tints green
      } else if (uView == 2) {
        float p = texture(uTexture, vUv).x;
        color = uBackground + vec3(max(p, 0.0), 0.3 * abs(p), max(-p, 0.0)) * 0.06;  // high = warm, low = cool
      } else {
        vec3 ink = texture(uTexture, vUv).rgb;
        ink = 1.0 - exp(-ink * 1.4);                      // soft tone map: piles of ink approach white, never clip hard
        color = uBackground + ink * (1.0 - uBackground);
      }
      outColor = vec4(color, 1.0);
    }`,
} as const;

export type ShaderName = keyof typeof SHADERS;
