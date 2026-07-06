import { defineConfig } from 'vite';

// base: './' keeps every asset path relative so the built site works under any
// subpath (e.g. apps.charliekrug.com/layerlens) with no server rewrites.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2021',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
