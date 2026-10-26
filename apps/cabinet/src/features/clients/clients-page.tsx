import { clientSorts, type Membership } from '@slotwise/contracts/client';
import {
  Button,
  EmptyIllustration,
  Menu,
  StatePanel,
  breakpoints,
  useMediaQuery,
} from '@slotwise/ui';
import { FileUp, UserPlus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { appliedSearch, useClients, type ClientSort } from '../../platform/api/clients-queries';
import { useOverview } from '../../platform/api/queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { ClientsList, ClientsSkeleton, ClientsTable } from './clients-results';
import { ClientsToolbar } from './clients-toolbar';
import { ClientCreateSheet } from './profile/client-create-sheet';
import { useExportActions } from './transfer/client-files';
import { ImportDialog } from './transfer/import-dialog';
import styles from './clients.module.css';

const DEFAULT_SORT: ClientSort = 'recent';

/** Where the card's «back» returns: the list with the same search and filters. */
export interface ClientListState {
  readonly listSearch: string;
}

/** The client base: search, tags, import and export, and the way into each card. */
export function ClientsPage() {
  const me = useSession();
  const membership = useActiveMembership(me);
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
  return <ClientsScreen membership={membership} />;
}

function ClientsScreen({ membership }: { readonly membership: Membership }) {
  const { t } = useTranslation();
  const businessId = membership.business.id;
  const navigate = useNavigate();
  const location = useLocation();
  const wide = useMediaQuery(breakpoints.desktop);
  const roomy = useMediaQuery(breakpoints.tablet);
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const exportActions = useExportActions(businessId);
  const overview = useOverview(businessId);

  const search = params.get('q') ?? '';
  const deferredSearch = useDeferredValue(search);
  const tag = params.get('tag');
  const sort = clientSorts.find((id) => id === params.get('sort')) ?? DEFAULT_SORT;
  const clients = useClients(businessId, { search: deferredSearch, tag, sort });
  const timeZone = overview.data?.locations[0]?.timeZone;

  const setParam = (key: string, value: string | null) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
  const resetFilters = () => {
    setParams({}, { replace: true });
  };
  const openCard = (clientId: string) => {
    const state: ClientListState = { listSearch: location.search };
    void navigate(`/b/${businessId}/clients/${clientId}`, { state });
  };
  const openCreate = () => {
    setCreateOpen(true);
  };
  const openImport = () => {
    setImportOpen(true);
  };

  const rows = clients.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = appliedSearch(deferredSearch) !== null || tag !== null;
  const View = wide ? ClientsTable : ClientsList;

  return (
    <PageContainer>
      <PageHeader
        title={t('clients:title')}
        actions={
          <div className={styles.headerActions}>
            <Menu
              label={t('clients:moreActions')}
              actions={[
                {
                  key: 'import',
                  label: t('clients:transfer.import'),
                  icon: <FileUp aria-hidden="true" />,
                  onSelect: openImport,
                },
                ...exportActions,
              ]}
            />
            <Button icon={<UserPlus />} onClick={openCreate}>
              {roomy ? t('clients:add') : t('clients:addShort')}
            </Button>
          </div>
        }
      />
      <ClientsToolbar
        businessId={businessId}
        search={search}
        tag={tag}
        sort={sort}
        onSearch={(value) => {
          setParam('q', value);
        }}
        onTag={(value) => {
          setParam('tag', value);
        }}
        onSort={(value) => {
          setParam('sort', value === DEFAULT_SORT ? null : value);
        }}
      />
      {clients.isError || overview.isError ? (
        <QueryErrorState
          error={clients.error ?? overview.error}
          onRetry={() => {
            void clients.refetch();
            void overview.refetch();
          }}
        />
      ) : null}
      {clients.isPending || (clients.data && overview.isPending) ? <ClientsSkeleton /> : null}
      {clients.data && rows.length === 0 && !filtered ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('clients:emptyTitle')}
          description={t('clients:emptyDescription')}
          action={
            <div className={styles.emptyActions}>
              <Button icon={<UserPlus />} onClick={openCreate}>
                {t('clients:add')}
              </Button>
              <Button variant="secondary" icon={<FileUp />} onClick={openImport}>
                {t('clients:transfer.import')}
              </Button>
            </div>
          }
        />
      ) : null}
      {clients.data && rows.length === 0 && filtered ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('clients:noResultsTitle')}
          description={t('clients:noResultsDescription')}
          action={
            <Button variant="secondary" onClick={resetFilters}>
              {t('clients:resetFilters')}
            </Button>
          }
        />
      ) : null}
      {rows.length > 0 && timeZone ? (
        <div className={styles.results} aria-busy={clients.isPlaceholderData || undefined}>
          <View rows={rows} timeZone={timeZone} onOpen={openCard} />
        </div>
      ) : null}
      {clients.hasNextPage ? (
        <Button
          className={styles.more}
          variant="secondary"
          loading={clients.isFetchingNextPage}
          onClick={() => void clients.fetchNextPage()}
        >
          {t('common:actions.showMore')}
        </Button>
      ) : null}
      <ClientCreateSheet
        businessId={businessId}
        businessSlug={membership.business.slug}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <ImportDialog businessId={businessId} open={importOpen} onOpenChange={setImportOpen} />
    </PageContainer>
  );
}
