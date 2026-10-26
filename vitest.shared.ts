import type { ViteUserConfig } from 'vitest/config';

/**
 * Workspace packages expose their TypeScript sources under the `@slotwise/source`
 * condition, so tests run against sources without a build step.
 */
export const sourceConditions = ['@slotwise/source'];

export const workspaceResolution: Pick<ViteUserConfig, 'resolve' | 'ssr'> = {
  resolve: { conditions: sourceConditions },
  ssr: { resolve: { conditions: sourceConditions, externalConditions: sourceConditions } },
};
