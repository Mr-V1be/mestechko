/**
 * Translation gate: every language has the same texts. For each `locales` folder of a
 * workspace (`<locale>/<namespace>.json` or `<locale>.json`), every language the
 * platform speaks has every namespace, the same keys, the same placeholders per key and
 * exactly the plural forms its grammar needs.
 */
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fallbackLocale, localeIds } from '../../packages/domain/src/locales/locales.ts';
import { read, report, repositoryRoot, walk, workspaceRoots } from './walk.ts';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /\{\{\s*([\w.]+)[^}]*\}\}/g;

interface Entry {
  readonly kind: 'text' | 'list';
  readonly placeholders: ReadonlySet<string>;
  readonly pluralForms: ReadonlySet<string>;
}

function placeholdersOf(value: Json): string[] {
  const texts = Array.isArray(value) ? value : [value];
  return texts.flatMap((text) =>
    typeof text === 'string' ? [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '') : [],
  );
}

/**
 * Keys of a namespace with plural forms folded into one entry. A suffix counts as a
 * plural form only beside its `_other` sibling, so a key like `two_two` stays a key.
 */
function entriesOf(texts: Json, prefix = '', into = new Map<string, Entry>()): Map<string, Entry> {
  if (typeof texts !== 'object' || texts === null || Array.isArray(texts)) {
    return into;
  }
  for (const [key, value] of Object.entries(texts)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      entriesOf(value, path, into);
      continue;
    }
    const suffix = PLURAL_SUFFIX.exec(key)?.[1];
    const form = suffix && `${key.slice(0, -suffix.length - 1)}_other` in texts ? suffix : null;
    const base = form ? path.slice(0, -form.length - 1) : path;
    const known = into.get(base);
    into.set(base, {
      kind: Array.isArray(value) ? 'list' : 'text',
      placeholders: new Set([...(known?.placeholders ?? []), ...placeholdersOf(value)]),
      pluralForms: new Set([...(known?.pluralForms ?? []), ...(form ? [form] : [])]),
    });
  }
  return into;
}

/** Namespace files of one language in a `locales` folder, by namespace name. */
function namespacesOf(folder: string, locale: string): Map<string, string> {
  const nested = join(folder, locale);
  const absolute = join(repositoryRoot, nested);
  try {
    if (statSync(absolute).isDirectory()) {
      return new Map(
        readdirSync(absolute)
          .filter((file) => file.endsWith('.json'))
          .map((file) => [basename(file, '.json'), join(nested, file)]),
      );
    }
  } catch {
    // A single-file folder keeps one namespace per language: `<locale>.json`.
  }
  const single = join(folder, `${locale}.json`);
  try {
    statSync(join(repositoryRoot, single));
    return new Map([[basename(folder), single]]);
  } catch {
    return new Map();
  }
}

const folders = [
  ...new Set(
    walk(workspaceRoots(['src']), (path) => /\/locales\/.+\.json$/.test(path)).map((path) => {
      const parts = path.split('/');
      return parts.slice(0, parts.lastIndexOf('locales') + 1).join('/');
    }),
  ),
];
const violations: string[] = [];

for (const folder of folders) {
  const reference = namespacesOf(folder, fallbackLocale);
  for (const locale of localeIds) {
    const namespaces = namespacesOf(folder, locale);
    const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    for (const name of new Set([...reference.keys(), ...namespaces.keys()])) {
      const referenceFile = reference.get(name);
      const file = namespaces.get(name);
      if (!file || !referenceFile) {
        violations.push(
          `${folder}: namespace "${name}" is missing in ${file ? fallbackLocale : locale}`,
        );
        continue;
      }
      const expected = entriesOf(JSON.parse(read(referenceFile)) as Json);
      const actual = entriesOf(JSON.parse(read(file)) as Json);
      for (const key of new Set([...expected.keys(), ...actual.keys()])) {
        const want = expected.get(key);
        const have = actual.get(key);
        if (!want || !have) {
          violations.push(
            `${file}: "${key}" ${have ? 'is not in' : 'is missing from'} ${fallbackLocale}`,
          );
          continue;
        }
        if (want.kind !== have.kind) {
          violations.push(
            `${file}: "${key}" is a ${have.kind}, ${fallbackLocale} has a ${want.kind}`,
          );
        }
        const placeholders = [...want.placeholders].sort().join(',');
        if ([...have.placeholders].sort().join(',') !== placeholders) {
          violations.push(`${file}: "${key}" placeholders differ from ${fallbackLocale}`);
        }
        const forms = [...have.pluralForms].sort().join(',');
        if (want.pluralForms.size > 0 && forms !== [...required].sort().join(',')) {
          violations.push(`${file}: "${key}" needs plural forms ${required.join(', ')}`);
        }
      }
    }
  }
}

report(`translations (${String(folders.length)} folders, ${localeIds.join(', ')})`, violations);
