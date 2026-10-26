import { Module, type Provider } from '@nestjs/common';
import type { Clock } from '@slotwise/domain';
import { Api } from 'grammy';
import type { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.js';
import { REDIS } from '../../platform/redis/redis.js';
import { CLOCK } from '../../shared/application/ports.js';
import { TRANSLATIONS, type Translations } from '../../shared/application/translations.js';
import { ClientBookings } from '../booking/application/client/client-bookings.js';
import { ClientBookingChanges } from '../booking/application/lifecycle/client-booking-changes.js';
import { RescheduleOptions } from '../booking/application/lifecycle/reschedule-options.js';
import { BookingModule } from '../booking/booking.module.js';
import {
  CUSTOMER_IDENTITIES,
  MESSENGER_CONTACTS,
  type CustomerIdentities,
  type MessengerContacts,
} from '../clients/application/ports.js';
import { ClientsModule } from '../clients/clients.module.js';
import { DELIVER_NOTIFICATION_HANDLER } from '../notifications/application/notification-jobs.js';
import { NOTIFICATION_STORE, type NotificationStore } from '../notifications/application/ports.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BusinessContextResolver } from '../tenancy/application/business-context.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { WaitlistOffers } from '../waitlist/application/waitlist-offers.js';
import { WaitlistModule } from '../waitlist/waitlist.module.js';
import { MiniAppNotificationsController } from './api/miniapp-notifications.controller.js';
import { TelegramWebhookController } from './api/telegram-webhook.controller.js';
import {
  MESSENGER_CHANNELS,
  MessengerChannels,
  type MessengerChannelAdapter,
} from './application/channel.js';
import { BotMessageBook } from './application/composer/bot-messages.js';
import { BookingDialog } from './application/conversation/booking-dialog.js';
import { BotConversation } from './application/conversation/bot-conversation.js';
import { OfferDialog } from './application/conversation/offer-dialog.js';
import { DeliverNotification } from './application/deliver-notification.js';
import {
  MESSENGER_LINKS,
  NotificationSettings,
  type MessengerLinks,
} from './application/notification-settings.js';
import { UPDATE_DEDUPLICATOR, type UpdateDeduplicator } from './application/update-deduplicator.js';
import { ConfigMessengerLinks } from './infrastructure/config-messenger-links.js';
import { MaxBotApi } from './infrastructure/max/max-bot-api.js';
import { MaxChannel } from './infrastructure/max/max-channel.js';
import { MaxUpdatesPoller } from './infrastructure/max/max-updates.js';
import { RedisUpdateDeduplicator } from './infrastructure/redis-update-deduplicator.js';
import { TelegramBotRuntime } from './infrastructure/telegram/telegram-bot-runtime.js';
import { TelegramChannel } from './infrastructure/telegram/telegram-channel.js';
import { TELEGRAM_RUNTIME } from './infrastructure/telegram/telegram-tokens.js';

const MAX_API = Symbol('MAX_API');
const MS_PER_SECOND = 1_000;

/** Channels are built from configuration; one without credentials is left out. */
function channelsOf(config: AppConfig, maxApi: MaxBotApi | null): MessengerChannelAdapter[] {
  const token = config.telegram.botToken;
  return [
    ...(token
      ? [
          new TelegramChannel(
            new Api(token, {
              apiRoot: config.telegram.apiRoot,
              timeoutSeconds: Math.ceil(config.externalHttp.timeoutMs / MS_PER_SECOND),
            }),
          ),
        ]
      : []),
    ...(maxApi ? [new MaxChannel(maxApi)] : []),
  ];
}

const conversationProviders: Provider[] = [
  {
    provide: BookingDialog,
    useFactory: (
      businesses: BusinessContextResolver,
      bookings: ClientBookings,
      changes: ClientBookingChanges,
      reschedule: RescheduleOptions,
      customers: CustomerIdentities,
      contacts: MessengerContacts,
      messages: BotMessageBook,
      clock: Clock,
    ) =>
      new BookingDialog(
        businesses,
        bookings,
        changes,
        reschedule,
        customers,
        contacts,
        messages,
        clock,
      ),
    inject: [
      BusinessContextResolver,
      ClientBookings,
      ClientBookingChanges,
      RescheduleOptions,
      CUSTOMER_IDENTITIES,
      MESSENGER_CONTACTS,
      BotMessageBook,
      CLOCK,
    ],
  },
  {
    provide: OfferDialog,
    useFactory: (
      businesses: BusinessContextResolver,
      offers: WaitlistOffers,
      messages: BotMessageBook,
    ) => new OfferDialog(businesses, offers, messages),
    inject: [BusinessContextResolver, WaitlistOffers, BotMessageBook],
  },
  {
    provide: BotConversation,
    useFactory: (
      channels: MessengerChannels,
      contacts: MessengerContacts,
      identities: CustomerIdentities,
      messages: BotMessageBook,
      bookings: BookingDialog,
      offers: OfferDialog,
      clock: Clock,
    ) => new BotConversation(channels, contacts, identities, messages, bookings, offers, clock),
    inject: [
      MESSENGER_CHANNELS,
      MESSENGER_CONTACTS,
      CUSTOMER_IDENTITIES,
      BotMessageBook,
      BookingDialog,
      OfferDialog,
      CLOCK,
    ],
  },
];

const runtimeProviders: Provider[] = [
  {
    provide: UPDATE_DEDUPLICATOR,
    useFactory: (redis: Redis) => new RedisUpdateDeduplicator(redis),
    inject: [REDIS],
  },
  {
    provide: TELEGRAM_RUNTIME,
    useFactory: (
      config: AppConfig,
      conversation: BotConversation,
      deduplicator: UpdateDeduplicator,
      logger: PinoLogger,
    ) => {
      const token = config.telegram.botToken;
      if (!token) {
        return null;
      }
      logger.setContext(TelegramBotRuntime.name);
      return new TelegramBotRuntime(config, token, conversation, deduplicator, logger);
    },
    inject: [APP_CONFIG, BotConversation, UPDATE_DEDUPLICATOR, PinoLogger],
  },
  {
    provide: MaxUpdatesPoller,
    useFactory: (
      config: AppConfig,
      api: MaxBotApi | null,
      conversation: BotConversation,
      redis: Redis,
      logger: PinoLogger,
    ) => {
      if (!api) {
        return null;
      }
      logger.setContext(MaxUpdatesPoller.name);
      return new MaxUpdatesPoller(config, api, conversation, redis, logger);
    },
    inject: [APP_CONFIG, MAX_API, BotConversation, REDIS, PinoLogger],
  },
];

/**
 * Messengers: the channel adapters, the bot conversation they feed, and delivery of
 * the outbox's messages through them.
 */
@Module({
  imports: [TenancyModule, ClientsModule, NotificationsModule, BookingModule, WaitlistModule],
  controllers: [TelegramWebhookController, MiniAppNotificationsController],
  providers: [
    {
      provide: BotMessageBook,
      useFactory: (translations: Translations, config: AppConfig) =>
        new BotMessageBook(translations, config.miniApp.publicUrl),
      inject: [TRANSLATIONS, APP_CONFIG],
    },
    {
      provide: MAX_API,
      useFactory: (config: AppConfig) =>
        config.max.botToken
          ? new MaxBotApi({
              baseUrl: config.max.apiBaseUrl,
              token: config.max.botToken,
              timeoutMs: config.externalHttp.timeoutMs,
            })
          : null,
      inject: [APP_CONFIG],
    },
    {
      provide: MESSENGER_CHANNELS,
      useFactory: (config: AppConfig, maxApi: MaxBotApi | null) =>
        new MessengerChannels(channelsOf(config, maxApi)),
      inject: [APP_CONFIG, MAX_API],
    },
    {
      provide: MESSENGER_LINKS,
      useFactory: (config: AppConfig) => new ConfigMessengerLinks(config),
      inject: [APP_CONFIG],
    },
    {
      provide: NotificationSettings,
      useFactory: (contacts: MessengerContacts, links: MessengerLinks) =>
        new NotificationSettings(contacts, links),
      inject: [MESSENGER_CONTACTS, MESSENGER_LINKS],
    },
    {
      provide: DELIVER_NOTIFICATION_HANDLER,
      useFactory: (
        store: NotificationStore,
        contacts: MessengerContacts,
        channels: MessengerChannels,
        businesses: BusinessContextResolver,
        bookings: ClientBookings,
        offers: WaitlistOffers,
        messages: BotMessageBook,
        clock: Clock,
      ) =>
        new DeliverNotification(
          store,
          contacts,
          channels,
          businesses,
          bookings,
          offers,
          messages,
          clock,
        ),
      inject: [
        NOTIFICATION_STORE,
        MESSENGER_CONTACTS,
        MESSENGER_CHANNELS,
        BusinessContextResolver,
        ClientBookings,
        WaitlistOffers,
        BotMessageBook,
        CLOCK,
      ],
    },
    ...conversationProviders,
    ...runtimeProviders,
  ],
  exports: [MESSENGER_CHANNELS, BotMessageBook, BotConversation],
})
export class MessagingModule {}
