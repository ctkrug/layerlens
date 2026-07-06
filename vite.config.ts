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
    coverage: {
      provider: 'v8',
      // The product's logic is the core pipeline and the UI helpers; type-only
      // and entry files carry no branches worth a coverage number.
      include: ['src/core/**', 'src/ui/**'],
      exclude: ['src/core/types.ts'],
      reporter: ['text', 'html'],
    },
  },
});
