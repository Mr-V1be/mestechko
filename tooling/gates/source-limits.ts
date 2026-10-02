/**
 * Code shape gate: a handwritten source file stays within 700 lines and a folder
 * holds at most 15 source files directly. Generated files are exempt.
 */
import { dirname } from 'node:path';
import { read, report, walk, workspaceRoots } from './walk.ts';

const MAX_FILE_LINES = 700;
const MAX_FILES_PER_FOLDER = 15;
const SOURCE_FILE = /\.(ts|tsx|js|mjs|cjs|css)$/;
const GENERATED_MARKER = /@generated|This file was generated/;

const files = walk([...workspaceRoots(['src', 'test', 'scripts']), 'tooling'], (path) =>
  SOURCE_FILE.test(path),
);
const violations: string[] = [];
const perFolder = new Map<string, number>();

for (const file of files) {
  const content = read(file);
  if (GENERATED_MARKER.test(content.slice(0, 300))) {
    continue;
  }
  const lines = content.split('\n').length;
  if (lines > MAX_FILE_LINES) {
    violations.push(`${file}: ${String(lines)} lines (max ${String(MAX_FILE_LINES)})`);
  }
  perFolder.set(dirname(file), (perFolder.get(dirname(file)) ?? 0) + 1);
}
for (const [folder, count] of perFolder) {
  if (count > MAX_FILES_PER_FOLDER) {
    violations.push(
      `${folder}/: ${String(count)} source files (max ${String(MAX_FILES_PER_FOLDER)})`,
    );
  }
}

report(`source limits (${String(files.length)} files)`, violations);
