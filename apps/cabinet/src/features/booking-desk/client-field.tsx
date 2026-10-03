import { formatPhone } from '@mestechko/booking-ui';
import type { DeskClient } from '@mestechko/contracts/client';
import { ListGroup, ListItem, SegmentedControl, TextField } from '@mestechko/ui';
import { Check, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClientSearch } from '../../platform/api/desk-queries';
import styles from './desk.module.css';

type Mode = 'existing' | 'new';

export interface ClientDraft {
  readonly mode: Mode;
  readonly clientId: string | null;
  readonly clientName: string;
  readonly name: string;
  readonly phone: string;
}

export const emptyClient = (canSearch: boolean): ClientDraft => ({
  mode: canSearch ? 'existing' : 'new',
  clientId: null,
  clientName: '',
  name: '',
  phone: '',
});

export interface ClientFieldProps {
  readonly businessId: string;
  /** Whether the viewer may look clients up; otherwise only a new client is offered. */
  readonly canSearch: boolean;
  readonly value: ClientDraft;
  readonly onChange: (value: ClientDraft) => void;
  readonly errors: { readonly name?: string | null; readonly phone?: string | null };
}

/** Who is booked: someone from the client base, or a new person by name and phone. */
export function ClientField({ businessId, canSearch, value, onChange, errors }: ClientFieldProps) {
  const { t } = useTranslation('desk');
  const [search, setSearch] = useState('');
  const results = useClientSearch(businessId, search, canSearch && value.mode === 'existing');
  const items = results.data?.items ?? [];
  return (
    <>
      {canSearch ? (
        <SegmentedControl
          label={t('client.mode')}
          value={value.mode}
          block
          segments={[
            { value: 'existing', label: t('client.existing') },
            { value: 'new', label: t('client.new') },
          ]}
          onChange={(mode) => {
            onChange({ ...value, mode });
          }}
        />
      ) : null}
      {value.mode === 'existing' ? (
        <>
          <TextField
            label={t('client.search')}
            placeholder={t('client.searchPlaceholder')}
            value={search}
            type="search"
            autoComplete="off"
            onChange={(event) => {
              setSearch(event.currentTarget.value);
            }}
          />
          {items.length > 0 ? (
            <ListGroup>
              {items.map((client) => (
                <ListItem
                  key={client.id}
                  leading={<UserRound aria-hidden="true" />}
                  title={client.displayName}
                  description={client.phone ? formatPhone(client.phone) : undefined}
                  selected={client.id === value.clientId}
                  trailing={client.id === value.clientId ? <Check aria-hidden="true" /> : undefined}
                  onClick={() => {
                    onChange({ ...value, clientId: client.id, clientName: client.displayName });
                  }}
                />
              ))}
            </ListGroup>
          ) : search.trim().length >= 2 && results.isSuccess ? (
            <p className={styles.hint}>{t('client.noMatches')}</p>
          ) : null}
          {errors.name ? <p className={styles.error}>{errors.name}</p> : null}
        </>
      ) : (
        <div className={styles.row}>
          <TextField
            label={t('client.name')}
            value={value.name}
            autoComplete="off"
            error={errors.name ?? null}
            onChange={(event) => {
              onChange({ ...value, name: event.currentTarget.value });
            }}
          />
          <TextField
            label={t('client.phone')}
            type="tel"
            inputMode="tel"
            value={value.phone}
            description={t('client.phoneHint')}
            error={errors.phone ?? null}
            onChange={(event) => {
              onChange({ ...value, phone: event.currentTarget.value });
            }}
          />
        </div>
      )}
    </>
  );
}

/** The client as the API takes it, or which field to fix. */
export function deskClientOf(
  draft: ClientDraft,
  normalize: (phone: string) => string | null,
):
  | { readonly client: DeskClient }
  | { readonly error: 'pickRequired' | 'nameRequired' | 'phoneInvalid' } {
  if (draft.mode === 'existing') {
    return draft.clientId
      ? { client: { kind: 'existing', clientId: draft.clientId } }
      : { error: 'pickRequired' };
  }
  if (draft.name.trim() === '') {
    return { error: 'nameRequired' };
  }
  const phone = draft.phone.trim() === '' ? null : normalize(draft.phone);
  if (draft.phone.trim() !== '' && !phone) {
    return { error: 'phoneInvalid' };
  }
  return { client: { kind: 'new', name: draft.name.trim(), phone } };
}
