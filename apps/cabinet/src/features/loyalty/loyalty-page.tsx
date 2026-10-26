import type { PassPlan } from '@slotwise/contracts/client';
import {
  Button,
  EmptyIllustration,
  ListGroup,
  ListItem,
  Skeleton,
  StatePanel,
  useToast,
} from '@slotwise/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useCabinetCatalog } from '../../platform/api/catalog-queries';
import {
  planBodyOf,
  useLoyaltySettings,
  useUpdatePassPlan,
} from '../../platform/api/loyalty-queries';
import { useOverview } from '../../platform/api/queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { errorMessage } from '../common/error-message';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { PlanEditorSheet, type PlanEditorSession } from './plan-editor';
import { PlanList } from './plan-list';
import { ProgramCard } from './program-card';
import styles from './loyalty.module.css';

function LoyaltySkeleton() {
  return (
    <div className={styles.layout} aria-busy="true">
      <div className={styles.column}>
        <div className={styles.columnHeader}>
          <Skeleton shape="text" width="var(--size-illustration)" />
        </div>
        <div className={styles.card}>
          <Skeleton shape="text" width="50%" />
          <div className={styles.settings}>
            <Skeleton height="var(--size-control-md)" />
            <Skeleton height="var(--size-control-md)" />
          </div>
          <Skeleton height="var(--size-illustration-sm)" />
        </div>
      </div>
      <div className={styles.column}>
        <div className={styles.columnHeader}>
          <Skeleton shape="text" width="var(--size-illustration)" />
        </div>
        <ListGroup>
          {Array.from({ length: 3 }, (_, index) => (
            <ListItem
              key={index}
              title={<Skeleton shape="text" width="50%" />}
              description={<Skeleton shape="text" width="35%" />}
              meta={<Skeleton shape="text" width="var(--size-avatar-lg)" />}
            />
          ))}
        </ListGroup>
      </div>
    </div>
  );
}

/** The loyalty program and the passes the business sells. */
export function LoyaltyPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { businessId = '' } = useParams();
  const me = useSession();
  const membership = useActiveMembership(me);
  const allowed = membership ? canOpen(membership, 'loyalty') : false;
  const settings = useLoyaltySettings(businessId, allowed);
  const catalogAllowed = membership ? canOpen(membership, 'catalog') : false;
  const catalog = useCabinetCatalog(businessId, allowed && catalogAllowed);
  const overview = useOverview(businessId);
  const updatePlan = useUpdatePassPlan(businessId);
  const [editor, setEditor] = useState<PlanEditorSession | null>(null);

  if (!allowed) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }

  const business = overview.data?.business;
  const data = business ? settings.data : undefined;
  const failed = settings.isError ? settings.error : overview.isError ? overview.error : null;
  const serviceNames = catalog.data
    ? new Map(
        catalog.data.categories.flatMap((category) =>
          category.services.map((service) => [service.id, service.name] as const),
        ),
      )
    : null;
  const openEditor = (plan: PassPlan | null) => {
    setEditor((current) => ({ id: (current?.id ?? 0) + 1, plan, open: true }));
  };
  const setPlanActive = (plan: PassPlan, isActive: boolean) => {
    updatePlan.mutate(
      { plan, body: { ...planBodyOf(plan), isActive } },
      {
        onSuccess: () => {
          toast.show({
            title: t(isActive ? 'loyalty:plans.resumed' : 'loyalty:plans.stopped', {
              name: plan.name,
            }),
          });
        },
        onError: (error) => {
          toast.show({
            tone: 'error',
            title: t('loyalty:plans.failed'),
            description: errorMessage(t, error),
          });
        },
      },
    );
  };

  return (
    <PageContainer>
      <PageHeader title={t('loyalty:title')} />
      {failed ? (
        <QueryErrorState
          error={failed}
          onRetry={() => {
            void settings.refetch();
            void overview.refetch();
          }}
        />
      ) : null}
      {!data && !failed ? <LoyaltySkeleton /> : null}
      {data && business ? (
        <div className={styles.layout}>
          <ProgramCard
            businessId={businessId}
            program={data.program}
            currency={business.currency}
          />
          <section className={styles.column} aria-labelledby="loyalty-plans">
            <div className={styles.columnHeader}>
              <h2 id="loyalty-plans" className={styles.columnTitle}>
                {t('loyalty:plans.title')}
              </h2>
              {data.plans.length > 0 ? (
                <Button
                  icon={<Plus />}
                  onClick={() => {
                    openEditor(null);
                  }}
                >
                  {t('loyalty:plans.add')}
                </Button>
              ) : null}
            </div>
            {data.plans.length > 0 ? (
              <PlanList
                plans={data.plans}
                serviceNames={serviceNames}
                onEdit={openEditor}
                onSetActive={setPlanActive}
              />
            ) : (
              <StatePanel
                compact
                illustration={<EmptyIllustration />}
                title={t('loyalty:plans.empty.title')}
                description={t('loyalty:plans.empty.description')}
                action={
                  <Button
                    icon={<Plus />}
                    onClick={() => {
                      openEditor(null);
                    }}
                  >
                    {t('loyalty:plans.empty.action')}
                  </Button>
                }
              />
            )}
          </section>
        </div>
      ) : null}
      {editor && business ? (
        <PlanEditorSheet
          businessId={businessId}
          session={editor}
          services={
            !catalogAllowed
              ? { state: 'forbidden' }
              : catalog.data
                ? { state: 'ready', categories: catalog.data.categories }
                : catalog.isError
                  ? { state: 'failed', error: catalog.error, retry: () => void catalog.refetch() }
                  : { state: 'loading' }
          }
          currency={business.currency}
          onClose={() => {
            setEditor((current) => (current ? { ...current, open: false } : current));
          }}
        />
      ) : null}
    </PageContainer>
  );
}
