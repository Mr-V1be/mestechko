import { useFormat } from '@mestechko/booking-ui';
import type { MaxEmulatorChat } from '@mestechko/contracts/client';
import { Avatar, ListGroup, ListItem } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { RichText } from './rich-text';
import styles from './max-emulator.module.css';

/** Clients who use MAX, the latest message of each first. */
export function ChatList({
  chats,
  selected,
  onSelect,
}: {
  readonly chats: readonly MaxEmulatorChat[];
  readonly selected: string | null;
  readonly onSelect: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <ListGroup title={t('maxEmulator.chatsTitle')}>
      {chats.map((chat) => (
        <ListItem
          key={chat.userId}
          selected={chat.userId === selected}
          leading={<Avatar name={chat.clientName} size="sm" />}
          title={chat.clientName}
          description={
            <span className={styles.preview}>
              {chat.lastMessage ? (
                <RichText text={chat.lastMessage.text.split('\n')[0] ?? ''} html />
              ) : (
                t(chat.started ? 'maxEmulator.noMessages' : 'maxEmulator.notStarted')
              )}
            </span>
          }
          meta={
            chat.lastMessage ? format.instant(chat.lastMessage.sentAt, timeZone, 'time') : undefined
          }
          onClick={() => {
            onSelect(chat.userId);
          }}
        />
      ))}
    </ListGroup>
  );
}
