import { Module } from '@nestjs/common';
import type { Clock, VerticalRegistry } from '@slotwise/domain';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.js';
import { KyselyUnitOfWork } from '../../platform/db/kysely-unit-of-work.js';
import type { AuthKind } from '@slotwise/contracts';
import {
  AUTHENTICATORS,
  type Authenticator,
  type AuthenticatorRegistry,
} from '../../platform/http/principal.js';
import { RATE_LIMITER, type RateLimiter } from '../../shared/application/rate-limits.js';
import { TRANSLATIONS, type Translations } from '../../shared/application/translations.js';
import { CLOCK, ID_GENERATOR, type IdGenerator } from '../../shared/application/ports.js';
import {
  BUSINESS_DIRECTORY,
  MEMBERSHIP_DIRECTORY,
  type BusinessDirectory,
  type MembershipDirectory,
} from '../tenancy/application/business-directory.js';
import { TenancyModule, VERTICAL_REGISTRY } from '../tenancy/tenancy.module.js';
import { AuthController, SESSION_COOKIE_SETTINGS } from './api/auth.controller.js';
import { SessionAuthenticator, TelegramAuthenticator } from './api/authenticators.js';
import { DemoLaunchController } from './api/demo-launch.controller.js';
import { CreateDemoTelegramLaunch } from './application/demo-telegram-launch.js';
import { GetMe } from './application/me.js';
import {
  PASSWORD_HASHER,
  SESSION_STORE,
  SESSION_TOKENS,
  TELEGRAM_LAUNCH_SIGNER,
  TELEGRAM_LAUNCH_VERIFIER,
  USER_ACCOUNTS,
  type PasswordHasher,
  type SessionStore,
  type SessionTokens,
  type TelegramLaunchSigner,
  type TelegramLaunchVerifier,
  type UserAccounts,
} from './application/ports.js';
import { CabinetSessions } from './application/sessions.js';
import { RandomSessionTokens, ScryptPasswordHasher } from './infrastructure/crypto-adapters.js';
import { KyselyIdentityStore } from './infrastructure/kysely-identity-store.js';
import { TmaTelegramLaunch } from './infrastructure/tma-telegram-launch.js';

@Module({
  imports: [TenancyModule],
  controllers: [AuthController, DemoLaunchController],
  providers: [
    {
      provide: KyselyIdentityStore,
      useFactory: (unitOfWork: KyselyUnitOfWork) => new KyselyIdentityStore(unitOfWork),
      inject: [KyselyUnitOfWork],
    },
    { provide: USER_ACCOUNTS, useExisting: KyselyIdentityStore },
    { provide: SESSION_STORE, useExisting: KyselyIdentityStore },
    { provide: PASSWORD_HASHER, useFactory: () => new ScryptPasswordHasher() },
    { provide: SESSION_TOKENS, useFactory: () => new RandomSessionTokens() },
    {
      provide: TmaTelegramLaunch,
      useFactory: (config: AppConfig, clock: Clock) =>
        new TmaTelegramLaunch(
          {
            botToken: config.telegram.botToken,
            demoKey: config.demo.enabled ? config.demo.telegramSigningKey : null,
          },
          config.telegram.initDataTtlSeconds,
          clock,
        ),
      inject: [APP_CONFIG, CLOCK],
    },
    { provide: TELEGRAM_LAUNCH_VERIFIER, useExisting: TmaTelegramLaunch },
    { provide: TELEGRAM_LAUNCH_SIGNER, useExisting: TmaTelegramLaunch },
    {
      provide: CabinetSessions,
      useFactory: (
        accounts: UserAccounts,
        store: SessionStore,
        hasher: PasswordHasher,
        limits: RateLimiter,
        tokens: SessionTokens,
        memberships: MembershipDirectory,
        businesses: BusinessDirectory,
        ids: IdGenerator,
        clock: Clock,
        config: AppConfig,
      ) =>
        new CabinetSessions(
          accounts,
          store,
          hasher,
          limits,
          tokens,
          memberships,
          businesses,
          ids,
          clock,
          {
            ttlDays: config.sessions.ttlDays,
            demoEnabled: config.demo.enabled,
          },
        ),
      inject: [
        USER_ACCOUNTS,
        SESSION_STORE,
        PASSWORD_HASHER,
        RATE_LIMITER,
        SESSION_TOKENS,
        MEMBERSHIP_DIRECTORY,
        BUSINESS_DIRECTORY,
        ID_GENERATOR,
        CLOCK,
        APP_CONFIG,
      ],
    },
    {
      provide: GetMe,
      useFactory: (
        accounts: UserAccounts,
        memberships: MembershipDirectory,
        verticals: VerticalRegistry,
      ) => new GetMe(accounts, memberships, verticals),
      inject: [USER_ACCOUNTS, MEMBERSHIP_DIRECTORY, VERTICAL_REGISTRY],
    },
    {
      provide: CreateDemoTelegramLaunch,
      useFactory: (
        businesses: BusinessDirectory,
        signer: TelegramLaunchSigner,
        config: AppConfig,
        translations: Translations,
      ) => new CreateDemoTelegramLaunch(businesses, signer, config.demo.enabled, translations),
      inject: [BUSINESS_DIRECTORY, TELEGRAM_LAUNCH_SIGNER, APP_CONFIG, TRANSLATIONS],
    },
    {
      provide: SESSION_COOKIE_SETTINGS,
      useFactory: (config: AppConfig) => ({
        secure: config.sessions.cookieSecure,
        path: config.sessions.cookiePath,
      }),
      inject: [APP_CONFIG],
    },
    {
      provide: AUTHENTICATORS,
      useFactory: (
        sessions: CabinetSessions,
        verifier: TelegramLaunchVerifier,
      ): AuthenticatorRegistry =>
        new Map<Exclude<AuthKind, 'none'>, Authenticator>([
          ['session', new SessionAuthenticator(sessions)],
          ['telegram', new TelegramAuthenticator(verifier)],
        ]),
      inject: [CabinetSessions, TELEGRAM_LAUNCH_VERIFIER],
    },
  ],
  exports: [AUTHENTICATORS],
})
export class IdentityModule {}
