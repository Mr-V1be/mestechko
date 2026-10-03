import { DeviceFrame, type DeviceKind } from '@mestechko/ui';
import {
  BarChart3,
  BellRing,
  CalendarRange,
  Code2,
  ListOrdered,
  MessageCircleMore,
  Palette,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { shots, type ThemedMedia } from '../../media/media';
import { ThemedImage } from '../../media/themed-image';
import page from '../../app/page.module.css';
import styles from './surfaces.module.css';

interface Surface {
  readonly id: string;
  readonly device: DeviceKind;
  readonly media: ThemedMedia;
  readonly address?: string;
  readonly points: readonly { readonly id: string; readonly icon: LucideIcon }[];
}

/** The parts of the product a business works with, each on its own device. */
const surfaces: readonly Surface[] = [
  {
    id: 'cabinet',
    device: 'laptop',
    media: shots.reports,
    points: [
      { id: 'schedule', icon: CalendarRange },
      { id: 'clients', icon: Users },
      { id: 'reports', icon: BarChart3 },
    ],
  },
  {
    id: 'widget',
    device: 'browser',
    media: shots.widget,
    address: 'salon-siren.example',
    points: [
      { id: 'embed', icon: Code2 },
      { id: 'theme', icon: Palette },
      { id: 'isolation', icon: Shield },
    ],
  },
  {
    id: 'max',
    device: 'laptop',
    media: shots.max,
    points: [
      { id: 'remind', icon: BellRing },
      { id: 'buttons', icon: MessageCircleMore },
      { id: 'offer', icon: ListOrdered },
    ],
  },
];

export function Surfaces() {
  const { t } = useTranslation();
  return (
    <section id="surfaces" className={`${page.section} ${page.tinted}`}>
      <div className={page.inner}>
        <div className={page.heading}>
          <h2 className={page.title}>{t('surfaces.title')}</h2>
        </div>
        <div className={styles.rows}>
          {surfaces.map((surface) => (
            <article key={surface.id} className={styles.row}>
              <div className={styles.visual}>
                <DeviceFrame
                  kind={surface.device}
                  className={styles[surface.device]}
                  {...(surface.address ? { address: surface.address } : {})}
                >
                  <ThemedImage media={surface.media} alt={t(`surfaces.${surface.id}.title`)} />
                </DeviceFrame>
              </div>
              <div className={styles.copy}>
                <h3 className={styles.rowTitle}>{t(`surfaces.${surface.id}.title`)}</h3>
                <p className={styles.rowText}>{t(`surfaces.${surface.id}.text`)}</p>
                <ul className={styles.points}>
                  {surface.points.map((point) => {
                    const Icon = point.icon;
                    return (
                      <li key={point.id} className={styles.point}>
                        <Icon aria-hidden="true" />
                        {t(`surfaces.${surface.id}.points.${point.id}`)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
