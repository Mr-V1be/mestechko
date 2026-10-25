import { useFormat, useLocale } from '@mestechko/booking-ui';
import {
  locales,
  pricingPlanIds,
  pricingPlans,
  TRIAL_DAYS,
  type PlanFeature,
  type PricingPlan,
  type PricingPlanId,
} from '@mestechko/domain';
import { Badge, Button } from '@mestechko/ui';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import page from '../../app/page.module.css';
import styles from './pricing.module.css';

/** The plan offered before this one: a card lists only what it adds to that plan. */
function previousOf(id: PricingPlanId): PricingPlanId | null {
  return pricingPlanIds[pricingPlanIds.indexOf(id) - 1] ?? null;
}

function PlanCard({
  id,
  plan,
  onDemo,
}: {
  readonly id: PricingPlanId;
  readonly plan: PricingPlan;
  readonly onDemo: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const { locale } = useLocale();
  const previous = previousOf(id);
  const included = new Set<PlanFeature>(previous ? pricingPlans[previous].features : []);
  const added = plan.features.filter((feature) => !included.has(feature));
  return (
    <article className={`${styles.plan} ${plan.recommended ? styles.recommended : ''}`}>
      <div className={styles.planHead}>
        <h3 className={styles.planName}>{t(`pricing.plans.${id}.name`)}</h3>
        {plan.recommended ? <Badge tone="accent">{t('pricing.recommended')}</Badge> : null}
      </div>
      <p className={styles.planText}>{t(`pricing.plans.${id}.text`)}</p>
      <p className={styles.price}>
        <span className={styles.amount}>
          {format.money(plan.monthlyPrices[locales[locale].marketCurrency])}
        </span>
        <span className={styles.period}>{t('pricing.perMonth')}</span>
      </p>
      <ul className={styles.limits}>
        <li>
          {plan.maxStaff === null
            ? t('pricing.staffUnlimited')
            : t('pricing.staff', { count: plan.maxStaff })}
        </li>
        <li>
          {plan.maxLocations === null
            ? t('pricing.locationsUnlimited')
            : t('pricing.locations', { count: plan.maxLocations })}
        </li>
      </ul>
      <ul className={styles.features}>
        {previous ? (
          <li className={styles.everything}>
            {t('pricing.everythingIn', { plan: t(`pricing.plans.${previous}.name`) })}
          </li>
        ) : null}
        {added.map((feature) => (
          <li key={feature} className={styles.feature}>
            <Check aria-hidden="true" />
            {t(`pricing.features.${feature}`)}
          </li>
        ))}
      </ul>
      <Button block variant={plan.recommended ? 'primary' : 'secondary'} onClick={onDemo}>
        {t('pricing.cta')}
      </Button>
    </article>
  );
}

/** Plans from the pricing registry: prices, limits and what each includes. */
export function Pricing({ onDemo }: { readonly onDemo: () => void }) {
  const { t } = useTranslation();
  return (
    <section id="pricing" className={`${page.section} ${page.tinted}`}>
      <div className={page.inner}>
        <div className={page.heading}>
          <h2 className={page.title}>{t('pricing.title')}</h2>
          <p className={page.lead}>{t('pricing.lead', { days: TRIAL_DAYS })}</p>
        </div>
        <div className={styles.grid}>
          {pricingPlanIds.map((id) => (
            <PlanCard key={id} id={id} plan={pricingPlans[id]} onDemo={onDemo} />
          ))}
        </div>
      </div>
    </section>
  );
}
