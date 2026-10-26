import { useVocabulary } from '@slotwise/booking-ui';
import type { CabinetCatalog, ServiceAdmin, VerticalSummary } from '@slotwise/contracts/client';
import type { CurrencyCode } from '@slotwise/domain';
import {
  Button,
  ConfirmDialog,
  ErrorIllustration,
  Sheet,
  StatePanel,
  useToast,
} from '@slotwise/ui';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeamMembers } from '../../../platform/api/catalog-queries';
import { errorMessage } from '../../common/error-message';
import { revealFirstProblem } from '../../common/field-checks';
import { useServiceActivation } from '../service-activation';
import {
  changedSections,
  draftOf,
  hasProblems,
  newServiceDraft,
  problemsOf,
  type DraftSection,
  type ServiceDraft,
} from './service-draft';
import { ServiceForm } from './service-form';
import { useServiceSaver } from './use-service-saver';

/** A new service in a category, or a service to change. */
export type EditorTarget =
  | { readonly kind: 'new'; readonly categoryId: string }
  | { readonly kind: 'edit'; readonly serviceId: string };

/** One opening of the editor; a new id starts from a fresh draft. */
export interface EditorSession {
  readonly id: number;
  readonly target: EditorTarget;
  readonly open: boolean;
}

export interface ServiceEditorProps {
  readonly businessId: string;
  readonly session: EditorSession;
  readonly catalog: CabinetCatalog;
  readonly vertical: VerticalSummary | undefined;
  readonly currency: CurrencyCode;
  readonly onClose: () => void;
}

function findService(catalog: CabinetCatalog, serviceId: string | null): ServiceAdmin | null {
  return (
    catalog.categories
      .flatMap((category) => category.services)
      .find((service) => service.id === serviceId) ?? null
  );
}

/** The service editor: a side panel on larger screens, a full-height sheet on phones. */
export function ServiceEditorSheet(props: ServiceEditorProps) {
  return <ServiceEditor key={props.session.id} {...props} />;
}

function ServiceEditor({
  businessId,
  session,
  catalog,
  vertical,
  currency,
  onClose,
}: ServiceEditorProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const vocabulary = useVocabulary(vertical);
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const team = useTeamMembers(businessId);
  const saver = useServiceSaver(businessId);
  const activation = useServiceActivation(businessId);
  const { target } = session;
  const [serviceId, setServiceId] = useState(target.kind === 'edit' ? target.serviceId : null);
  const saved = findService(catalog, serviceId);
  const [initial] = useState<ServiceDraft | null>(() => {
    if (target.kind === 'new') {
      return newServiceDraft(target.categoryId);
    }
    return saved ? draftOf(saved) : null;
  });
  const [draft, setDraft] = useState(initial);
  const [checked, setChecked] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const sectionNames: Readonly<Record<DraftSection, string>> = {
    about: t('services:editor.sections.about'),
    timing: t('services:editor.sections.timing'),
    price: t('services:editor.sections.price'),
    resource: vocabulary.resourceOne.toLocaleLowerCase(),
    deposit: t('services:editor.sections.deposit'),
    staff: vocabulary.staffMany.toLocaleLowerCase(),
    incompatible: t('services:editor.sections.incompatible'),
  };
  const baseline = saved ? draftOf(saved) : initial;
  const unsaved = draft && baseline ? changedSections(draft, baseline) : [];
  const problems = draft ? problemsOf(draft) : null;

  const requestClose = () => {
    if (unsaved.length > 0 && !saver.isPending) {
      setDiscarding(true);
    } else {
      onClose();
    }
  };
  const submit = () => {
    if (!draft || !problems) {
      return;
    }
    setChecked(true);
    if (hasProblems(problems)) {
      revealFirstProblem(formRef.current);
      return;
    }
    saver.mutate(
      {
        draft,
        saved,
        currency,
        onCreated: (service) => {
          setServiceId(service.id);
        },
      },
      {
        onSuccess: ({ service, created }) => {
          toast.show({
            title: t(created ? 'services:editor.created' : 'services:editor.saved', {
              name: service.name,
            }),
          });
          onClose();
        },
        onError: (error) => {
          toast.show({
            tone: 'error',
            title: t('services:editor.failed'),
            description: errorMessage(t, error),
          });
        },
      },
    );
  };

  return (
    <Sheet
      open={session.open}
      onOpenChange={(open) => {
        if (!open) {
          requestClose();
        }
      }}
      title={saved?.name ?? t('services:editor.newTitle')}
      closeLabel={t('common:actions.close')}
      footer={
        draft ? (
          <>
            <Button variant="secondary" block onClick={requestClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" form={formId} block loading={saver.isPending}>
              {t(saved ? 'services:editor.save' : 'services:editor.create')}
            </Button>
          </>
        ) : undefined
      }
    >
      {draft ? (
        <form
          id={formId}
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <ServiceForm
            draft={draft}
            onChange={(patch) => {
              setDraft((current) => (current ? { ...current, ...patch } : current));
            }}
            problems={checked ? problems : null}
            saved={saved}
            catalog={catalog}
            team={{
              members: team.data?.members ?? null,
              error: team.isError ? team.error : null,
              retry: () => void team.refetch(),
            }}
            vocabulary={vocabulary}
            currency={currency}
            onSetActive={activation.request}
          />
        </form>
      ) : (
        <StatePanel
          compact
          illustration={<ErrorIllustration />}
          title={t('services:editor.notFound')}
          description={t('services:editor.notFoundDescription')}
        />
      )}
      {activation.dialog}
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t('services:editor.discard.title')}
        consequence={t('services:editor.discard.consequence', {
          sections: unsaved.map((section) => sectionNames[section]).join(', '),
        })}
        confirmLabel={t('services:editor.discard.confirm')}
        cancelLabel={t('services:editor.discard.keep')}
        closeLabel={t('common:actions.close')}
        tone="danger"
        onConfirm={() => {
          setDiscarding(false);
          onClose();
        }}
      />
    </Sheet>
  );
}
