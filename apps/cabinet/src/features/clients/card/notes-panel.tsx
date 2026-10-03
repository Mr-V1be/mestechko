import type { ClientNote } from '@mestechko/contracts/client';
import { Button, ConfirmDialog, IconButton, ListGroup, TextField, useToast } from '@mestechko/ui';
import { clsx } from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isPendingNote,
  useAddClientNote,
  useDeleteClientNote,
} from '../../../platform/api/clients-queries';
import { useSession } from '../../../platform/session/session-context';
import { errorMessage } from '../../common/error-message';
import { useClientDates } from '../client-dates';
import styles from './card.module.css';

/** Long notes are named by their beginning in the delete confirmation. */
const EXCERPT_LENGTH = 60;

function excerptOf(body: string): string {
  const line = body.replace(/\s+/g, ' ').trim();
  return line.length > EXCERPT_LENGTH ? `${line.slice(0, EXCERPT_LENGTH).trimEnd()}…` : line;
}

export interface NotesPanelProps {
  readonly businessId: string;
  readonly clientId: string;
  readonly notes: readonly ClientNote[];
  readonly timeZone: string;
}

/** Notes about the client, newest first; people delete their own. */
export function NotesPanel({ businessId, clientId, notes, timeZone }: NotesPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const me = useSession();
  const dates = useClientDates(timeZone);
  const [draft, setDraft] = useState('');
  // The note stays named while the confirmation closes.
  const [deleting, setDeleting] = useState<ClientNote | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const add = useAddClientNote(businessId, clientId, me.user.displayName);
  const remove = useDeleteClientNote(businessId, clientId);
  // Notes carry their author's name only, so a note is someone's own by that name.
  const isOwn = (note: ClientNote) => note.authorName === me.user.displayName;

  const submit = (event?: SyntheticEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) {
      return;
    }
    setDraft('');
    add.mutate(body, {
      onError: (error) => {
        setDraft((current) => current || body);
        toast.show({
          title: t('clients:notes.addFailed'),
          description: errorMessage(t, error),
          tone: 'error',
        });
      },
    });
  };
  const confirmDelete = () => {
    setConfirmOpen(false);
    if (!deleting) {
      return;
    }
    remove.mutate(deleting, {
      onSuccess: () => {
        toast.show({ title: t('clients:notes.deleted') });
      },
      onError: (error) => {
        toast.show({
          title: t('clients:notes.deleteFailed'),
          description: errorMessage(t, error),
          tone: 'error',
        });
      },
    });
  };

  return (
    <>
      <ListGroup title={t('clients:notes.title')}>
        <li className={styles.composer}>
          <form className={styles.composerForm} onSubmit={submit}>
            <TextField
              multiline
              label={t('clients:notes.new')}
              hideLabel
              placeholder={t('clients:notes.placeholder')}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  submit();
                }
              }}
            />
            <Button
              type="submit"
              variant="secondary"
              icon={<Plus />}
              className={styles.composerSubmit}
              disabled={draft.trim() === ''}
            >
              {t('clients:notes.add')}
            </Button>
          </form>
        </li>
        {notes.length === 0 ? (
          <li className={styles.noteEmpty}>{t('clients:notes.empty')}</li>
        ) : null}
        {notes.map((note) => {
          const pending = isPendingNote(note);
          return (
            <li key={note.id} className={clsx(styles.note, pending && styles.pending)}>
              <p className={styles.noteBody}>{note.body}</p>
              <div className={styles.noteMeta}>
                <span>
                  {[
                    note.authorName,
                    pending ? t('clients:notes.saving') : dates.dayTime(note.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {isOwn(note) && !pending ? (
                  <IconButton
                    label={t('clients:notes.delete')}
                    icon={<Trash2 />}
                    className={styles.noteDelete}
                    onClick={() => {
                      setDeleting(note);
                      setConfirmOpen(true);
                    }}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ListGroup>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('clients:notes.deleteTitle')}
        consequence={t('clients:notes.deleteConsequence', {
          excerpt: deleting ? excerptOf(deleting.body) : '',
        })}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        closeLabel={t('common:actions.close')}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </>
  );
}
