import { useFormat } from '@slotwise/booking-ui';
import type { MaxEmulatorMessage } from '@slotwise/contracts/client';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Skeleton,
  StatePanel,
  TextField,
  useToast,
} from '@slotwise/ui';
import { clsx } from 'clsx';
import { ArrowLeft, ExternalLink, Play, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMaxChat, useMaxChatActions } from '../../platform/api/max-emulator-queries';
import { errorMessage } from '../common/error-message';
import { QueryErrorState } from '../common/states';
import { RichText } from './rich-text';
import styles from './max-emulator.module.css';

type Entry =
  | { readonly kind: 'message'; readonly at: string; readonly message: MaxEmulatorMessage }
  | { readonly kind: 'notice'; readonly at: string; readonly text: string };

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Messages and the bot's one-time notices, in the order the client saw them. */
function timelineOf(
  messages: readonly MaxEmulatorMessage[],
  notices: readonly { text: string; shownAt: string }[],
): Entry[] {
  return [
    ...messages.map((message): Entry => ({ kind: 'message', at: message.sentAt, message })),
    ...notices.map((notice): Entry => ({ kind: 'notice', at: notice.shownAt, text: notice.text })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

function MessageBubble({
  message,
  pressing,
  onPress,
}: {
  readonly message: MaxEmulatorMessage;
  readonly pressing: boolean;
  readonly onPress: (payload: string) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <div className={clsx(styles.row, !message.fromBot && styles.rowOwn)}>
      <div className={clsx(styles.bubble, !message.fromBot && styles.bubbleOwn)}>
        {message.text ? (
          <p className={styles.text}>
            <RichText text={message.text} html={message.format === 'html'} />
          </p>
        ) : null}
        <span className={styles.time}>
          {message.editedAt ? `${t('maxEmulator.edited')} · ` : ''}
          {format.instant(message.editedAt ?? message.sentAt, timeZone, 'time')}
        </span>
      </div>
      {message.buttons.length > 0 ? (
        <div className={styles.keyboard}>
          {message.buttons.map((row, rowIndex) => (
            <div key={rowIndex} className={styles.keyboardRow}>
              {row.map((button) =>
                button.type === 'callback' ? (
                  <Button
                    key={button.payload}
                    variant={button.intent === 'positive' ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={pressing}
                    onClick={() => {
                      onPress(button.payload);
                    }}
                  >
                    {button.text}
                  </Button>
                ) : (
                  <Button
                    key={button.url}
                    variant="secondary"
                    size="sm"
                    icon={<ExternalLink />}
                    onClick={() => window.open(button.url, '_blank', 'noopener,noreferrer')}
                  >
                    {button.text}
                  </Button>
                ),
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One client's chat with the bot as their MAX app would show it, and what they can do. */
export function ChatPanel({
  businessId,
  userId,
  onBack,
}: {
  readonly businessId: string;
  readonly userId: string;
  readonly onBack: (() => void) | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const chat = useMaxChat(businessId, userId);
  const actions = useMaxChatActions(businessId, userId);
  const [text, setText] = useState('');
  const stream = useRef<HTMLDivElement>(null);
  const data = chat.data;
  const timeline = data ? timelineOf(data.messages, data.notices) : [];
  const latest = timeline.at(-1)?.at;

  // New messages scroll the chat, never the page around it.
  useEffect(() => {
    const element = stream.current;
    if (element && latest) {
      element.scrollTop = element.scrollHeight;
    }
  }, [latest]);

  const failed = (error: unknown) => {
    toast.show({ title: errorMessage(t, error), tone: 'error' });
  };
  const send = () => {
    const message = text.trim();
    if (!message) {
      return;
    }
    actions.send.mutate(message, {
      onSuccess: () => {
        setText('');
      },
      onError: failed,
    });
  };

  return (
    <section className={styles.panel} aria-label={data?.chat.clientName}>
      <header className={styles.panelHeader}>
        {onBack ? (
          <IconButton label={t('maxEmulator.back')} icon={<ArrowLeft />} onClick={onBack} />
        ) : null}
        <Avatar name={data?.chat.clientName ?? ''} size="sm" />
        <div className={styles.panelTitle}>
          <p className={styles.panelName}>{data?.chat.clientName}</p>
          <p className={styles.panelBot}>{t('maxEmulator.botName')}</p>
        </div>
        <Badge tone="outline">{t('channels.max')}</Badge>
      </header>
      <div ref={stream} className={styles.stream}>
        {chat.isPending ? (
          <div className={styles.streamSkeleton}>
            <Skeleton height="var(--size-control-lg)" />
            <Skeleton height="calc(var(--size-control-lg) * 2)" />
          </div>
        ) : null}
        {chat.isError ? (
          <QueryErrorState error={chat.error} onRetry={() => void chat.refetch()} />
        ) : null}
        {data && !data.chat.started && timeline.length === 0 ? (
          <StatePanel
            compact
            title={t('maxEmulator.notStarted')}
            description={t('maxEmulator.notStartedDescription')}
            action={
              <Button
                icon={<Play />}
                loading={actions.start.isPending}
                onClick={() => {
                  actions.start.mutate(undefined, { onError: failed });
                }}
              >
                {t('maxEmulator.start')}
              </Button>
            }
          />
        ) : null}
        {timeline.map((entry) =>
          entry.kind === 'message' ? (
            <MessageBubble
              key={entry.message.id}
              message={entry.message}
              pressing={actions.press.isPending}
              onPress={(payload) => {
                actions.press.mutate({ messageId: entry.message.id, payload }, { onError: failed });
              }}
            />
          ) : (
            <p key={`notice-${entry.at}`} className={styles.notice}>
              {entry.text}
            </p>
          ),
        )}
      </div>
      {data?.chat.started || timeline.length > 0 ? (
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className={styles.composerField}>
            <TextField
              label={t('maxEmulator.messagePlaceholder')}
              hideLabel
              placeholder={t('maxEmulator.messagePlaceholder')}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </div>
          <IconButton
            type="submit"
            label={t('maxEmulator.send')}
            icon={<SendHorizontal />}
            soft
            disabled={!text.trim() || actions.send.isPending}
          />
        </form>
      ) : null}
    </section>
  );
}
