import { defaultClientConditions, defineConfig } from 'vite';

/**
 * The embed script sites put on their pages: one classic script file with a stable
 * name, no modules, no dependencies of its own.
 */
export default defineConfig({
  resolve: { conditions: ['@slotwise/source', ...defaultClientConditions] },
  build: {
    target: 'es2019',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: 'src/loader/widget.ts',
      formats: ['iife'],
      name: 'MestechkoWidget',
      fileName: () => 'widget.js',
    },
  },
});
