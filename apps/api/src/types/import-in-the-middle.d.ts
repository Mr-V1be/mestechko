// The package ships `register-hooks.d.ts` next to an `.mjs` entry, which TypeScript
// does not associate; this declares the documented synchronous registration API.
declare module 'import-in-the-middle/register-hooks.mjs' {
  export interface RegisterHooksOptions {
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    disableCjsSourceStripping?: boolean;
  }

  export function register(options?: RegisterHooksOptions): void;
  export function supportsSyncHooks(): boolean;
}
