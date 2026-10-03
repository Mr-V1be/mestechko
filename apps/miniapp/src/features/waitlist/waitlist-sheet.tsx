import { addDays, useFormat, WEEK_DAYS } from '@mestechko/booking-ui';
import { dayPartIds, type DayPart } from '@mestechko/domain';
import { Button, DateStrip, Select, Sheet, useToast } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJoinWaitlist } from '../../platform/api/lifecycle-queries';
import { haptics } from '../../platform/telegram/telegram-host';
import { errorMessage } from '../../shared/error-message';
import { useCurrentBusiness } from '../business/business-context';
import {
  checkContact,
  ContactFields,
  useClientContact,
  useDemoContacts,
  type ContactErrors,
} from '../booking/client-contact';
import styles from './waitlist.module.css';

const ANY_TIME = 'any';

export interface WaitlistWish {
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  /** Day offered first; any day of its week can be chosen, full ones included. */
  readonly date: string;
  readonly weekStart: string;
  readonly today: string;
}

/** Asks to be told when time frees up on a day: part of the day and contacts. */
export function WaitlistSheet({
  wish,
  open,
  onOpenChange,
}: {
  readonly wish: WaitlistWish;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const business = useCurrentBusiness();
  const join = useJoinWaitlist(business.slug);
  const [contact, setContact] = useClientContact(business.slug);
  const demoContacts = useDemoContacts();
  const [errors, setErrors] = useState<ContactErrors>({});
  const [dayPart, setDayPart] = useState<DayPart | typeof ANY_TIME>(ANY_TIME);
  const [chosenDate, setDate] = useState<string | null>(null);
  const date = chosenDate ?? (wish.date < wish.today ? wish.today : wish.date);
  const week = Array.from({ length: WEEK_DAYS }, (_, index) => addDays(wish.weekStart, index));

  const submit = () => {
    const checked = checkContact(t, contact, business.countryCode, { allowDemo: demoContacts });
    setErrors(checked.errors);
    if (!checked.contact) {
      haptics.error();
      return;
    }
    join.mutate(
      {
        locationId: wish.locationId,
        serviceIds: wish.serviceIds,
        staffId: wish.staffId,
        date,
        dayPart: dayPart === ANY_TIME ? null : dayPart,
        contact: checked.contact,
      },
      {
        onSuccess: () => {
          haptics.success();
          onOpenChange(false);
          toast.show({ title: t('waitlist.joined'), description: t('waitlist.joinedDescription') });
        },
        onError: (error) => {
          haptics.error();
          toast.show({ title: errorMessage(t, error), tone: 'error' });
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('waitlist.title')}
      description={t('waitlist.lead', { date: format.localDate(date, 'weekdayDayMonth') })}
      closeLabel={t('common:actions.close')}
      footer={
        <Button block size="lg" loading={join.isPending} onClick={submit}>
          {t('waitlist.submit')}
        </Button>
      }
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DateStrip
          label={t('booking:picker.daysLabel')}
          days={week.map((day) => ({
            value: day,
            weekday: format.localDate(day, 'weekdayShort'),
            dayNumber: format.localDate(day, 'dayNumber'),
            accessibleLabel: format.localDate(day, 'weekdayDayMonth'),
            disabled: day < wish.today,
            marked: false,
            today: day === wish.today,
          }))}
          value={date}
          onChange={(day) => {
            haptics.selection();
            setDate(day);
          }}
        />
        <Select
          label={t('waitlist.dayPart')}
          value={dayPart}
          options={[ANY_TIME, ...dayPartIds].map((part) => ({
            value: part,
            label: t(`common:dayParts.${part}`),
          }))}
          onChange={(value) => {
            setDayPart(value as DayPart | typeof ANY_TIME);
          }}
        />
        <ContactFields
          contact={contact}
          errors={errors}
          countryCode={business.countryCode}
          onChange={setContact}
        />
      </form>
    </Sheet>
  );
}
