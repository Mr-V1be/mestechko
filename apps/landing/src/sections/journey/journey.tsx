import { DeviceFrame, type DeviceKind } from '@mestechko/ui';
import { clsx } from 'clsx';
import {
  BellRing,
  CalendarCheck,
  Hourglass,
  ListOrdered,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import page from '../../app/page.module.css';
import { LoopVideo } from '../../media/loop-video';
import { type Loop, type SiteMedia, type ThemedMedia } from '../../media/media';
import { useSiteMedia } from '../../media/use-media';
import { ThemedImage } from '../../media/themed-image';
import styles from './journey.module.css';

/** Which part of the device a tile keeps in view when the device is taller than the tile. */
type Shows = 'top' | 'bottom' | 'whole';

interface Screen {
  readonly device: DeviceKind;
  readonly shows: Shows;
  /** A loop of the moment in the real app, or a still of it. */
  readonly media: { readonly loop: Loop } | { readonly shot: ThemedMedia };
}

interface Moment {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly screen?: Screen;
  /** The tile's place in the bento grid. */
  readonly size: 'tall' | 'wide' | 'small' | 'side';
}

const showsClass: Record<Shows, string | undefined> = {
  top: styles.showsTop,
  bottom: styles.showsBottom,
  whole: styles.showsWhole,
};

/** The path of a booking, from the client's tap to the reminder, in the product's own screens. */
const momentsOf = ({ shots, loops }: SiteMedia): readonly Moment[] => [
  {
    id: 'book',
    icon: Smartphone,
    screen: { device: 'phone', shows: 'top', media: { loop: loops.booking } },
    size: 'tall',
  },
  {
    id: 'schedule',
    icon: CalendarCheck,
    screen: { device: 'laptop', shows: 'whole', media: { loop: loops.drag } },
    size: 'wide',
  },
  { id: 'prepay', icon: Hourglass, size: 'small' },
  { id: 'noDouble', icon: ShieldCheck, size: 'small' },
  {
    id: 'remind',
    icon: BellRing,
    screen: { device: 'phone', shows: 'bottom', media: { loop: loops.remind } },
    size: 'side',
  },
  {
    id: 'waitlist',
    icon: ListOrdered,
    screen: { device: 'phone', shows: 'bottom', media: { shot: shots.waitlist } },
    size: 'small',
  },
];

function MomentScreen({ screen, label }: { readonly screen: Screen; readonly label: string }) {
  return (
    <div className={clsx(styles.media, showsClass[screen.shows])}>
      <DeviceFrame kind={screen.device} className={styles[screen.device]}>
        {'loop' in screen.media ? (
          <LoopVideo loop={screen.media.loop} label={label} />
        ) : (
          <ThemedImage media={screen.media.shot} alt={label} />
        )}
      </DeviceFrame>
    </div>
  );
}

export function Journey() {
  const { t } = useTranslation();
  const moments = momentsOf(useSiteMedia());
  return (
    <section id="how" className={page.section}>
      <div className={page.inner}>
        <div className={page.heading}>
          <h2 className={page.title}>{t('journey.title')}</h2>
        </div>
        <div className={styles.grid}>
          {moments.map((moment) => {
            const Icon = moment.icon;
            const title = t(`journey.${moment.id}.title`);
            return (
              <article key={moment.id} className={clsx(styles.tile, styles[moment.size])}>
                {moment.screen ? <MomentScreen screen={moment.screen} label={title} /> : null}
                <div className={styles.text}>
                  <span className={styles.icon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <h3 className={styles.tileTitle}>{title}</h3>
                  <p className={styles.tileText}>{t(`journey.${moment.id}.text`)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
