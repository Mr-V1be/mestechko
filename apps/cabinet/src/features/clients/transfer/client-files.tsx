import {
  ApiError,
  clientFileFormatIds,
  clientFileFormats,
  type ClientFileFormat,
} from '@mestechko/contracts/client';
import { useLocale } from '@mestechko/booking-ui';
import { useToast, type MenuAction } from '@mestechko/ui';
import type { TFunction } from 'i18next';
import { FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../platform/api/api-context';
import { errorMessage } from '../../common/error-message';

const BYTES_PER_MEGABYTE = 1024 * 1024;

/** Every format the API reads and writes has an icon; a new format is one entry. */
const formatIcons: Readonly<Record<ClientFileFormat, LucideIcon>> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
};

/** The file picker offers the formats the API reads, by extension and media type. */
export const clientFileAccept = clientFileFormatIds
  .flatMap((id) => [`.${clientFileFormats[id].extension}`, clientFileFormats[id].mediaType])
  .join(',');

/**
 * The file typed the way the API expects. Browsers report CSV under different media
 * types (on Windows, as an Excel file), so the type follows the extension instead.
 */
export function asClientFile(file: File): Blob | null {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const format = clientFileFormatIds.find((id) => clientFileFormats[id].extension === extension);
  return format ? new Blob([file], { type: clientFileFormats[format].mediaType }) : null;
}

/** Why a file was refused: too large for the API, or what the API said about it. */
export function importFailureMessage(t: TFunction, error: unknown): string {
  const maxBytes =
    error instanceof ApiError
      ? (error.details as { maxBytes?: unknown } | undefined)?.maxBytes
      : null;
  return typeof maxBytes === 'number'
    ? t('clients:import.tooLarge', { size: Math.floor(maxBytes / BYTES_PER_MEGABYTE) })
    : errorMessage(t, error);
}

/**
 * Downloads of the whole client base, one per format; the browser saves the file. The
 * link names the reader's language, since the browser follows it with its own.
 */
export function useExportActions(businessId: string): MenuAction[] {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const api = useApi();
  const toast = useToast();
  return clientFileFormatIds.map((format) => {
    const Icon = formatIcons[format];
    const name = t(`clients:transfer.formats.${format}`);
    return {
      key: `export-${format}`,
      label: t('clients:transfer.export', { format: name }),
      icon: <Icon aria-hidden="true" />,
      href: api.href('exportClients', { params: { businessId }, query: { format, locale } }),
      download: true,
      onSelect: () => {
        toast.show({ title: t('clients:transfer.exportStarted', { format: name }) });
      },
    };
  });
}
