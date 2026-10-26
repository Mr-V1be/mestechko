import type { ClientImportResult } from '@slotwise/contracts/client';
import { Button, Dialog, FileButton, Spinner, StatTile, useToast } from '@slotwise/ui';
import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImportClients } from '../../../platform/api/clients-queries';
import { FormFailure } from '../form-failure';
import { asClientFile, clientFileAccept, importFailureMessage } from './client-files';
import styles from './transfer.module.css';

/** Columns the API reads, in the order a template would have them. */
const importColumns = ['name', 'phone', 'email', 'tags', 'note'] as const;

type ImportStep =
  | { readonly kind: 'pick' }
  | { readonly kind: 'checking'; readonly fileName: string }
  | {
      readonly kind: 'checked';
      readonly fileName: string;
      readonly file: Blob;
      readonly result: ClientImportResult;
    }
  | { readonly kind: 'failed'; readonly fileName: string; readonly message: string };

export interface ImportDialogProps {
  readonly businessId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Clients from a spreadsheet: the file is checked first (nothing changes), the dialog
 * shows what would be added, updated and skipped, and only then is it imported.
 */
export function ImportDialog({ businessId, open, onOpenChange }: ImportDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [step, setStep] = useState<ImportStep>({ kind: 'pick' });
  const [applyFailure, setApplyFailure] = useState<string | null>(null);
  const check = useImportClients(businessId);
  const apply = useImportClients(businessId);
  /** Checks that finish after the dialog closed or another file was picked are dropped. */
  const run = useRef(0);

  const close = () => {
    run.current += 1;
    setStep({ kind: 'pick' });
    setApplyFailure(null);
    onOpenChange(false);
  };
  const pick = (file: File) => {
    const typed = asClientFile(file);
    setApplyFailure(null);
    if (!typed) {
      setStep({ kind: 'failed', fileName: file.name, message: t('clients:import.wrongType') });
      return;
    }
    const current = ++run.current;
    setStep({ kind: 'checking', fileName: file.name });
    check.mutate(
      { file: typed, dryRun: true },
      {
        onSuccess: (result) => {
          if (current === run.current) {
            setStep({ kind: 'checked', fileName: file.name, file: typed, result });
          }
        },
        onError: (error) => {
          if (current === run.current) {
            setStep({
              kind: 'failed',
              fileName: file.name,
              message: importFailureMessage(t, error),
            });
          }
        },
      },
    );
  };
  const importFile = (file: Blob) => {
    setApplyFailure(null);
    apply.mutate(
      { file, dryRun: false },
      {
        onSuccess: (result) => {
          toast.show({
            title: t('clients:import.done', { created: result.created, updated: result.updated }),
          });
          close();
        },
        onError: (error) => {
          setApplyFailure(importFailureMessage(t, error));
        },
      },
    );
  };

  const picker = (label: string, variant: 'primary' | 'secondary') => (
    <FileButton
      variant={variant}
      icon={<FileUp />}
      accept={clientFileAccept}
      disabled={step.kind === 'checking' || apply.isPending}
      onFile={pick}
    >
      {label}
    </FileButton>
  );
  const footer =
    step.kind === 'checked' ? (
      <>
        {picker(t('clients:import.pickAnother'), 'secondary')}
        <Button
          loading={apply.isPending}
          disabled={step.result.created + step.result.updated === 0}
          onClick={() => {
            importFile(step.file);
          }}
        >
          {t('clients:import.submit')}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={close}>
          {t('common:actions.cancel')}
        </Button>
        {picker(
          t(step.kind === 'pick' ? 'clients:import.pick' : 'clients:import.pickAnother'),
          'primary',
        )}
      </>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
        } else {
          close();
        }
      }}
      title={t('clients:import.title')}
      closeLabel={t('common:actions.close')}
      footer={footer}
    >
      <div className={styles.body}>
        {step.kind === 'pick' ? <ColumnsGuide /> : null}
        {step.kind === 'checking' ? (
          <p className={styles.progress} role="status">
            <Spinner />
            {t('clients:import.checking', { file: step.fileName })}
          </p>
        ) : null}
        {step.kind === 'failed' ? (
          <>
            <p className={styles.file}>{t('clients:import.fileLabel', { file: step.fileName })}</p>
            <FormFailure>{step.message}</FormFailure>
            <ColumnsGuide />
          </>
        ) : null}
        {step.kind === 'checked' ? (
          <CheckResult fileName={step.fileName} result={step.result} />
        ) : null}
        {applyFailure ? <FormFailure>{applyFailure}</FormFailure> : null}
      </div>
    </Dialog>
  );
}

function ColumnsGuide() {
  const { t } = useTranslation();
  return (
    <>
      <p className={styles.lead}>{t('clients:import.lead')}</p>
      <ul className={styles.rows}>
        {importColumns.map((column) => {
          const hint = t(`clients:import.columnHints.${column}`);
          return (
            <li key={column} className={styles.row}>
              <span className={styles.rowName}>{t(`clients:import.columns.${column}`)}</span>
              {hint ? <span className={styles.rowHint}>{hint}</span> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CheckResult({
  fileName,
  result,
}: {
  readonly fileName: string;
  readonly result: ClientImportResult;
}) {
  const { t } = useTranslation();
  const nothing = result.created + result.updated === 0;
  return (
    <>
      <p className={styles.file}>{t('clients:import.fileLabel', { file: fileName })}</p>
      <div className={styles.summary}>
        <StatTile label={t('clients:import.created')} value={result.created} />
        <StatTile label={t('clients:import.updated')} value={result.updated} />
        <StatTile label={t('clients:import.rejected')} value={result.rejected.length} />
      </div>
      {nothing ? <FormFailure>{t('clients:import.nothingToImport')}</FormFailure> : null}
      {result.rejected.length > 0 ? (
        <section className={styles.rejected}>
          <h3 className={styles.rejectedTitle}>{t('clients:import.rejectedTitle')}</h3>
          <ul className={styles.rows}>
            {result.rejected.map((entry) => (
              <li key={entry.row} className={styles.row}>
                <span className={styles.rowName}>
                  {t('clients:import.rejectedRow', { row: entry.row })}
                </span>
                <span className={styles.rowHint}>
                  {t(`clients:import.reasons.${entry.reason}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
