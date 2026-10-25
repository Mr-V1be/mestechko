import { useLocale } from '@mestechko/booking-ui';
import { offersMessenger, type Locale, type MessengerChannel } from '@mestechko/domain';
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
import type { SiteMedia, ThemedMedia } from '../../media/media';
import { useSiteMedia } from '../../media/use-media';
import { ThemedImage } from '../../media/themed-image';
import page from '../../app/page.module.css';
import styles from './surfaces.module.css';

interface Surface {
  readonly id: string;
  readonly device: DeviceKind;
  readonly media: (media: SiteMedia) => ThemedMedia;
  /** The address bar of a browser frame: the demo site of the reader's language. */
  readonly address?: Readonly<Record<Locale, string>>;
  /** A surface of one messenger, shown only to readers who are offered it. */
  readonly messenger?: MessengerChannel;
  readonly points: readonly { readonly id: string; readonly icon: LucideIcon }[];
}

/** The parts of the product a business works with, each on its own device. */
const surfaces: readonly Surface[] = [
  {
    id: 'cabinet',
    device: 'laptop',
    media: ({ shots }) => shots.reports,
    points: [
      { id: 'schedule', icon: CalendarRange },
      { id: 'clients', icon: Users },
      { id: 'reports', icon: BarChart3 },
    ],
  },
  {
    id: 'widget',
    device: 'browser',
    media: ({ shots }) => shots.widget,
    address: { en: 'marigold-studio.example', ru: 'salon-siren.example' },
    points: [
      { id: 'embed', icon: Code2 },
      { id: 'theme', icon: Palette },
      { id: 'isolation', icon: Shield },
    ],
  },
  {
    id: 'max',
    device: 'laptop',
    media: ({ shots }) => shots.max,
    messenger: 'max',
    points: [
      { id: 'remind', icon: BellRing },
      { id: 'buttons', icon: MessageCircleMore },
      { id: 'offer', icon: ListOrdered },
    ],
  },
];

export function Surfaces() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const media = useSiteMedia();
  const shown = surfaces.filter(
    (surface) => !surface.messenger || offersMessenger(locale, surface.messenger),
  );
  return (
    <section id="surfaces" className={`${page.section} ${page.tinted}`}>
      <div className={page.inner}>
        <div className={page.heading}>
          <h2 className={page.title}>{t('surfaces.title')}</h2>
        </div>
        <div className={styles.rows}>
          {shown.map((surface) => (
            <article key={surface.id} className={styles.row}>
              <div className={styles.visual}>
                <DeviceFrame
                  kind={surface.device}
                  className={styles[surface.device]}
                  {...(surface.address ? { address: surface.address[locale] } : {})}
                >
                  <ThemedImage
                    media={surface.media(media)}
                    alt={t(`surfaces.${surface.id}.title`)}
                  />
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
