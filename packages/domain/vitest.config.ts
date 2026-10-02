import { defineConfig } from 'vitest/config';
import { workspaceResolution } from '../../vitest.shared.js';

export default defineConfig({
  ...workspaceResolution,
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
