import { ApiError, type AffectedVisit, type ScheduleChange } from '@mestechko/contracts/client';
import { useToast } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useApplyScheduleChange,
  usePreviewScheduleChange,
} from '../../../platform/api/team-queries';
import { errorMessage } from '../../common/error-message';

export interface ScheduleRequest {
  readonly change: ScheduleChange;
  /** Toast title once the change is saved. */
  readonly success: string;
  /** Label of the button that saves despite affected visits. */
  readonly confirmLabel: string;
  readonly onApplied?: () => void;
  /** Failures before anything was confirmed, e.g. to show them in the form; a toast otherwise. */
  readonly onError?: (error: unknown) => void;
}

export interface ImpactConfirmation {
  readonly request: ScheduleRequest;
  readonly affected: readonly AffectedVisit[];
  /** The visits changed while the person was looking at them. */
  readonly changed: boolean;
}

/** The visits a change affects now, when the API refused the count the person saw. */
function changedImpact(error: unknown): readonly AffectedVisit[] | null {
  if (!(error instanceof ApiError) || error.code !== 'impact_changed') {
    return null;
  }
  const details = error.details as { affected?: unknown } | undefined;
  return Array.isArray(details?.affected) ? (details.affected as AffectedVisit[]) : [];
}

/**
 * Every schedule change goes the same way: preview which visits it would leave outside
 * working time, ask about them if there are any, then save with the count confirmed.
 * When the visits changed meanwhile, the new list is shown in the same dialog.
 */
export function useScheduleChange(businessId: string, staffId: string) {
  const { t } = useTranslation('team');
  const toast = useToast();
  const preview = usePreviewScheduleChange(businessId, staffId);
  const apply = useApplyScheduleChange(businessId, staffId);
  const [confirmation, setConfirmation] = useState<ImpactConfirmation | null>(null);
  const [open, setOpen] = useState(false);

  const fail = (request: ScheduleRequest, error: unknown) => {
    if (request.onError) {
      request.onError(error);
    } else {
      toast.show({ title: errorMessage(t, error), tone: 'error' });
    }
  };

  const save = (request: ScheduleRequest, acknowledged: number) => {
    apply.mutate(
      { change: request.change, acknowledgedAffected: acknowledged },
      {
        onSuccess: ({ affected }) => {
          setOpen(false);
          toast.show({
            title: request.success,
            ...(affected.length > 0
              ? { description: t('impact.outside', { count: affected.length }) }
              : {}),
          });
          request.onApplied?.();
        },
        onError: (error) => {
          const affected = changedImpact(error);
          if (affected) {
            setConfirmation({ request, affected, changed: true });
            setOpen(true);
          } else if (open) {
            toast.show({ title: errorMessage(t, error), tone: 'error' });
          } else {
            fail(request, error);
          }
        },
      },
    );
  };

  return {
    pending: preview.isPending || apply.isPending,
    confirmation,
    open,
    applying: apply.isPending,
    submit: (request: ScheduleRequest) => {
      preview.mutate(request.change, {
        onSuccess: ({ affected }) => {
          if (affected.length === 0) {
            save(request, 0);
            return;
          }
          setConfirmation({ request, affected, changed: false });
          setOpen(true);
        },
        onError: (error) => {
          fail(request, error);
        },
      });
    },
    confirm: () => {
      if (confirmation) {
        save(confirmation.request, confirmation.affected.length);
      }
    },
    dismiss: () => {
      setOpen(false);
    },
  };
}

export type ScheduleChangeFlow = ReturnType<typeof useScheduleChange>;
