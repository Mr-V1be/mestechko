import { useFormat } from '@slotwise/booking-ui';
import type { CabinetCatalog, ServiceAdmin } from '@slotwise/contracts/client';
import type { CurrencyCode } from '@slotwise/domain';
import { ListGroup, ListItem, NumberField, Select, Switch, TextField } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import { problemText } from '../../common/field-checks';
import { minorDigits } from '../../common/money';
import { serviceLimits } from '../limits';
import { ServiceChecklist } from '../service-checklist';
import type { DraftProblems, ServiceDraft } from './service-draft';
import { StaffTermsField, type StaffTermsFieldProps } from './staff-terms';
import styles from './editor.module.css';

/** Words of the business's vertical used by the form. */
export interface FormVocabulary {
  readonly staffMany: string;
  readonly resourceOne: string;
  readonly resourceType: (term: string) => string;
}

export interface ServiceFormProps {
  readonly draft: ServiceDraft;
  readonly onChange: (patch: Partial<ServiceDraft>) => void;
  /** Problems to show; `null` until the person first tries to save. */
  readonly problems: DraftProblems | null;
  /** The service as saved; `null` for a new one. */
  readonly saved: ServiceAdmin | null;
  readonly catalog: CabinetCatalog;
  readonly team: StaffTermsFieldProps['team'];
  readonly vocabulary: FormVocabulary;
  readonly currency: CurrencyCode;
  readonly onSetActive: (service: ServiceAdmin, isActive: boolean) => void;
}

/** Resource type ids start with a letter, so this one never collides with them. */
const NO_RESOURCE = '_none';

/** Fields of a service, top to bottom in the order people think about them. */
export function ServiceForm({
  draft,
  onChange,
  problems,
  saved,
  catalog,
  team,
  vocabulary,
  currency,
  onSetActive,
}: ServiceFormProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const minutes = t('services:editor.minutes');
  const currencySymbol = format.currencySymbol(currency);
  const priceDigits = minorDigits(currency);
  const others = catalog.categories.map((category) => ({
    ...category,
    services: category.services.filter((service) => service.id !== saved?.id),
  }));
  return (
    <div className={styles.form}>
      {saved ? (
        <div className={styles.status}>
          <Switch
            checked={saved.isActive}
            label={t('services:editor.active')}
            description={t(
              saved.isActive ? 'services:editor.activeOn' : 'services:editor.activeOff',
            )}
            onCheckedChange={(isActive) => {
              onSetActive(saved, isActive);
            }}
          />
        </div>
      ) : null}
      <TextField
        label={t('services:editor.name')}
        placeholder={t('services:editor.namePlaceholder')}
        value={draft.name}
        maxLength={serviceLimits.nameMax}
        error={problemText(t, problems?.name)}
        onChange={(event) => {
          onChange({ name: event.currentTarget.value });
        }}
      />
      <TextField
        multiline
        label={t('services:editor.description')}
        placeholder={t('services:editor.descriptionPlaceholder')}
        value={draft.description}
        maxLength={serviceLimits.descriptionMax}
        error={problemText(t, problems?.description)}
        onChange={(event) => {
          onChange({ description: event.currentTarget.value });
        }}
      />
      <Select
        label={t('services:editor.category')}
        value={draft.categoryId}
        options={catalog.categories.map((category) => ({
          value: category.id,
          label: category.name,
        }))}
        onChange={(categoryId) => {
          onChange({ categoryId });
        }}
      />
      <div className={styles.pair}>
        <NumberField
          label={t('services:editor.duration')}
          value={draft.durationMinutes}
          min={serviceLimits.durationMin}
          max={serviceLimits.minutesMax}
          suffix={minutes}
          error={problemText(t, problems?.durationMinutes)}
          onChange={(durationMinutes) => {
            onChange({ durationMinutes });
          }}
        />
        <NumberField
          label={t('services:editor.price')}
          value={draft.price}
          min={0}
          suffix={currencySymbol}
          fractionDigits={priceDigits}
          error={problemText(t, problems?.price)}
          onChange={(price) => {
            onChange({ price });
          }}
        />
        <NumberField
          label={t('services:editor.bufferBefore')}
          value={draft.bufferBeforeMinutes}
          min={0}
          max={serviceLimits.minutesMax}
          placeholder="0"
          suffix={minutes}
          error={problemText(t, problems?.bufferBeforeMinutes)}
          onChange={(bufferBeforeMinutes) => {
            onChange({ bufferBeforeMinutes });
          }}
        />
        <NumberField
          label={t('services:editor.bufferAfter')}
          value={draft.bufferAfterMinutes}
          min={0}
          max={serviceLimits.minutesMax}
          placeholder="0"
          suffix={minutes}
          error={problemText(t, problems?.bufferAfterMinutes)}
          onChange={(bufferAfterMinutes) => {
            onChange({ bufferAfterMinutes });
          }}
        />
      </div>
      <Select
        label={vocabulary.resourceOne}
        value={draft.resourceTypeId ?? NO_RESOURCE}
        options={[
          { value: NO_RESOURCE, label: t('services:editor.noResource') },
          ...catalog.resourceTypes.map((type) => ({
            value: type.id,
            label: vocabulary.resourceType(type.term),
          })),
        ]}
        onChange={(value) => {
          onChange({ resourceTypeId: value === NO_RESOURCE ? null : value });
        }}
      />
      <div className={styles.deposit}>
        <Switch
          checked={draft.ownDeposit}
          label={t('services:editor.ownDeposit')}
          description={
            draft.ownDeposit
              ? undefined
              : t('services:editor.ruleDeposit', { percent: catalog.depositPercent })
          }
          onCheckedChange={(ownDeposit) => {
            onChange({
              ownDeposit,
              depositPercent: draft.depositPercent ?? catalog.depositPercent,
            });
          }}
        />
        {draft.ownDeposit ? (
          <NumberField
            className={styles.half}
            label={t('services:editor.depositPercent')}
            value={draft.depositPercent}
            min={0}
            max={serviceLimits.percentMax}
            suffix={t('services:editor.percent')}
            error={problemText(t, problems?.depositPercent)}
            onChange={(depositPercent) => {
              onChange({ depositPercent });
            }}
          />
        ) : null}
      </div>
      <StaffTermsField
        title={vocabulary.staffMany}
        team={team}
        value={draft.staff}
        onChange={(staff) => {
          onChange({ staff });
        }}
        problems={problems?.staff ?? null}
        base={{ durationMinutes: draft.durationMinutes, price: draft.price }}
        minutesUnit={minutes}
        currencySymbol={currencySymbol}
        priceDigits={priceDigits}
      />
      <section className={styles.incompatible}>
        <h3 className={styles.sectionTitle}>{t('services:editor.incompatible')}</h3>
        {others.some((category) => category.services.length > 0) ? (
          <ServiceChecklist
            categories={others}
            selected={draft.incompatibleWith}
            onChange={(incompatibleWith) => {
              onChange({ incompatibleWith });
            }}
          />
        ) : (
          <ListGroup>
            <ListItem title={t('services:editor.noOtherServices')} />
          </ListGroup>
        )}
      </section>
    </div>
  );
}
