import type { ClientSummary } from '@slotwise/contracts/client';
import { Avatar, Badge, Button, IconButton, useToast } from '@slotwise/ui';
import { ArrowLeft, MessageCircle, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUpdateClientTags } from '../../../platform/api/clients-queries';
import { errorMessage } from '../../common/error-message';
import { useClientDates } from '../client-dates';
import { ClientTagsField } from '../profile/client-tags-field';
import styles from './card.module.css';

export interface CardHeaderProps {
  readonly businessId: string;
  readonly client: ClientSummary;
  readonly timeZone: string;
  readonly onBack: () => void;
  readonly onEdit: () => void;
}

/** Who the client is: name, messenger, since when, and tags edited in place. */
export function CardHeader({ businessId, client, timeZone, onBack, onEdit }: CardHeaderProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useClientDates(timeZone);
  const tags = useUpdateClientTags(businessId, client.id);
  return (
    <header className={styles.header}>
      <div className={styles.back}>
        <IconButton label={t('clients:card.back')} icon={<ArrowLeft />} onClick={onBack} />
      </div>
      <div className={styles.identity}>
        <Avatar name={client.displayName} size="lg" />
        <div className={styles.identityText}>
          <h1 className={styles.name}>{client.displayName}</h1>
          <p className={styles.since}>
            {client.messenger ? (
              <Badge tone="accent" className={styles.messenger}>
                <MessageCircle aria-hidden="true" />
                {t('clients:card.messenger', { channel: t(`channels.${client.messenger}`) })}
              </Badge>
            ) : null}
            <span>{t('clients:card.since', { date: dates.day(client.createdAt) })}</span>
          </p>
        </div>
      </div>
      <div className={styles.edit}>
        <Button variant="secondary" icon={<Pencil />} onClick={onEdit}>
          {t('clients:card.edit')}
        </Button>
      </div>
      <div className={styles.headerTags}>
        <ClientTagsField
          businessId={businessId}
          value={client.tags}
          appearance="inline"
          hideLabel
          onChange={(next) => {
            tags.mutate(next, {
              onError: (error) => {
                toast.show({
                  title: t('clients:tags.saveFailed'),
                  description: errorMessage(t, error),
                  tone: 'error',
                });
              },
            });
          }}
        />
      </div>
    </header>
  );
}
