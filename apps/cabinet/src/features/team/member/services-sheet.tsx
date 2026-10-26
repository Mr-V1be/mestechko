import { useFormat } from '@slotwise/booking-ui';
import type { CabinetCatalog, ServiceAdmin, TeamMember } from '@slotwise/contracts/client';
import {
  Badge,
  Button,
  Checkbox,
  ListGroup,
  ListItem,
  NumberField,
  Sheet,
  useToast,
} from '@slotwise/ui';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetTeamMemberServices } from '../../../platform/api/team-queries';
import { errorMessage } from '../../common/error-message';
import { minorDigits, toMajor, toMinor } from '../../common/money';
import styles from './member.module.css';

/** Durations the API accepts for a personal service, in minutes. */
const DURATION_LIMITS = { min: 1, max: 720 } as const;

/** Personal terms as typed: `null` keeps the service's own duration or price. */
interface Terms {
  readonly duration: number | null;
  /** In major units, e.g. roubles. */
  readonly price: number | null;
}

const durationFits = (duration: number | null) =>
  duration === null ||
  (Number.isInteger(duration) &&
    duration >= DURATION_LIMITS.min &&
    duration <= DURATION_LIMITS.max);

const priceFits = (price: number | null) => price === null || price >= 0;

function initialTerms(member: TeamMember): Map<string, Terms> {
  return new Map(
    member.services.map((service) => [
      service.serviceId,
      {
        duration: service.durationMinutes,
        price: service.price ? toMajor(service.price.amountMinor, service.price.currency) : null,
      },
    ]),
  );
}

function ServiceRow({
  service,
  terms,
  onChange,
}: {
  readonly service: ServiceAdmin;
  readonly terms: Terms | undefined;
  readonly onChange: (terms: Terms | undefined) => void;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const id = useId();
  const currency = service.price.currency;
  return (
    <ListItem
      controlId={id}
      leading={
        <Checkbox
          id={id}
          checked={terms !== undefined}
          onCheckedChange={(checked) => {
            onChange(checked ? { duration: null, price: null } : undefined);
          }}
        />
      }
      title={service.name}
      description={t('services.terms', {
        duration: format.duration(service.durationMinutes),
        price: format.money(service.price),
      })}
      meta={service.isActive ? undefined : <Badge>{t('services.inactive')}</Badge>}
    >
      {terms ? (
        <div className={styles.terms}>
          <NumberField
            label={t('services.duration')}
            value={terms.duration}
            min={DURATION_LIMITS.min}
            max={DURATION_LIMITS.max}
            placeholder={String(service.durationMinutes)}
            suffix={t('services.minutes')}
            error={durationFits(terms.duration) ? null : t('services.durationRange')}
            onChange={(duration) => {
              onChange({ ...terms, duration });
            }}
          />
          <NumberField
            label={t('services.price')}
            value={terms.price}
            min={0}
            fractionDigits={minorDigits(currency)}
            placeholder={String(toMajor(service.price.amountMinor, currency))}
            suffix={format.currencySymbol(currency)}
            onChange={(price) => {
              onChange({ ...terms, price });
            }}
          />
        </div>
      ) : null}
    </ListItem>
  );
}

/** Which services the person provides, each at the service's terms or their own. */
export function ServicesSheet({
  businessId,
  member,
  catalog,
  open,
  onOpenChange,
  onSaved,
}: {
  readonly businessId: string;
  readonly member: TeamMember;
  readonly catalog: CabinetCatalog;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation('team');
  const toast = useToast();
  const save = useSetTeamMemberServices(businessId, member.id);
  const [chosen, setChosen] = useState(() => initialTerms(member));
  const services = catalog.categories.flatMap((category) => category.services);
  const valid = [...chosen.values()].every(
    (terms) => durationFits(terms.duration) && priceFits(terms.price),
  );
  const choose = (serviceId: string, terms: Terms | undefined) => {
    setChosen((current) => {
      const next = new Map(current);
      if (terms) {
        next.set(serviceId, terms);
      } else {
        next.delete(serviceId);
      }
      return next;
    });
    save.reset();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('services.sheetTitle')}
      description={t('services.selected', { count: chosen.size })}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            className={styles.grow}
            loading={save.isPending}
            disabled={!valid}
            onClick={() => {
              save.mutate(
                services
                  .filter((service) => chosen.has(service.id))
                  .map((service) => {
                    const terms = chosen.get(service.id);
                    const currency = service.price.currency;
                    return {
                      serviceId: service.id,
                      durationMinutes: terms?.duration ?? null,
                      priceMinor:
                        terms?.price === null || terms?.price === undefined
                          ? null
                          : toMinor(terms.price, currency),
                    };
                  }),
                {
                  onSuccess: () => {
                    toast.show({ title: t('services.saved') });
                    onSaved();
                  },
                },
              );
            }}
          >
            {t('services.save')}
          </Button>
        </>
      }
    >
      <div className={styles.servicesForm}>
        {catalog.categories.map((category) => {
          const shown = category.services.filter(
            (service) => service.isActive || chosen.has(service.id),
          );
          return shown.length > 0 ? (
            <ListGroup key={category.id} title={category.name}>
              {shown.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  terms={chosen.get(service.id)}
                  onChange={(terms) => {
                    choose(service.id, terms);
                  }}
                />
              ))}
            </ListGroup>
          ) : null;
        })}
        {save.isError ? (
          <p className={styles.formError} role="alert">
            {errorMessage(t, save.error)}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
