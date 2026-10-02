import type { DemoBusiness, Membership } from '@mestechko/contracts/client';
import { Button, SegmentedControl, Select } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useDemoBusinesses, useDemoSignIn } from '../../platform/api/queries';
import { errorMessage } from '../common/error-message';
import { useRoleLabel } from '../common/role-label';
import styles from './sign-in.module.css';

type Role = Membership['role'];

/** One-click entry to a demo business as any of its people: the owner or a staff member. */
export function DemoAccess() {
  const { t } = useTranslation();
  const businesses = useDemoBusinesses(true);
  const list = businesses.data?.businesses ?? [];
  const [slug, setSlug] = useState<string | null>(null);
  const business = list.find((candidate) => candidate.slug === slug) ?? list[0];
  if (!business) {
    return null;
  }
  return (
    <section className={styles.demo} aria-labelledby="demo-title">
      <h2 id="demo-title" className={styles.demoTitle}>
        {t('signIn.demoTitle')}
      </h2>
      <p className={styles.demoLead}>{t('signIn.demoLead')}</p>
      <Select
        label={t('signIn.demoBusiness')}
        value={business.slug}
        options={list.map((candidate) => ({
          value: candidate.slug,
          label: `${candidate.name}, ${t(`catalog:verticals.${candidate.vertical.id}`)}`,
        }))}
        onChange={setSlug}
      />
      <PersonaChoice key={business.slug} business={business} />
    </section>
  );
}

function PersonaChoice({ business }: { readonly business: DemoBusiness }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const demoSignIn = useDemoSignIn();
  const roleLabel = useRoleLabel(business.vertical);
  const [role, setRole] = useState<Role | null>(null);
  const persona =
    business.personas.find((candidate) => candidate.role === role) ?? business.personas[0];
  if (!persona) {
    return null;
  }
  return (
    <>
      {business.personas.length > 1 ? (
        <SegmentedControl
          label={t('signIn.demoRole')}
          value={persona.role}
          block
          segments={business.personas.map((candidate) => ({
            value: candidate.role,
            label: roleLabel(candidate.role),
          }))}
          onChange={setRole}
        />
      ) : null}
      <p className={styles.persona}>
        <span className={styles.personaName}>{persona.displayName}</span>
        <span>{t(`signIn.personaAccess.${persona.role}`)}</span>
      </p>
      {demoSignIn.isError ? (
        <p className={styles.formError}>{errorMessage(t, demoSignIn.error)}</p>
      ) : null}
      <Button
        variant="secondary"
        block
        loading={demoSignIn.isPending}
        onClick={() => {
          demoSignIn.mutate(
            { businessSlug: business.slug, role: persona.role },
            { onSuccess: () => void navigate('/', { replace: true }) },
          );
        }}
      >
        {t('signIn.demoSubmit')}
      </Button>
    </>
  );
}
