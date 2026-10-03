import { useFormat } from '@mestechko/booking-ui';
import { asDemoPhone, formatDemoPhone, type BookingQuoteView } from '@mestechko/contracts/client';
import { Checkbox, ListGroup, ListItem, Skeleton, TextField } from '@mestechko/ui';
import { CalendarClock, UserRound, Wallet } from 'lucide-react';
import { AsYouType, type CountryCode } from 'libphonenumber-js/min';
import { useTranslation } from 'react-i18next';
import type { ContactDraft, ContactErrors } from './contact-check';
import { appConfig } from '../../app/config';
import styles from './widget.module.css';

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
