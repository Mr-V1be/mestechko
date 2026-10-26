import { ApiError, type Membership } from '@slotwise/contracts/client';
import { Button, EmptyIllustration, StatePanel } from '@slotwise/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useClientCard } from '../../../platform/api/clients-queries';
import { useOverview } from '../../../platform/api/queries';
import { canOpen, useActiveMembership } from '../../../platform/session/active-business';
import { useSession } from '../../../platform/session/session-context';
import { BookingDetailsSheet } from '../../booking-details/booking-details-sheet';
import { isNotFound } from '../../common/error-message';
import { PageContainer } from '../../common/page-header';
import { NoAccessState, QueryErrorState } from '../../common/states';
import type { ClientListState } from '../clients-page';
import { LoyaltyPanel } from '../loyalty/loyalty-panel';
import { ClientEditSheet } from '../profile/client-edit-sheet';
import { CardHeader } from './card-header';
import { CardOverview } from './card-overview';
import { CardSkeleton } from './card-skeleton';
import { NotesPanel } from './notes-panel';
import { VisitsPanel } from './visits-panel';
import styles from './card.module.css';

/** A link to a card that cannot exist (a malformed id) reads the same as a deleted one. */
function isMissing(error: unknown): boolean {
  return isNotFound(error) || (error instanceof ApiError && error.code === 'validation_failed');
}

/** One client: contacts, visits, notes, no-shows, points and passes. */
export function ClientCardPage() {
  const me = useSession();
  const membership = useActiveMembership(me);
  const { clientId = '' } = useParams();
  if (!membership) {
    return null;
  }
  if (!canOpen(membership, 'clients')) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  return <ClientCardScreen key={clientId} membership={membership} clientId={clientId} />;
}

function ClientCardScreen({
  membership,
  clientId,
}: {
  readonly membership: Membership;
  readonly clientId: string;
}) {
  const { t } = useTranslation();
  const businessId = membership.business.id;
  const navigate = useNavigate();
  const location = useLocation();
  const card = useClientCard(businessId, clientId);
  const overview = useOverview(businessId);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState(0);

  const listSearch = (location.state as Partial<ClientListState> | null)?.listSearch ?? '';
  const backToList = () => {
    void navigate(`/b/${businessId}/clients${listSearch}`);
  };
  const openEdit = () => {
    setEditSession((session) => session + 1);
    setEditOpen(true);
  };
  const timeZone = overview.data?.locations[0]?.timeZone;

  if (card.isError || overview.isError) {
    return (
      <PageContainer>
        {card.isError && isMissing(card.error) ? (
          <StatePanel
            illustration={<EmptyIllustration />}
            title={t('clients:card.notFoundTitle')}
            description={t('clients:card.notFoundDescription')}
            action={
              <Button variant="secondary" onClick={backToList}>
                {t('clients:card.toList')}
              </Button>
            }
          />
        ) : (
          <QueryErrorState
            error={card.error ?? overview.error}
            onRetry={() => {
              void card.refetch();
              void overview.refetch();
            }}
          />
        )}
      </PageContainer>
    );
  }
  if (!card.data || !timeZone) {
    return <CardSkeleton />;
  }
  const { client } = card.data;
  return (
    <PageContainer>
      <CardHeader
        businessId={businessId}
        client={client}
        timeZone={timeZone}
        onBack={backToList}
        onEdit={openEdit}
      />
      <div className={styles.layout}>
        <div className={styles.overview}>
          <CardOverview card={card.data} onEdit={openEdit} />
        </div>
        <div className={styles.main}>
          <VisitsPanel card={card.data} onOpen={setOpenBooking} />
          <NotesPanel
            businessId={businessId}
            clientId={clientId}
            notes={card.data.notes}
            timeZone={timeZone}
          />
        </div>
        <div className={styles.loyalty}>
          <LoyaltyPanel membership={membership} card={card.data} timeZone={timeZone} />
        </div>
      </div>
      <ClientEditSheet
        key={editSession}
        businessId={businessId}
        businessSlug={membership.business.slug}
        client={client}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <BookingDetailsSheet
        businessId={businessId}
        bookingId={openBooking}
        onClose={() => {
          setOpenBooking(null);
        }}
      />
    </PageContainer>
  );
}
