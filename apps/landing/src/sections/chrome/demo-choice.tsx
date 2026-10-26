import { Dialog, ListGroup, ListItem } from '@slotwise/ui';
import { CalendarDays, ChevronRight, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { siteConfig } from '../../app/config';

/** The two doors into the live demo: the business's cabinet and the client's Mini App. */
export function DemoChoice({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('demoChoice.title')}
      closeLabel={t('demoChoice.close')}
    >
      <ListGroup>
        <ListItem
          render={<a href={`${siteConfig.cabinetUrl}/sign-in`} />}
          leading={<CalendarDays aria-hidden="true" />}
          title={t('demoChoice.cabinet')}
          description={t('demoChoice.cabinetText')}
          trailing={<ChevronRight aria-hidden="true" />}
        />
        <ListItem
          render={<a href={siteConfig.miniappUrl} />}
          leading={<Smartphone aria-hidden="true" />}
          title={t('demoChoice.miniapp')}
          description={t('demoChoice.miniappText')}
          trailing={<ChevronRight aria-hidden="true" />}
        />
      </ListGroup>
    </Dialog>
  );
}
