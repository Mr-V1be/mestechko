import { ListGroup, ListItem } from '@mestechko/ui';
import { CalendarDays, ChevronRight, Globe, Send, Smartphone, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The parts of the demo a visitor can move between. */
export const demoSurfaces = {
  landing: { icon: Globe },
  cabinet: { icon: CalendarDays },
  miniapp: { icon: Smartphone },
  bot: { icon: Send },
} as const satisfies Record<string, { readonly icon: LucideIcon }>;

export type DemoSurface = keyof typeof demoSurfaces;

export type DemoLinkTargets = Partial<Readonly<Record<DemoSurface, string>>>;

/**
 * Where else to look in the demo: the product site, the business's cabinet, the
 * client's Mini App and the bot. Each app passes the addresses it knows, minus itself.
 */
export function DemoLinks({ links }: { readonly links: DemoLinkTargets }) {
  const { t } = useTranslation();
  const entries = (Object.keys(demoSurfaces) as DemoSurface[]).flatMap((surface) => {
    const href = links[surface];
    return href ? [{ surface, href }] : [];
  });
  if (entries.length === 0) {
    return null;
  }
  return (
    <ListGroup title={t('common:demoLinks.title')}>
      {entries.map(({ surface, href }) => {
        const Icon = demoSurfaces[surface].icon;
        return (
          <ListItem
            key={surface}
            render={<a href={href} target="_blank" rel="noopener" />}
            leading={<Icon aria-hidden="true" />}
            title={t(`common:demoLinks.${surface}.title`)}
            description={t(`common:demoLinks.${surface}.description`)}
            trailing={<ChevronRight aria-hidden="true" />}
          />
        );
      })}
    </ListGroup>
  );
}
