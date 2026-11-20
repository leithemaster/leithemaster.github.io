import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Three pages, one build: the reading, the resume, and the design document.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        resume: resolve(import.meta.dirname, 'resume.html'),
        design: resolve(import.meta.dirname, 'design.html'),
      },
    },
  },
});
