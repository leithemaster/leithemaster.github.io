import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { FluidView } from '../fluid/config';
import { createFluid, type FluidHandle } from '../fluid/engine';

type Props = {
  view?: FluidView;
  style?: StyleProp<ViewStyle>;
};

/**
 * Web version (Metro picks *.web.tsx when bundling for the browser).
 * react-native-web renders through react-dom, so a plain <canvas> works here.
 */
export function FluidInk({ view = 'dye', style }: Props) {
  // The DOM node. On native this would be an expo-gl GLView.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Mutable handle to the running engine. A ref, not state: changing it
  // must never trigger a re-render.
  const fluidRef = useRef<FluidHandle | null>(null);

  // Mount once: get a context, start the engine, wire up input and resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) {
      console.warn('FluidInk: WebGL2 is not available in this browser.');
      return;
    }

    // Match the drawing buffer to the on-screen size (capped at 2x pixel density).
    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width === w && canvas.height === h) return false;
      canvas.width = w;
      canvas.height = h;
      return true;
    };
    fitCanvas();

    let fluid: FluidHandle;
    try {
      fluid = createFluid(gl, {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    } catch (err) {
      console.warn('FluidInk:', err);
      return;
    }
    fluidRef.current = fluid;

    // Event position -> 0..1 inside the canvas. y is flipped: WebGL's 0 is the bottom.
    const onPointerMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      fluid.pointerMove((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    };
    const onPointerLeave = () => fluid.pointerLeave();
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    // Like onLayout: resize the buffer, then let the engine rebuild its textures.
    const observer = new ResizeObserver(() => {
      if (fitCanvas()) fluid.resize();
    });
    observer.observe(canvas);

    // Cleanup: everything started above is stopped here.
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      fluid.destroy();
      fluidRef.current = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  // A prop change doesn't remount anything. It writes into the running
  // loop, the way a uniform is set without recompiling a shader.
  useEffect(() => {
    fluidRef.current?.setView(view);
  }, [view]);

  return (
    <View style={[styles.container, style]}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </View>
  );
}

const canvasStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  touchAction: 'none',
  cursor: 'crosshair',
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a12',
  },
});
