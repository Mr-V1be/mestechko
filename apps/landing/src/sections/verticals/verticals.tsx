import { useVocabulary, VerticalIcon } from '@mestechko/booking-ui';
import type { VerticalSummary } from '@mestechko/contracts/client';
import { verticalRegistry, type VerticalDefinition } from '@mestechko/domain';
import { useTranslation } from 'react-i18next';
import page from '../../app/page.module.css';
import styles from './verticals.module.css';

/** Typical services shown on a card; the vertical has more. */
const SAMPLE_SERVICES = 4;

function summaryOf(vertical: VerticalDefinition): VerticalSummary {
  return { id: vertical.id, icon: vertical.presentation.icon, vocabulary: vertical.vocabulary };
}

function VerticalCard({ vertical }: { readonly vertical: VerticalDefinition }) {
  const { t } = useTranslation();
  const vocabulary = useVocabulary(summaryOf(vertical));
  return (
    <article className={styles.card}>
      <span className={styles.icon}>
        <VerticalIcon name={vertical.presentation.icon} />
      </span>
      <h3 className={styles.name}>{vocabulary.verticalName}</h3>
      <p className={styles.words}>
        {t('verticals.words', { staff: vocabulary.staffOne, resource: vocabulary.resourceOne })}
      </p>
      <ul className={styles.services}>
        {vertical.serviceTemplates.slice(0, SAMPLE_SERVICES).map((service) => (
          <li key={service.key}>{t(`catalog:services.${vertical.id}.${service.key}.name`)}</li>
        ))}
      </ul>
    </article>
  );
}

/** Lines of business from the registry: a new vertical shows up here by itself. */
export function Verticals() {
  const { t } = useTranslation();
  return (
    <section id="verticals" className={page.section}>
      <div className={page.inner}>
        <div className={page.heading}>
          <h2 className={page.title}>{t('verticals.title')}</h2>
          <p className={page.lead}>{t('verticals.lead')}</p>
        </div>
        <div className={styles.grid}>
          {verticalRegistry.list().map((vertical) => (
            <VerticalCard key={vertical.id} vertical={vertical} />
          ))}
        </div>
      </div>
    </section>
  );
}
