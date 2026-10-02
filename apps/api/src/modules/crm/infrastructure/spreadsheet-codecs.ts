import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readSheet } from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import type {
  SpreadsheetCell,
  SpreadsheetCodec,
  SpreadsheetCodecs,
} from '../application/spreadsheets.js';

/** Excel opens UTF-8 CSV with Cyrillic correctly only with a byte order mark. */
const BYTE_ORDER_MARK = '\uFEFF';
const BYTE_ORDER_MARK_AT_START = /^\uFEFF/;
/** Spreadsheet software in Russia separates CSV fields with semicolons. */
const CSV_DELIMITER = ';';

const cellText = (cell: unknown): string =>
  cell === null || cell === undefined
    ? ''
    : cell instanceof Date
      ? cell.toISOString()
      : typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean'
        ? String(cell).trim()
        : '';

const csvCodec: SpreadsheetCodec = {
  read: (content) => {
    const text = Buffer.from(content).toString('utf8').replace(BYTE_ORDER_MARK_AT_START, '');
    const rows: unknown[][] = parse(text, {
      delimiter: [CSV_DELIMITER, ',', '\t'],
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });
    return Promise.resolve(rows.map((row) => row.map(cellText)));
  },
  write: (rows) =>
    Promise.resolve(
      Buffer.from(
        `${BYTE_ORDER_MARK}${stringify(
          rows.map((row) => row.map((cell) => cell ?? '')),
          {
            delimiter: CSV_DELIMITER,
          },
        )}`,
        'utf8',
      ),
    ),
};

const xlsxCodec: SpreadsheetCodec = {
  read: async (content) => {
    const rows = await readSheet(Buffer.from(content));
    return rows.map((row) => row.map(cellText));
  },
  write: async (rows) => {
    const data = rows.map((row) =>
      row.map((cell: SpreadsheetCell) =>
        cell === null ? null : { value: cell, type: typeof cell === 'number' ? Number : String },
      ),
    );
    return writeXlsxFile(data).toBuffer();
  },
};

/** Codecs by file format: CSV and Excel workbooks. */
export const spreadsheetCodecs: SpreadsheetCodecs = { csv: csvCodec, xlsx: xlsxCodec };
