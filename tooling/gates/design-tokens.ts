/**
 * Design-token gate: component styles and markup use tokens of the design system,
 * never literal colors, lengths or durations. Token sheets are the only exception;
 * media queries may use pixel breakpoints because custom properties are not allowed there.
 */
import { read, report, walk, workspaceRoots } from './walk.ts';

const TOKEN_SHEET_DIRECTORY = 'packages/ui/src/styles/tokens/';
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/;
const NAMED_COLOR =
  /(?:^|[\s:,(])(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|brown|silver|gold|navy|teal)(?=[\s;,)!]|$)/;
const LENGTH_LITERAL = /(?<![\w-])\d*\.?\d+(?:px|rem)\b/;
const DURATION_LITERAL = /(?<![\w-])\d*\.?\d+m?s\b/;
const DURATION_PROPERTY = /^\s*(?:transition|animation)[\w-]*\s*:/;

const violations: string[] = [];

for (const file of walk(workspaceRoots(['src']), (path) => path.endsWith('.css'))) {
  if (file.includes(TOKEN_SHEET_DIRECTORY)) {
    continue;
  }
  read(file)
    .split('\n')
    .forEach((line, index) => {
      const location = `${file}:${String(index + 1)}`;
      const code = line.replace(/\/\*.*?\*\//g, '');
      if (/^\s*@(?:media|container)\b/.test(code)) {
        return;
      }
      if (COLOR_LITERAL.test(code) || NAMED_COLOR.test(code)) {
        violations.push(`${location}: color literal — use a color token`);
      }
      if (LENGTH_LITERAL.test(code)) {
        violations.push(`${location}: length literal — use a size, space or radius token`);
      }
      if (DURATION_PROPERTY.test(code) && DURATION_LITERAL.test(code)) {
        violations.push(`${location}: duration literal — use a motion token`);
      }
    });
}

for (const file of walk(workspaceRoots(['src']), (path) => path.endsWith('.tsx'))) {
  read(file)
    .split('\n')
    .forEach((line, index) => {
      if (COLOR_LITERAL.test(line.replace(/\/\/.*$/, ''))) {
        violations.push(
          `${file}:${String(index + 1)}: color literal in markup — use a color token`,
        );
      }
    });
}

report('design tokens', violations);
