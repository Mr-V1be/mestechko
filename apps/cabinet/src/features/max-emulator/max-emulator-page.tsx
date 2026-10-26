import { useLocale } from '@slotwise/booking-ui';
import { offersMessenger } from '@slotwise/domain';
import { breakpoints, EmptyIllustration, Skeleton, StatePanel, useMediaQuery } from '@slotwise/ui';
import { MessagesSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useMaxChats } from '../../platform/api/max-emulator-queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { isNotFound } from '../common/error-message';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { ChatList } from './chat-list';
import { ChatPanel } from './chat-panel';
import styles from './max-emulator.module.css';

/**
 * The MAX emulator: the business's clients who use MAX and their chats with the bot.
 * On a desktop the list and the chat sit side by side; narrower screens show one.
 */
export function MaxEmulatorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { businessId = '', userId = null } = useParams();
  const me = useSession();
  const membership = useActiveMembership(me);
  const wide = useMediaQuery(breakpoints.desktop);
  const chats = useMaxChats(businessId);
  const { locale } = useLocale();
  // Readers of a language without MAX are not offered it, so its emulator is not theirs.
  if (!offersMessenger(locale, 'max')) {
    return <Navigate to={`/b/${businessId}/schedule`} replace />;
  }
  if (membership && !canOpen(membership, 'messengers')) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  const base = `/b/${businessId}/max-emulator`;
  const open = (id: string) => {
    void navigate(`${base}/${id}`);
  };
  const list = chats.data?.chats ?? [];
  const showList = wide || userId === null;
  const showChat = userId !== null;

  return (
    <PageContainer>
      {showList ? (
        <>
          <PageHeader title={t('maxEmulator.title')} />
          <p className={styles.lead}>{t('maxEmulator.lead')}</p>
        </>
      ) : null}
      {chats.isPending ? <Skeleton height="calc(var(--size-control-lg) * 4)" /> : null}
      {chats.isError ? (
        isNotFound(chats.error) ? (
          <StatePanel
            illustration={<EmptyIllustration />}
            title={t('maxEmulator.unavailableTitle')}
            description={t('maxEmulator.unavailableDescription')}
          />
        ) : (
          <QueryErrorState error={chats.error} onRetry={() => void chats.refetch()} />
        )
      ) : null}
      {chats.data && list.length === 0 ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('maxEmulator.emptyTitle')}
          description={t('maxEmulator.emptyDescription')}
        />
      ) : null}
      {list.length > 0 ? (
        <div className={styles.layout}>
          {showList ? (
            <div className={styles.list}>
              <ChatList chats={list} selected={userId} onSelect={open} />
            </div>
          ) : null}
          {showChat ? (
            <ChatPanel
              key={userId}
              businessId={businessId}
              userId={userId}
              onBack={
                wide
                  ? null
                  : () => {
                      void navigate(base);
                    }
              }
            />
          ) : wide ? (
            <div className={styles.placeholder}>
              <MessagesSquare aria-hidden="true" />
              <p>{t('maxEmulator.chooseChat')}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
}
