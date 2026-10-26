import { brandName } from '@slotwise/i18n';
import {
  demoBusinessesIn,
  DemoLinks,
  errorMessage,
  LanguageMenu,
  useLocale,
  useVocabulary,
  VerticalIcon,
} from '@slotwise/booking-ui';
import type { DemoBusiness } from '@slotwise/contracts/client';
import {
  Badge,
  ListGroup,
  ListItem,
  Logo,
  Spinner,
  SpotIllustration,
  useToast,
} from '@slotwise/ui';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { appConfig } from '../../app/config';
import { useDemoBusinesses, useTelegramLaunch } from '../../platform/api/queries';
import { useHost } from '../../platform/telegram/host-context';
import { ListSkeleton, QueryErrorState } from '../layout/states';
import { rememberDemoUserId, storedDemoUserId } from './demo-identity';
import styles from './launcher.module.css';

function BusinessRow({
  business,
  opening,
  onOpen,
}: {
  readonly business: DemoBusiness;
  readonly opening: boolean;
  readonly onOpen: () => void;
}) {
  const vocabulary = useVocabulary(business.vertical);
  return (
    <ListItem
      leading={
        <span className={styles.icon}>
          <VerticalIcon name={business.vertical.icon} />
        </span>
      }
      title={business.name}
      description={`${vocabulary.verticalName}, ${business.address}`}
      trailing={opening ? <Spinner /> : <ChevronRight />}
      onClick={onOpen}
    />
  );
}

/** Demo entry outside Telegram: choose a business and the client app opens as in Telegram. */
export function LauncherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { launch } = useHost();
  const { locale } = useLocale();
  const businesses = useDemoBusinesses();
  const telegramLaunch = useTelegramLaunch();

  const open = (slug: string) => {
    telegramLaunch.mutate(
      { businessSlug: slug, demoUserId: storedDemoUserId() },
      {
        onSuccess: (result) => {
          rememberDemoUserId(result.demoUserId);
          launch({ initData: result.initData, startParam: result.startParam });
          void navigate(`/b/${encodeURIComponent(result.startParam)}`, { replace: true });
        },
        onError: (error) => {
          toast.show({ title: errorMessage(t, error), tone: 'error' });
        },
      },
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <section className={styles.hero}>
          <div className={styles.brandRow}>
            <Logo name={brandName} />
            <Badge tone="outline">{t('common:brand.demo')}</Badge>
            <span className={styles.brandEnd}>
              <LanguageMenu />
            </span>
          </div>
          <div className={styles.illustration}>
            <SpotIllustration />
          </div>
          <h1 className={styles.title}>{t('launcher.title')}</h1>
          <p className={styles.lead}>{t('launcher.lead')}</p>
        </section>
        <section>
          {businesses.isPending ? <ListSkeleton rows={4} /> : null}
          {businesses.isError ? (
            <QueryErrorState error={businesses.error} onRetry={() => void businesses.refetch()} />
          ) : null}
          {businesses.data ? (
            <ListGroup title={t('launcher.listTitle')}>
              {demoBusinessesIn(businesses.data.businesses, locale).map((business) => (
                <BusinessRow
                  key={business.slug}
                  business={business}
                  opening={
                    telegramLaunch.isPending &&
                    telegramLaunch.variables.businessSlug === business.slug
                  }
                  onOpen={() => {
                    open(business.slug);
                  }}
                />
              ))}
            </ListGroup>
          ) : null}
        </section>
        <DemoLinks links={appConfig.demoLinks} />
      </div>
    </div>
  );
}
