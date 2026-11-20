/*
 * Fluid ink engine.
 *
 * Platform-free on purpose: it only needs a WebGL2 context. It knows
 * nothing about the DOM, canvases or React. The component that owns the
 * drawing surface (src/ink.ts)
 * feeds it sizes and pointer positions.
 *
 * Read in order: KNOBS (config.ts) -> SHADERS (shaders.ts) -> this file.
 */

import { FLUID, type FluidView } from './config';
import { SHADERS } from './shaders';

export type FluidHandle = {
  /** Call after the drawing surface changes size (in device pixels). */
  resize: () => void;
  /** Pointer position in 0..1, with y = 0 at the BOTTOM (WebGL's convention). */
  pointerMove: (x: number, y: number) => void;
  pointerLeave: () => void;
  setView: (view: FluidView) => void;
  destroy: () => void;
};

export type FluidOptions = {
  /** Skip the idle autopilot (respect the OS "reduce motion" setting). */
  reducedMotion?: boolean;
  /** Called after each frame is drawn. */
  onFrameEnd?: () => void;
  /** Ink colors (0..1 RGB) the brush drifts between. Omit for the rotating rainbow. */
  palette?: RGB[];
  /** Stage color behind the ink (0..1 RGB). Black suits a `screen` blend over a photo. */
  background?: RGB;
};

type Program = { program: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

type Target = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texel: [number, number];
  attach: (unit: number) => number;
};

type DoubleTarget = {
  readonly read: Target;
  readonly write: Target;
  width: number;
  height: number;
  texel: [number, number];
  swap: () => void;
};

type RGB = [number, number, number];

export function createFluid(gl: WebGL2RenderingContext, options: FluidOptions = {}): FluidHandle {

  // ==== 1. SETUP ====
  // WHAT: make sure this GPU can do what the simulation needs.
  // LIFECYCLE: once, at mount. Everything after this hangs off `gl`.
  // IN REACT TERMS: the top of useEffect(() => { ... }, []). `gl` is like
  //   a ref to a native module: an imperative handle, not state.

  // Velocity can be negative and larger than 1. Normal 0..255 images can't
  // hold that, so we use half-float textures. This extension lets us
  // render INTO them (reading them is always allowed in WebGL2).
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
    throw new Error('This GPU cannot render to float textures, which the simulation needs.');
  }


  // ==== 2. COMPILE AND LINK ====
  // WHAT: turn each GLSL string into a GPU program. A program = the
  //   shared vertex shader + one fragment shader, linked together.
  //   We also look up where each uniform lives, so we can set it later.
  // LIFECYCLE: once, at mount. Deleted in cleanup.
  // IN REACT TERMS: StyleSheet.create, or Babel turning a worklet into
  //   something the UI thread can run: expensive prep done up front so
  //   the per-frame work is cheap.

  const shaders: WebGLShader[] = [];

  function compile(type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Shader failed to compile:\n' + gl.getShaderInfoLog(shader));
    }
    shaders.push(shader);
    return shader;
  }

  const vertexShader = compile(gl.VERTEX_SHADER, SHADERS.vertex);

  function makeProgram(fragmentSource: string): Program {
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.bindAttribLocation(program, 0, 'aPosition'); // corner positions always come in on slot 0
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program failed to link:\n' + gl.getProgramInfoLog(program));
    }
    // Ask the program which uniforms it has, so we get { uDt: location, ... }.
    // Think of it as reading a component's prop types.
    const u: Record<string, WebGLUniformLocation | null> = {};
    const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(program, i)!.name;
      u[name] = gl.getUniformLocation(program, name);
    }
    return { program, u };
  }

  const P = {
    splat: makeProgram(SHADERS.splat),
    advect: makeProgram(SHADERS.advect),
    curl: makeProgram(SHADERS.curl),
    vorticity: makeProgram(SHADERS.vorticity),
    divergence: makeProgram(SHADERS.divergence),
    scale: makeProgram(SHADERS.scale),
    pressure: makeProgram(SHADERS.pressure),
    gradient: makeProgram(SHADERS.gradient),
    display: makeProgram(SHADERS.display),
  };

  /** Switch to a program and hand back its uniform locations. */
  function use(p: Program) {
    gl.useProgram(p.program);
    return p.u;
  }


  // ==== 3. GEOMETRY: one rectangle that covers everything ====
  // WHAT: 4 corners, drawn as 2 triangles. Every pass draws this same
  //   rectangle; the fragment shader does all the interesting work.
  // LIFECYCLE: uploaded to the GPU once, deleted in cleanup.
  // IN REACT TERMS: a <View style={StyleSheet.absoluteFill} /> that
  //   every pass renders into.

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); // slot 0, 2 floats per corner

  /** Run the current program over a whole target. `null` = the screen. */
  function blit(target: Target | null) {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }


  // ==== 4. FRAMEBUFFERS AND PING-PONG ====
  // WHAT: the simulation's memory. A texture holds numbers per pixel; a
  //   framebuffer lets a pass draw INTO that texture instead of the
  //   screen. A pass may not read and write the same texture, so each
  //   field that updates itself gets two: read last frame, write next
  //   frame, swap.
  // LIFECYCLE: created at mount, recreated on resize (old ones deleted),
  //   deleted in cleanup. The contents persist between frames: that is
  //   the "state" of the fluid.
  // IN REACT TERMS: state you never mutate. `read` is prev, `write` is
  //   next, swap() is setState.

  function createTarget(width: number, height: number): Target {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('This GPU cannot draw into half-float textures.');
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT); // start empty: no motion, no ink

    return {
      texture,
      fbo,
      width,
      height,
      texel: [1 / width, 1 / height],
      attach(unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return unit;
      },
    };
  }

  function createDouble(width: number, height: number): DoubleTarget {
    let read = createTarget(width, height);
    let write = createTarget(width, height);
    return {
      get read() { return read; },
      get write() { return write; },
      width,
      height,
      texel: [1 / width, 1 / height],
      swap() { [read, write] = [write, read]; },
    };
  }

  function deleteTarget(t: Target | undefined) {
    if (!t) return;
    gl.deleteTexture(t.texture);
    gl.deleteFramebuffer(t.fbo);
  }

  function deleteDouble(d: DoubleTarget | undefined) {
    if (!d) return;
    deleteTarget(d.read);
    deleteTarget(d.write);
  }

  /** Texture size for a resolution: `resolution` cells on the short side, same shape as the surface. */
  function sizeFor(resolution: number): [number, number] {
    const w = Math.max(1, gl.drawingBufferWidth);
    const h = Math.max(1, gl.drawingBufferHeight);
    const aspect = w / h;
    const max: number = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const long = Math.min(max, Math.round(resolution * (aspect >= 1 ? aspect : 1 / aspect)));
    return aspect >= 1 ? [long, resolution] : [resolution, long];
  }

  /** New double target at a new size, with the old picture copied in so it survives. */
  function resizeDouble(old: DoubleTarget | undefined, width: number, height: number): DoubleTarget {
    if (old && old.width === width && old.height === height) return old;
    const fresh = createDouble(width, height);
    if (old) {
      const u = use(P.scale);
      gl.uniform1i(u.uTexture, old.read.attach(0));
      gl.uniform1f(u.uValue, 1.0); // multiply by 1 = copy
      blit(fresh.read);
      deleteDouble(old);
    }
    return fresh;
  }

  let velocity!: DoubleTarget;
  let dye!: DoubleTarget;
  let pressure: DoubleTarget | undefined;
  let divergence: Target | undefined;
  let curl: Target | undefined;

  function allocate() {
    const [sw, sh] = sizeFor(FLUID.simResolution);
    const longest = Math.max(gl.drawingBufferWidth, gl.drawingBufferHeight, 1);
    const [dw, dh] = sizeFor(Math.min(FLUID.dyeResolution, longest));
    velocity = resizeDouble(velocity, sw, sh); // keeps its motion across a resize
    dye = resizeDouble(dye, dw, dh); // keeps its ink across a resize
    // Recomputed from scratch every frame, so nothing to keep.
    deleteDouble(pressure);
    deleteTarget(divergence);
    deleteTarget(curl);
    pressure = createDouble(sw, sh);
    divergence = createTarget(sw, sh);
    curl = createTarget(sw, sh);
  }
  allocate();


  // ==== 5. INPUT AND SMOOTHING ====
  // WHAT: pointerMove() only records WHERE the pointer is. The frame loop
  //   eases a second, smoothed cursor toward it and pushes the fluid with
  //   the smoothed one. That easing is most of why it feels fluid.
  // LIFECYCLE: pointerMove/pointerLeave fire on events; updateCursor()
  //   runs every frame.
  // IN REACT TERMS: `pointer` is a useSharedValue the gesture handler
  //   writes; `cursor` is that value run through withTiming/withSpring.

  const pointer = { x: 0.5, y: 0.5, inside: false, lastInput: -Infinity };
  const cursor = { x: 0.5, y: 0.5 };

  /** Ink color: hue slowly rotates over time. Returns 0..1 RGB. */
  function inkColor(now: number): RGB {
    const s = FLUID.inkStrength;
    const palette = options.palette;
    if (palette && palette.length > 0) {
      // Drift slowly from one palette color to the next, wrapping around.
      const t = (now * 0.00012) % palette.length;
      const a = palette[Math.floor(t)];
      const b = palette[(Math.floor(t) + 1) % palette.length];
      const k = t - Math.floor(t);
      return [0, 1, 2].map((i) => (a[i] + (b[i] - a[i]) * k) * s) as RGB;
    }
    const h = (now * 0.00008) % 1;
    const f = (n: number) => {
      const k = (n + h * 6) % 6;
      return 1 - Math.max(0, Math.min(k, 4 - k, 1)); // HSV -> RGB, full saturation and value
    };
    return [f(5) * s, f(3) * s, f(1) * s];
  }

  function updateCursor(dt: number, now: number) {
    // Autopilot: with no input for a while, trace a slow loop so the
    // effect never sits still. The first real movement takes over.
    const idle = !pointer.inside && now - pointer.lastInput > FLUID.idleAfterMs;
    if (idle && !options.reducedMotion) {
      const t = (now / 1000) * FLUID.autopilotSpeed;
      pointer.x = 0.5 + 0.3 * Math.sin(t * 0.83);
      pointer.y = 0.5 + 0.22 * Math.sin(t * 1.31 + 0.6);
    }

    // The lerp. exp() makes it feel the same at 60 Hz and 120 Hz.
    const alpha = 1 - Math.exp(-FLUID.smoothing * dt);
    const prevX = cursor.x;
    const prevY = cursor.y;
    cursor.x += (pointer.x - cursor.x) * alpha;
    cursor.y += (pointer.y - cursor.y) * alpha;

    const dx = cursor.x - prevX;
    const dy = cursor.y - prevY;
    if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;

    // Cursor speed in velocity-grid cells per second.
    const speedX = ((dx * velocity.width) / dt) * FLUID.splatForce;
    const speedY = ((dy * velocity.height) / dt) * FLUID.splatForce;

    // Fill the gap after a fast flick with a few splats along the path.
    const aspect = gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight);
    const distance = Math.hypot(dx * aspect, dy);
    const steps = Math.max(1, Math.min(4, Math.ceil(distance / 0.012)));
    const color = inkColor(now).map((c) => c / steps) as RGB;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      splat(prevX + dx * k, prevY + dy * k, speedX / steps, speedY / steps, color);
    }
  }


  // ==== 6. THE PASSES ====
  // WHAT: one block per shader. Each: pick a program, set its uniforms
  //   (props), attach input textures, blit into an output, swap if the
  //   output was a ping-pong pair.
  // LIFECYCLE: called every frame. They create and delete nothing.
  // IN REACT TERMS: the body of a useFrameCallback.

  function splat(x: number, y: number, forceX: number, forceY: number, color: RGB) {
    const u = use(P.splat);
    gl.uniform1f(u.uAspect, gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight));
    gl.uniform2f(u.uPoint, x, y);
    gl.uniform1f(u.uRadius, FLUID.splatRadius);

    gl.uniform1i(u.uTarget, velocity.read.attach(0));
    gl.uniform3f(u.uValue, forceX, forceY, 0);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(u.uTarget, dye.read.attach(0));
    gl.uniform3f(u.uValue, color[0], color[1], color[2]);
    blit(dye.write);
    dye.swap();
  }

  /** A few random splats so the first frame isn't empty. */
  function seed() {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const color = inkColor(performance.now() + i * 1500).map((c) => c * 6) as RGB;
      splat(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, Math.cos(angle) * 600, Math.sin(angle) * 600, color);
    }
  }

  function step(dt: number) {
    const texel = velocity.texel;
    let u;

    // CURL: velocity -> curl
    u = use(P.curl);
    gl.uniform2f(u.uTexel, texel[0], texel[1]);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(curl!);

    // VORTICITY: velocity + curl -> velocity
    u = use(P.vorticity);
    gl.uniform2f(u.uTexel, texel[0], texel[1]);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uCurl, curl!.attach(1));
    gl.uniform1f(u.uCurlStrength, FLUID.curlStrength);
    gl.uniform1f(u.uDt, dt);
    blit(velocity.write);
    velocity.swap();

    // DIVERGENCE: velocity -> divergence
    u = use(P.divergence);
    gl.uniform2f(u.uTexel, texel[0], texel[1]);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(divergence!);

    // Fade last frame's pressure and start from it.
    u = use(P.scale);
    gl.uniform1i(u.uTexture, pressure!.read.attach(0));
    gl.uniform1f(u.uValue, FLUID.pressureFade);
    blit(pressure!.write);
    pressure!.swap();

    // PRESSURE: refine N times, ping-ponging every time.
    u = use(P.pressure);
    gl.uniform2f(u.uTexel, texel[0], texel[1]);
    gl.uniform1i(u.uDivergence, divergence!.attach(0));
    for (let i = 0; i < FLUID.pressureIterations; i++) {
      gl.uniform1i(u.uPressure, pressure!.read.attach(1));
      blit(pressure!.write);
      pressure!.swap();
    }

    // GRADIENT SUBTRACT: velocity - slope(pressure) -> velocity
    u = use(P.gradient);
    gl.uniform2f(u.uTexel, texel[0], texel[1]);
    gl.uniform1i(u.uPressure, pressure!.read.attach(0));
    gl.uniform1i(u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    // ADVECT velocity by itself...
    u = use(P.advect);
    gl.uniform2f(u.uSimTexel, texel[0], texel[1]);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, velocity.read.attach(0));
    gl.uniform1f(u.uFade, FLUID.velocityFade);
    blit(velocity.write);
    velocity.swap();

    // ...then ADVECT the ink by the new velocity.
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, dye.read.attach(1));
    gl.uniform1f(u.uFade, FLUID.dyeFade);
    blit(dye.write);
    dye.swap();
  }

  let view: FluidView = 'dye';

  function render() {
    const u = use(P.display);
    const source = view === 'velocity' ? velocity.read : view === 'pressure' ? pressure!.read : dye.read;
    const [r, g, b] = options.background ?? FLUID.background;
    gl.uniform1i(u.uTexture, source.attach(0));
    gl.uniform1i(u.uView, view === 'velocity' ? 1 : view === 'pressure' ? 2 : 0);
    gl.uniform3f(u.uBackground, r, g, b);
    blit(null);
  }


  // ==== 7. THE RENDER LOOP ====
  // WHAT: once per screen refresh: work out dt, ease the cursor, run the
  //   simulation, draw, ask for the next frame.
  // LIFECYCLE: starts at mount, runs until destroy() cancels it.
  // IN REACT TERMS: useFrameCallback. Nothing here touches React state.

  let rafId = 0;
  let lastTime = performance.now();

  function frame(now: number) {
    // Clamp dt so a stalled tab doesn't fling everything in one step.
    const dt = Math.min(Math.max((now - lastTime) / 1000, 1 / 240), 1 / 30);
    lastTime = now;
    updateCursor(dt, now);
    step(dt);
    render();
    options.onFrameEnd?.();
    rafId = requestAnimationFrame(frame);
  }

  seed();
  rafId = requestAnimationFrame(frame);


  // ==== 8. HANDLE: resize, input, cleanup ====
  // WHAT: the only ways the outside world talks to the engine.
  // LIFECYCLE: resize/pointer calls fire on events; destroy() once.
  // IN REACT TERMS: an imperative handle (useImperativeHandle). destroy()
  //   is the function returned from useEffect. GPU memory is NOT garbage
  //   collected like JS objects, so skipping it leaks textures.

  return {
    resize() {
      allocate();
    },
    pointerMove(x, y) {
      pointer.x = x;
      pointer.y = y;
      pointer.inside = true;
      pointer.lastInput = performance.now();
    },
    pointerLeave() {
      pointer.inside = false;
    },
    setView(next) {
      view = next;
    },
    destroy() {
      cancelAnimationFrame(rafId);
      deleteDouble(velocity);
      deleteDouble(dye);
      deleteDouble(pressure);
      deleteTarget(divergence);
      deleteTarget(curl);
      Object.values(P).forEach((p) => gl.deleteProgram(p.program));
      shaders.forEach((s) => gl.deleteShader(s));
      gl.deleteBuffer(quad);
      gl.deleteVertexArray(vao);
    },
  };
}
