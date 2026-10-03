import { useVocabulary } from '@mestechko/booking-ui';
import {
  Button,
  EmptyIllustration,
  ListGroup,
  ListItem,
  Skeleton,
  StatePanel,
  useToast,
} from '@mestechko/ui';
import { FolderPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import {
  useCabinetCatalog,
  useTeamMembers,
  useUpdateCategory,
  useUpdateService,
} from '../../platform/api/catalog-queries';
import { useOverview } from '../../platform/api/queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { errorMessage } from '../common/error-message';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { CatalogList, type CatalogListActions } from './catalog-list';
import { CategoryDialog, type CategoryTarget } from './category-dialog';
import { ServiceEditorSheet, type EditorSession, type EditorTarget } from './editor/service-editor';
import { useServiceActivation } from './service-activation';
import styles from './catalog.module.css';

const SKELETON_GROUPS = [3, 2] as const;

function CatalogSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {SKELETON_GROUPS.map((rows, group) => (
        <div key={group} className={styles.skeletonGroup}>
          <Skeleton shape="text" width="var(--size-illustration)" />
          <ListGroup>
            {Array.from({ length: rows }, (_, row) => (
              <ListItem
                key={row}
                title={<Skeleton shape="text" width="45%" />}
                description={<Skeleton shape="text" width="25%" />}
                meta={<Skeleton shape="text" width="var(--size-avatar-lg)" />}
              />
            ))}
          </ListGroup>
        </div>
      ))}
    </div>
  );
}

/** Services and prices: categories with their services, and the editor beside them. */
export function CatalogPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { businessId = '' } = useParams();
  const me = useSession();
  const membership = useActiveMembership(me);
  const allowed = membership ? canOpen(membership, 'catalog') : false;
  const catalog = useCabinetCatalog(businessId, allowed);
  const overview = useOverview(businessId);
  const team = useTeamMembers(businessId, allowed);
  const vocabulary = useVocabulary(overview.data?.business.vertical);
  const updateCategory = useUpdateCategory(businessId);
  const updateService = useUpdateService(businessId);
  const activation = useServiceActivation(businessId);
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const [category, setCategory] = useState<{
    readonly id: number;
    readonly target: CategoryTarget;
    readonly open: boolean;
  } | null>(null);

  if (!allowed) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }

  const openEditor = (target: EditorTarget) => {
    setEditor((current) => ({ id: (current?.id ?? 0) + 1, target, open: true }));
  };
  const openCategory = (target: CategoryTarget) => {
    setCategory((current) => ({ id: (current?.id ?? 0) + 1, target, open: true }));
  };
  const moveFailed = (error: unknown) => {
    toast.show({
      tone: 'error',
      title: t('services:moveFailed'),
      description: errorMessage(t, error),
    });
  };
  const business = overview.data?.business;
  const data = business ? catalog.data : undefined;
  const failed = catalog.isError ? catalog.error : overview.isError ? overview.error : null;
  const firstCategory = data?.categories[0];
  const actions: CatalogListActions = {
    addService: (categoryId) => {
      openEditor({ kind: 'new', categoryId });
    },
    editService: (service) => {
      openEditor({ kind: 'edit', serviceId: service.id });
    },
    renameCategory: (target) => {
      openCategory({ kind: 'rename', category: target });
    },
    moveCategory: (target, position) => {
      updateCategory.mutate(
        { categoryId: target.id, changes: { position } },
        { onError: moveFailed },
      );
    },
    moveService: (service, position) => {
      updateService.mutate(
        { serviceId: service.id, changes: { position } },
        { onError: moveFailed },
      );
    },
    setServiceActive: activation.request,
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('services:title')}
        actions={
          data && data.categories.length > 0 ? (
            <div className={styles.headerActions}>
              <Button
                variant="secondary"
                icon={<FolderPlus />}
                onClick={() => {
                  openCategory({ kind: 'new' });
                }}
              >
                {t('services:addCategory')}
              </Button>
              {firstCategory ? (
                <Button
                  icon={<Plus />}
                  onClick={() => {
                    openEditor({ kind: 'new', categoryId: firstCategory.id });
                  }}
                >
                  {t('services:addService')}
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {failed ? (
        <QueryErrorState
          error={failed}
          onRetry={() => {
            void catalog.refetch();
            void overview.refetch();
          }}
        />
      ) : null}
      {!data && !failed ? <CatalogSkeleton /> : null}
      {data?.categories.length === 0 ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('services:empty.title')}
          description={t('services:empty.description')}
          action={
            <Button
              icon={<FolderPlus />}
              onClick={() => {
                openCategory({ kind: 'new' });
              }}
            >
              {t('services:empty.action')}
            </Button>
          }
        />
      ) : null}
      {data && data.categories.length > 0 ? (
        <CatalogList
          catalog={data}
          resourceName={(resourceTypeId) => {
            const type = data.resourceTypes.find((item) => item.id === resourceTypeId);
            return type ? vocabulary.resourceType(type.term) : resourceTypeId;
          }}
          staff={
            team.data ? new Map(team.data.members.map((member) => [member.id, member])) : null
          }
          actions={actions}
        />
      ) : null}
      {editor && data && business ? (
        <ServiceEditorSheet
          businessId={businessId}
          session={editor}
          catalog={data}
          vertical={business.vertical}
          currency={business.currency}
          onClose={() => {
            setEditor((current) => (current ? { ...current, open: false } : current));
          }}
        />
      ) : null}
      {category ? (
        <CategoryDialog
          key={category.id}
          businessId={businessId}
          target={category.target}
          open={category.open}
          onClose={() => {
            setCategory((current) => (current ? { ...current, open: false } : current));
          }}
        />
      ) : null}
      {activation.dialog}
    </PageContainer>
  );
}
