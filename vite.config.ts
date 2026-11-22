import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Four pages, one build: the reading, the work, the resume, and the design document.
export default defineConfig({
  // Relative URLs, so the built site works at any path: GitHub Pages serves it under
  // /<repo-name>/, and it keeps working if the repo is renamed.
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        resume: resolve(import.meta.dirname, 'resume.html'),
        design: resolve(import.meta.dirname, 'design.html'),
        work: resolve(import.meta.dirname, 'work.html'),
      },
    },
  },
});
