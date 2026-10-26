import {
  clientFileFormatIds,
  clientFileFormats,
  clientTagLimits,
  normalizePhone,
  type ClientFileFormat,
  type ClientImportResult,
  type ServedFile,
  type UploadedFile,
} from '@slotwise/contracts';
import { localDateOf, type Clock, type Locale } from '@slotwise/domain';
import { z } from 'zod';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { CabinetBookings } from '../../booking/application/cabinet/cabinet-bookings.js';
import type { ClientCrmStore } from '../../clients/application/crm-ports.js';
import type { LedgerStore } from '../../loyalty/application/ports.js';
import type { BusinessContext } from '../../tenancy/application/business-context.js';
import { normalizeTags } from './client-cards.js';
import {
  exportColumns,
  importColumns,
  type ImportColumn,
  type SpreadsheetCell,
  type SpreadsheetCodecs,
  type TransferTexts,
} from './spreadsheets.js';

const EXPORT_BATCH = 500;
const MAX_IMPORT_ROWS = 10_000;
const MAX_REJECTED_SHOWN = 100;
const MAX_NAME_LENGTH = 120;
const MAX_NOTE_LENGTH = 2000;
const TAG_SEPARATORS = /[,;]/;
const emailSchema = z.email().max(254);

type RejectReason = ClientImportResult['rejected'][number]['reason'];

interface ImportedRow {
  readonly row: number;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly tags: readonly string[];
  readonly note: string | null;
}

/** Clients to and from spreadsheets: CSV and Excel, matched by phone on import. */
export class ClientTransfer {
  constructor(
    private readonly store: ClientCrmStore,
    private readonly bookings: CabinetBookings,
    private readonly ledger: LedgerStore,
    private readonly codecs: SpreadsheetCodecs,
    private readonly texts: TransferTexts,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * Every client with their visits and points, in batches so memory stays flat. The file's
   * name and column titles are in the reader's language.
   */
  async export(format: ClientFileFormat, timeZone: string, locale: Locale): Promise<ServedFile> {
    const texts = this.texts.exported(locale);
    const rows: SpreadsheetCell[][] = [exportColumns.map((column) => texts.column(column))];
    for (let after: string | null = null; ;) {
      const batch = await this.store.batchAfter(after, EXPORT_BATCH);
      const ids = batch.map((client) => client.id);
      const [stats, points] = await Promise.all([
        this.bookings.statsOf(ids),
        this.ledger.pointsBalances(ids),
      ]);
      for (const client of batch) {
        const visits = stats.get(client.id);
        rows.push([
          client.displayName,
          client.phone,
          client.email,
          client.tags.join(', '),
          visits?.visits ?? 0,
          visits?.noShows ?? 0,
          visits?.lastVisitAt
            ? localDateOf(visits.lastVisitAt.getTime(), timeZone).toString()
            : null,
          points.get(client.id) ?? 0,
        ]);
      }
      const last = batch.at(-1);
      if (!last || batch.length < EXPORT_BATCH) {
        break;
      }
      after = last.id;
    }
    const { mediaType, extension } = clientFileFormats[format];
    return {
      fileName: `${texts.fileName}.${extension}`,
      mediaType,
      content: await this.codecs[format].write(rows),
    };
  }

  /** Adds new clients and updates those whose phone matches; `dryRun` only checks. */
  async import(
    context: BusinessContext,
    file: UploadedFile,
    options: { readonly dryRun: boolean; readonly authorUserId: string },
  ): Promise<ClientImportResult> {
    const format = clientFileFormatIds.find(
      (candidate) => clientFileFormats[candidate].mediaType === file.mediaType,
    );
    if (!format) {
      throw new ApplicationError('validation_failed', 'Unsupported file type');
    }
    const [header = [], ...data] = await this.codecs[format].read(file.content);
    if (data.length > MAX_IMPORT_ROWS) {
      throw new ApplicationError('validation_failed', 'Too many rows', {
        maxRows: MAX_IMPORT_ROWS,
      });
    }
    const columns = this.columnsOf(header);
    if (columns.get('name') === undefined) {
      throw new ApplicationError('validation_failed', 'The file has no name column', {
        reason: 'missing_name_column',
      });
    }
    const rejected: { row: number; reason: RejectReason }[] = [];
    const accepted = new Map<string, ImportedRow>();
    const withoutPhone: ImportedRow[] = [];
    data.forEach((cells, index) => {
      const parsed = this.parseRow(context, cells, columns, index + 2);
      if ('reason' in parsed) {
        rejected.push(parsed);
      } else if (parsed.phone) {
        accepted.set(parsed.phone, parsed);
      } else {
        withoutPhone.push(parsed);
      }
    });
    const existing = await this.store.idsByPhone([...accepted.keys()]);
    const rows = [...accepted.values(), ...withoutPhone];
    const updated = rows.filter((row) => row.phone && existing.has(row.phone)).length;
    if (!options.dryRun) {
      await this.save(rows, existing, options.authorUserId);
    }
    return {
      created: rows.length - updated,
      updated,
      rejected: rejected.slice(0, MAX_REJECTED_SHOWN),
      applied: !options.dryRun,
    };
  }

  private async save(
    rows: readonly ImportedRow[],
    existing: ReadonlyMap<string, string>,
    authorUserId: string,
  ): Promise<void> {
    const now = new Date(this.clock.now().epochMilliseconds);
    for (const row of rows) {
      const matched = row.phone ? existing.get(row.phone) : undefined;
      const clientId = matched ?? this.ids.next();
      if (matched) {
        const current = await this.store.find(matched);
        await this.store.update(
          matched,
          {
            displayName: row.displayName,
            ...(row.email ? { email: row.email } : {}),
            tags: normalizeTags([...(current?.tags ?? []), ...row.tags]),
          },
          now,
        );
      } else {
        await this.store.create(
          clientId,
          { displayName: row.displayName, phone: row.phone, email: row.email, tags: row.tags },
          now,
        );
      }
      if (row.note) {
        await this.store.addNote({
          id: this.ids.next(),
          clientId,
          authorUserId,
          body: row.note,
          now,
        });
      }
    }
  }

  private columnsOf(header: readonly string[]): Map<ImportColumn, number> {
    const columns = new Map<ImportColumn, number>();
    for (const column of importColumns) {
      const names = new Set(this.texts.aliases(column).map((alias) => alias.toLowerCase()));
      const index = header.findIndex((title) => names.has(title.trim().toLowerCase()));
      if (index >= 0) {
        columns.set(column, index);
      }
    }
    return columns;
  }

  private parseRow(
    context: BusinessContext,
    cells: readonly string[],
    columns: ReadonlyMap<ImportColumn, number>,
    row: number,
  ): ImportedRow | { row: number; reason: RejectReason } {
    const cell = (column: ImportColumn) => {
      const index = columns.get(column);
      return index === undefined ? '' : (cells[index] ?? '').trim();
    };
    const displayName = cell('name').slice(0, MAX_NAME_LENGTH);
    if (!displayName) {
      return { row, reason: 'missing_name' };
    }
    const rawPhone = cell('phone');
    const phone = rawPhone
      ? normalizePhone(rawPhone, context.business.countryCode, {
          allowDemo: context.business.isDemo,
        })
      : null;
    if (rawPhone && !phone) {
      return { row, reason: 'invalid_phone' };
    }
    const rawEmail = cell('email');
    if (rawEmail && !emailSchema.safeParse(rawEmail).success) {
      return { row, reason: 'invalid_email' };
    }
    const tags = normalizeTags(cell('tags').split(TAG_SEPARATORS));
    if (
      tags.some((tag) => tag.length > clientTagLimits.maxLength) ||
      tags.length > clientTagLimits.maxCount
    ) {
      return { row, reason: 'invalid_tags' };
    }
    const note = cell('note').slice(0, MAX_NOTE_LENGTH);
    return {
      row,
      displayName,
      phone,
      email: rawEmail || null,
      tags,
      note: note || null,
    };
  }
}
