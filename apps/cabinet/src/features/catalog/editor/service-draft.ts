import type { ServiceAdmin } from '@slotwise/contracts/client';
import type { CurrencyCode } from '@slotwise/domain';
import type {
  ServiceChangesBody,
  ServiceFieldsBody,
  ServiceStaffTerms,
} from '../../../platform/api/catalog-queries';
import { checkNumber, checkText, type FieldProblem } from '../../common/field-checks';
import { toMajor, toMinor } from '../../common/money';
import { newServiceDefaults, serviceLimits } from '../limits';

/** Personal terms of one person; `null` keeps the service's own value. */
export interface StaffTermsDraft {
  readonly durationMinutes: number | null;
  /** Typed in major units, e.g. roubles. */
  readonly price: number | null;
}

/** A service as it is being edited: what people typed, before it is checked and sent. */
export interface ServiceDraft {
  readonly categoryId: string;
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: number | null;
  readonly bufferBeforeMinutes: number | null;
  readonly bufferAfterMinutes: number | null;
  /** Typed in major units, e.g. roubles. */
  readonly price: number | null;
  readonly resourceTypeId: string | null;
  /** Off: the share of the business rule applies. */
  readonly ownDeposit: boolean;
  readonly depositPercent: number | null;
  /** Who provides it, by staff id. */
  readonly staff: Readonly<Record<string, StaffTermsDraft>>;
  readonly incompatibleWith: readonly string[];
}

export function draftOf(service: ServiceAdmin): ServiceDraft {
  return {
    categoryId: service.categoryId,
    name: service.name,
    description: service.description ?? '',
    durationMinutes: service.durationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    price: toMajor(service.price.amountMinor, service.price.currency),
    resourceTypeId: service.resourceTypeId,
    ownDeposit: service.depositPercent !== null,
    depositPercent: service.depositPercent,
    staff: Object.fromEntries(
      service.staff.map((terms) => [
        terms.staffId,
        {
          durationMinutes: terms.durationMinutes,
          price: terms.price ? toMajor(terms.price.amountMinor, terms.price.currency) : null,
        },
      ]),
    ),
    incompatibleWith: [...service.incompatibleWith],
  };
}

export function newServiceDraft(categoryId: string): ServiceDraft {
  return {
    categoryId,
    name: '',
    description: '',
    durationMinutes: newServiceDefaults.durationMinutes,
    bufferBeforeMinutes: newServiceDefaults.bufferMinutes,
    bufferAfterMinutes: newServiceDefaults.bufferMinutes,
    price: null,
    resourceTypeId: null,
    ownDeposit: false,
    depositPercent: null,
    staff: {},
    incompatibleWith: [],
  };
}

export interface DraftProblems {
  readonly name?: FieldProblem | null;
  readonly description?: FieldProblem | null;
  readonly durationMinutes?: FieldProblem | null;
  readonly bufferBeforeMinutes?: FieldProblem | null;
  readonly bufferAfterMinutes?: FieldProblem | null;
  readonly price?: FieldProblem | null;
  readonly depositPercent?: FieldProblem | null;
  /** Personal terms by staff id. */
  readonly staff: Readonly<
    Record<
      string,
      { readonly durationMinutes: FieldProblem | null; readonly price: FieldProblem | null }
    >
  >;
}

const durationRule = {
  required: true,
  min: serviceLimits.durationMin,
  max: serviceLimits.minutesMax,
} as const;
const bufferRule = { required: false, min: 0, max: serviceLimits.minutesMax } as const;

export function problemsOf(draft: ServiceDraft): DraftProblems {
  return {
    name: checkText(draft.name, { required: true, max: serviceLimits.nameMax }),
    description: checkText(draft.description, {
      required: false,
      max: serviceLimits.descriptionMax,
    }),
    durationMinutes: checkNumber(draft.durationMinutes, durationRule),
    bufferBeforeMinutes: checkNumber(draft.bufferBeforeMinutes, bufferRule),
    bufferAfterMinutes: checkNumber(draft.bufferAfterMinutes, bufferRule),
    price: checkNumber(draft.price, { required: true, min: 0 }),
    depositPercent: draft.ownDeposit
      ? checkNumber(draft.depositPercent, {
          required: true,
          min: 0,
          max: serviceLimits.percentMax,
        })
      : null,
    staff: Object.fromEntries(
      Object.entries(draft.staff).map(([staffId, terms]) => [
        staffId,
        {
          durationMinutes: checkNumber(terms.durationMinutes, { ...durationRule, required: false }),
          price: checkNumber(terms.price, { required: false, min: 0 }),
        },
      ]),
    ),
  };
}

export function hasProblems(problems: DraftProblems): boolean {
  const { staff, ...fields } = problems;
  return (
    Object.values(fields).some(Boolean) ||
    Object.values(staff).some((terms) => Boolean(terms.durationMinutes ?? terms.price))
  );
}

/** The fields as the API takes them; call only for a draft without problems. */
export function fieldsOf(draft: ServiceDraft, currency: CurrencyCode): ServiceFieldsBody {
  return {
    categoryId: draft.categoryId,
    name: draft.name.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    durationMinutes: draft.durationMinutes ?? newServiceDefaults.durationMinutes,
    bufferBeforeMinutes: draft.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes: draft.bufferAfterMinutes ?? 0,
    priceMinor: toMinor(draft.price ?? 0, currency),
    resourceTypeId: draft.resourceTypeId,
    depositPercent: draft.ownDeposit ? draft.depositPercent : null,
  };
}

/** Only the fields that differ from the saved service. */
export function changesOf(
  draft: ServiceDraft,
  saved: ServiceAdmin,
  currency: CurrencyCode,
): ServiceChangesBody {
  const next = fieldsOf(draft, currency);
  const current = fieldsOf(draftOf(saved), currency);
  const changes: ServiceChangesBody = {};
  for (const key of Object.keys(next) as (keyof ServiceFieldsBody)[]) {
    if (next[key] !== current[key]) {
      Object.assign(changes, { [key]: next[key] });
    }
  }
  return changes;
}

export function staffTermsOf(draft: ServiceDraft, currency: CurrencyCode): ServiceStaffTerms {
  return Object.entries(draft.staff)
    .map(([staffId, terms]) => ({
      staffId,
      durationMinutes: terms.durationMinutes,
      priceMinor: terms.price === null ? null : toMinor(terms.price, currency),
    }))
    .sort((a, b) => a.staffId.localeCompare(b.staffId));
}

export function staffChanged(draft: ServiceDraft, saved: ServiceAdmin, currency: CurrencyCode) {
  return (
    JSON.stringify(staffTermsOf(draft, currency)) !==
    JSON.stringify(staffTermsOf(draftOf(saved), currency))
  );
}

export function incompatibleChanged(draft: ServiceDraft, saved: ServiceAdmin): boolean {
  return [...draft.incompatibleWith].sort().join() !== [...saved.incompatibleWith].sort().join();
}

/** Parts of the editor, named in the warning about unsaved changes. */
export const draftSections = [
  'about',
  'timing',
  'price',
  'resource',
  'deposit',
  'staff',
  'incompatible',
] as const;
export type DraftSection = (typeof draftSections)[number];

const sectionFields: Readonly<Record<DraftSection, (draft: ServiceDraft) => unknown>> = {
  about: (draft) => [draft.name.trim(), draft.description.trim(), draft.categoryId],
  timing: (draft) => [draft.durationMinutes, draft.bufferBeforeMinutes, draft.bufferAfterMinutes],
  price: (draft) => draft.price,
  resource: (draft) => draft.resourceTypeId,
  deposit: (draft) => [draft.ownDeposit, draft.ownDeposit ? draft.depositPercent : null],
  staff: (draft) => Object.entries(draft.staff).sort(([a], [b]) => a.localeCompare(b)),
  incompatible: (draft) => [...draft.incompatibleWith].sort(),
};

/** What would be lost if the editor closed now. */
export function changedSections(draft: ServiceDraft, initial: ServiceDraft): DraftSection[] {
  return draftSections.filter(
    (section) =>
      JSON.stringify(sectionFields[section](draft)) !==
      JSON.stringify(sectionFields[section](initial)),
  );
}
