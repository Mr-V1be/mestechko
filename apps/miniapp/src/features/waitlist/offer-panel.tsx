import { errorMessage, useFormat } from '@mestechko/booking-ui';
import type { ClientBooking } from '@mestechko/contracts/client';
import { Button, Callout, useToast } from '@mestechko/ui';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useOfferAnswers } from '../../platform/api/lifecycle-queries';
import { haptics } from '../../platform/telegram/telegram-host';

/** Whether the booking is a time offered from the waitlist, kept for the client a while. */
export function isWaitlistOffer(booking: ClientBooking): boolean {
  return booking.status === 'held' && booking.hold?.reason === 'waitlist_offer';
}

/**
 * The time the client waited for came free and is kept for them until a moment.
 * Taking it is the screen's main button; passing it on is the quiet step here.
 */
export function OfferPanel({
  slug,
  booking,
}: {
  readonly slug: string;
  readonly booking: ClientBooking;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const { decline } = useOfferAnswers(slug);
  if (!booking.hold) {
    return null;
  }
  const until = format.instant(booking.hold.expiresAt, booking.location.timeZone, 'time');
  return (
    <Callout
      icon={<Sparkles />}
      title={t('offer.title', { time: until })}
      actions={
        <Button
          variant="ghost"
          size="sm"
          loading={decline.isPending}
          onClick={() => {
            decline.mutate(booking.id, {
              onSuccess: () => {
                haptics.success();
                toast.show({ title: t('offer.declined') });
                void navigate(`/b/${encodeURIComponent(slug)}/bookings`, { replace: true });
              },
              onError: (error) => {
                haptics.error();
                toast.show({ title: errorMessage(t, error), tone: 'error' });
              },
            });
          }}
        >
          {t('offer.decline')}
        </Button>
      }
    >
      {booking.deposit
        ? t('offer.leadWithDeposit', { amount: format.money(booking.deposit) })
        : t('offer.lead')}
    </Callout>
  );
}
