/**
 * What the local stand runs: the development API with its workers and bots, and the
 * four web apps on their development servers. PostgreSQL and Redis come from
 * docker compose. Ports are the project's own (see docs/architecture.md).
 */
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));

export interface StandService {
  readonly name: string;
  /** What the owner opens, for the summary. */
  readonly title: string;
  readonly cwd: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly port: number;
  /** Answers 200 once the service is ready. */
  readonly readyPath: string;
  /** The address to open, when it differs from the ready check. */
  readonly openPath?: string;
}

const vite = (app: string, port: number, title: string, readyPath = '/'): StandService => ({
  name: app,
  title,
  cwd: `${root}apps/${app}`,
  command: `${root}apps/${app}/node_modules/.bin/vite`,
  args: ['--port', String(port), '--strictPort'],
  port,
  readyPath,
});

export const standServices: readonly StandService[] = [
  {
    name: 'api',
    title: 'API, фоновые задачи, бот MAX и бот Telegram, если задан его токен',
    cwd: `${root}apps/api`,
    command: process.execPath,
    args: [
      '--env-file-if-exists=../../.env',
      '--conditions=@slotwise/source',
      '--import',
      'tsx',
      'src/main.ts',
    ],
    port: 46210,
    readyPath: '/health/ready',
  },
  vite('landing', 46250, 'Сайт продукта'),
  vite('cabinet', 46220, 'Кабинет (кнопка «Войти в демо»)'),
  vite('miniapp', 46230, 'Mini App в эмуляторе Telegram'),
  vite('widget', 46240, 'Демо-сайт салона с виджетом', '/demo/siren.html'),
];

export const runDir = `${root}.run`;
export const logFile = (service: StandService) => `${runDir}/logs/${service.name}.log`;
export const pidFile = (service: StandService) => `${runDir}/pids/${service.name}.pid`;
export const urlOf = (service: StandService, path = service.openPath ?? service.readyPath) =>
  `http://127.0.0.1:${String(service.port)}${path}`;
