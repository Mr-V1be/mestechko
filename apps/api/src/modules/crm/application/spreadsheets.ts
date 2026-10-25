import type { ClientFileFormat } from '@mestechko/contracts';
import type { Locale } from '@mestechko/domain';

export type SpreadsheetCell = string | number | null;

/** Reads and writes one spreadsheet format; rows are plain cells, first row the header. */
export interface SpreadsheetCodec {
  read(content: Uint8Array): Promise<string[][]>;
  write(rows: readonly (readonly SpreadsheetCell[])[]): Promise<Uint8Array>;
}

export type SpreadsheetCodecs = Readonly<Record<ClientFileFormat, SpreadsheetCodec>>;

/** Words of the spreadsheet columns, from the translation system. */
export interface TransferTexts {
  /** The name of an exported file and its column titles, in the reader's language. */
  exported(locale: Locale): {
    readonly fileName: string;
    column(key: TransferColumn): string;
  };
  /** Header titles that name the column in files people bring, in any language. */
  aliases(key: ImportColumn): readonly string[];
}

export const exportColumns = [
  'name',
  'phone',
  'email',
  'tags',
  'visits',
  'noShows',
  'lastVisit',
  'points',
] as const;
export const importColumns = ['name', 'phone', 'email', 'tags', 'note'] as const;
export type TransferColumn = (typeof exportColumns)[number] | (typeof importColumns)[number];
export type ImportColumn = (typeof importColumns)[number];

export const SPREADSHEET_CODECS = Symbol('SPREADSHEET_CODECS');
export const TRANSFER_TEXTS = Symbol('TRANSFER_TEXTS');
