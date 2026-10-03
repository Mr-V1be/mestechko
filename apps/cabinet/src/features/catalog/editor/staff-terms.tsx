import { apiAssetUrl } from '@mestechko/booking-ui';
import type { TeamMemberSummary } from '@mestechko/contracts/client';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ListGroup,
  ListItem,
  NumberField,
  Skeleton,
} from '@mestechko/ui';
import { CircleAlert } from 'lucide-react';
import { Fragment, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../../app/config';
import { errorMessage } from '../../common/error-message';
import { problemText } from '../../common/field-checks';
import type { DraftProblems, StaffTermsDraft } from './service-draft';
import styles from './editor.module.css';

export interface StaffTermsFieldProps {
  readonly title: string;
  /** The team: `members` is `null` while it loads or after `error`. */
  readonly team: {
    readonly members: readonly TeamMemberSummary[] | null;
    readonly error: unknown;
    readonly retry: () => void;
  };
  readonly value: Readonly<Record<string, StaffTermsDraft>>;
  readonly onChange: (value: Readonly<Record<string, StaffTermsDraft>>) => void;
  readonly problems: DraftProblems['staff'] | null;
  /** The service's own terms, shown where a person keeps them. */
  readonly base: { readonly durationMinutes: number | null; readonly price: number | null };
  readonly minutesUnit: string;
  readonly currencySign: string;
  readonly priceDigits: number;
}

/** An empty personal field shows the service's own value, written as the field writes it. */
function placeholderOf(value: number | null): { placeholder?: string } {
  return value === null ? {} : { placeholder: String(value).replace('.', ',') };
}

/** Who provides the service, each with an optional personal duration and price. */
export function StaffTermsField({
  title,
  team,
  value,
  onChange,
  problems,
  base,
  minutesUnit,
  currencySign,
  priceDigits,
}: StaffTermsFieldProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const { members } = team;
  if (team.error) {
    return (
      <ListGroup title={title}>
        <ListItem
          leading={<CircleAlert aria-hidden="true" />}
          title={t('common:states.errorTitle')}
          description={errorMessage(t, team.error)}
          trailing={
            <Button variant="secondary" size="sm" onClick={team.retry}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      </ListGroup>
    );
  }
  if (members === null) {
    return (
      <ListGroup title={title}>
        {Array.from({ length: 3 }, (_, index) => (
          <ListItem
            key={index}
            leading={
              <Skeleton
                shape="circle"
                width="var(--size-avatar-sm)"
                height="var(--size-avatar-sm)"
              />
            }
            title={<Skeleton shape="text" width="60%" />}
          />
        ))}
      </ListGroup>
    );
  }
  // People who left stay listed only while they still provide the service, to be removed.
  const shown = members.filter((member) => member.isActive || member.id in value);
  if (shown.length === 0) {
    return (
      <ListGroup title={title}>
        <ListItem title={t('services:editor.noStaff')} />
      </ListGroup>
    );
  }
  const change = (staffId: string, terms: StaffTermsDraft | null) => {
    const others = Object.entries(value).filter(([id]) => id !== staffId);
    onChange(Object.fromEntries(terms ? [...others, [staffId, terms]] : others));
  };
  return (
    <ListGroup title={title}>
      {shown.map((member) => {
        const controlId = `${idPrefix}-${member.id}`;
        const terms = value[member.id];
        const problem = problems?.[member.id];
        return (
          <Fragment key={member.id}>
            <ListItem
              controlId={controlId}
              leading={
                <Avatar
                  name={member.displayName}
                  src={apiAssetUrl(appConfig.apiBaseUrl, member.avatarUrl)}
                  size="sm"
                />
              }
              title={member.displayName}
              description={
                member.isActive ? (
                  (member.title ?? undefined)
                ) : (
                  <Badge tone="neutral">{t('services:editor.staffInactive')}</Badge>
                )
              }
              trailing={
                <Checkbox
                  id={controlId}
                  checked={terms !== undefined}
                  onCheckedChange={(checked) => {
                    change(member.id, checked ? { durationMinutes: null, price: null } : null);
                  }}
                />
              }
            />
            {terms ? (
              <li className={styles.personalTerms}>
                <NumberField
                  label={t('services:editor.personalDuration')}
                  value={terms.durationMinutes}
                  {...placeholderOf(base.durationMinutes)}
                  suffix={minutesUnit}
                  error={problemText(t, problem?.durationMinutes)}
                  onChange={(durationMinutes) => {
                    change(member.id, { ...terms, durationMinutes });
                  }}
                />
                <NumberField
                  label={t('services:editor.personalPrice')}
                  value={terms.price}
                  {...placeholderOf(base.price)}
                  suffix={currencySign}
                  fractionDigits={priceDigits}
                  error={problemText(t, problem?.price)}
                  onChange={(price) => {
                    change(member.id, { ...terms, price });
                  }}
                />
              </li>
            ) : null}
          </Fragment>
        );
      })}
    </ListGroup>
  );
}
