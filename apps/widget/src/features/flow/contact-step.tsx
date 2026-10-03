import { useFormat } from '@mestechko/booking-ui';
import {
  asDemoPhone,
  formatDemoPhone,
  normalizePhone,
  type BookingContact,
  type BookingQuoteView,
} from '@mestechko/contracts/client';
import { Checkbox, ListGroup, ListItem, Skeleton, TextField } from '@mestechko/ui';
import { CalendarClock, UserRound, Wallet } from 'lucide-react';
import type { TFunction } from 'i18next';
import { AsYouType, type CountryCode } from 'libphonenumber-js/min';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import styles from './widget.module.css';

export interface ContactDraft {
  readonly name: string;
  readonly phone: string;
  readonly comment: string;
  readonly consent: boolean;
}

export interface ContactErrors {
  readonly name?: string;
  readonly phone?: string;
  readonly consent?: string;
}

export const emptyContact: ContactDraft = { name: '', phone: '', comment: '', consent: false };

/** The contact the API accepts, or what to say beside the fields. */
export function checkContact(
  t: TFunction,
  draft: ContactDraft,
  countryCode: string,
): { readonly contact: BookingContact | null; readonly errors: ContactErrors } {
  const phone = normalizePhone(draft.phone, countryCode, { allowDemo: appConfig.demoMode });
  const name = draft.name.trim();
  const errors: ContactErrors = {
    ...(name ? {} : { name: t('contact.nameRequired') }),
    ...(phone ? {} : { phone: t('contact.phoneInvalid') }),
    ...(draft.consent ? {} : { consent: t('contact.consentRequired') }),
  };
  return {
    contact: phone && name && draft.consent ? { name, phone } : null,
    errors,
  };
}

function formatPhoneInput(value: string, country: string): string {
  const demo = asDemoPhone(value);
  return demo ? formatDemoPhone(demo) : new AsYouType(country as CountryCode).input(value);
}

export interface ContactStepProps {
  readonly start: string;
  readonly timeZone: string;
  readonly serviceNames: readonly string[];
  readonly quote: BookingQuoteView | null;
  readonly countryCode: string;
  readonly draft: ContactDraft;
  readonly errors: ContactErrors;
  readonly onChange: (draft: ContactDraft) => void;
}

/** What is booked, for how much, and how to reach the visitor. */
export function ContactStep({
  start,
  timeZone,
  serviceNames,
  quote,
  countryCode,
  draft,
  errors,
  onChange,
}: ContactStepProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const assigned = quote?.assigned ?? null;
  const deposit = quote?.deposit && quote.deposit.amountMinor > 0 ? quote.deposit : null;
  return (
    <>
      <ListGroup>
        <ListItem
          leading={<CalendarClock aria-hidden="true" />}
          title={`${format.instant(start, timeZone, 'weekdayDayMonth')}, ${format.instant(start, timeZone, 'time')}`}
          description={serviceNames.join(', ')}
        />
        <ListItem
          leading={<UserRound aria-hidden="true" />}
          title={
            assigned?.staff.displayName ?? <Skeleton shape="text" width="var(--size-control-lg)" />
          }
          description={assigned?.staff.title ?? undefined}
        />
        <ListItem
          title={t('contact.total')}
          meta={
            assigned ? (
              format.money(assigned.total)
            ) : (
              <Skeleton shape="text" width="var(--size-control-lg)" />
            )
          }
        />
        {deposit && assigned ? (
          <ListItem
            leading={<Wallet aria-hidden="true" />}
            title={t('contact.deposit')}
            description={t('contact.depositHint', {
              rest: format.money({
                amountMinor: Math.max(0, assigned.total.amountMinor - deposit.amountMinor),
                currency: deposit.currency,
              }),
            })}
            meta={format.money(deposit)}
          />
        ) : null}
      </ListGroup>
      <div className={styles.fields}>
        <TextField
          label={t('contact.name')}
          autoComplete="name"
          value={draft.name}
          error={errors.name ?? null}
          onChange={(event) => {
            onChange({ ...draft, name: event.target.value });
          }}
        />
        <TextField
          label={t('contact.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t('contact.phonePlaceholder')}
          description={appConfig.demoMode ? t('contact.demoPhoneHint') : t('contact.phoneHint')}
          value={draft.phone}
          error={errors.phone ?? null}
          onChange={(event) => {
            onChange({ ...draft, phone: event.target.value });
          }}
          onBlur={() => {
            onChange({ ...draft, phone: formatPhoneInput(draft.phone, countryCode) });
          }}
        />
        <TextField
          label={t('contact.comment')}
          multiline
          placeholder={t('contact.commentPlaceholder')}
          value={draft.comment}
          onChange={(event) => {
            onChange({ ...draft, comment: event.target.value });
          }}
        />
        <div className={styles.consent}>
          <Checkbox
            id="widget-consent"
            checked={draft.consent}
            onCheckedChange={(consent) => {
              onChange({ ...draft, consent });
            }}
          />
          <label htmlFor="widget-consent" className={styles.consentLabel}>
            {t('contact.consent')}
          </label>
        </div>
        {errors.consent ? (
          <p className={styles.error} role="alert">
            {errors.consent}
          </p>
        ) : null}
      </div>
    </>
  );
}
