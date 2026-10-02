import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.output',
  'generated',
  '.git',
]);

/** Every file under the roots (relative to the repository), skipping build output and generated code. */
export function walk(roots: readonly string[], accept: (path: string) => boolean): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry)) {
          visit(path);
        }
      } else if (accept(path)) {
        files.push(relative(repositoryRoot, path));
      }
    }
  };
  roots.forEach((root) => {
    visit(join(repositoryRoot, root));
  });
  return files.sort();
}

export function read(path: string): string {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

export function workspaceRoots(subdirectories: readonly string[]): string[] {
  const roots: string[] = [];
  for (const group of ['apps', 'packages']) {
    for (const workspace of readdirSync(join(repositoryRoot, group))) {
      for (const subdirectory of subdirectories) {
        roots.push(join(group, workspace, subdirectory));
      }
    }
  }
  return roots;
}

export function report(gate: string, violations: readonly string[]): void {
  if (violations.length > 0) {
    console.error(`✗ ${gate}: ${String(violations.length)} violation(s)`);
    violations.forEach((violation) => {
      console.error(`  ${violation}`);
    });
    process.exit(1);
  }
  console.log(`✓ ${gate}`);
}
