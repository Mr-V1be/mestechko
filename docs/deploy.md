# Выкатка в продакшен

Весь продукт работает на одном сервере в Docker: `docker-compose.prod.yml` собирает образы
из исходников, Caddy сам получает сертификаты Let's Encrypt, миграции применяются при
каждой выкатке, PostgreSQL каждую ночь сохраняется в резервную копию.

## Что разворачивается

| Сервис       | Образ                                              | Что делает                                                                        |
| ------------ | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `edge`       | `deploy/docker/edge.Dockerfile` (Caddy)            | TLS для всех имён, маршрутизация, HTTP/2 и HTTP/3, сжатие, заголовки безопасности |
| `landing`    | `deploy/docker/web.Dockerfile`, `APP=landing`      | сайт продукта (заранее отрендеренный)                                             |
| `cabinet`    | то же, `APP=cabinet`                               | кабинет заведения                                                                 |
| `miniapp`    | то же, `APP=miniapp`                               | Mini App клиента                                                                  |
| `widget`     | то же, `APP=widget`                                | виджет записи для сайтов и демо-сайт салона                                       |
| `api`        | `deploy/docker/api.Dockerfile`                     | HTTP API (`APP_ROLES=api`): приложения, вебхук Telegram, уведомления оплат        |
| `worker`     | тот же образ, `APP_ROLES=worker`                   | очереди BullMQ: напоминания, рассылки, снятие удержаний, календари                |
| `bot`        | тот же образ, `APP_ROLES=bot`                      | регистрирует вебхук Telegram при старте, читает обновления MAX                    |
| `migrate`    | тот же образ, разовый запуск                       | роль приложения в базе и миграции — перед стартом нового кода                     |
| `demo-reset` | тот же образ, профиль `demo`                       | ночной сброс демо-данных (`DEMO_RESET_CRON`, по умолчанию 04:00 МСК)              |
| `postgres`   | `postgres:18.6-alpine`                             | база данных                                                                       |
| `redis`      | `redis:8.10.2-alpine`                              | очереди, дедупликация обновлений ботов, лимиты                                    |
| `backup`     | `postgres:18.6-alpine` + `deploy/backup/backup.sh` | ночной `pg_dump` в `./backups`, хранение 14 дней                                  |

Устройство образов:

- **Многоступенчатая сборка.** Зависимости ставятся из `pnpm-lock.yaml` (`pnpm fetch`,
  затем `install --offline`), код компилируется, в итоговый образ попадают только
  скомпилированный код и продакшен-зависимости (`pnpm deploy --prod`). Веб-образы
  содержат только собранную статику и Caddy.
- **Непривилегированные пользователи.** API работает от `node` (uid 1000), веб-образы и
  edge — от собственных пользователей (uid 10001); Caddy слушает 80/443 через файловую
  capability, без root. Веб-контейнеры запускаются с файловой системой только для чтения.
- **Проверки здоровья.** У API — `/health/ready` (база и Redis отвечают); у `worker`,
  `bot` и `demo-reset`, у которых нет HTTP, — свежесть файла-пульса, который процесс
  обновляет каждые 15 секунд, пока отвечают база и Redis (`dist/cli/healthcheck.js`).
  У веб-образов и edge — `/healthz`. Сервисы стартуют по порядку зависимостей и только
  на здоровых предшественниках.
- **Сети.** `data` — внутренняя, без выхода наружу: PostgreSQL, Redis, бэкапы. `edge` —
  публичная сторона: Caddy, приложения и процессы, которым нужен интернет (Telegram,
  MAX, производственный календарь). Наружу опубликованы только 80 и 443 у `edge`.
- **Секреты** — только в `.env.production` на сервере (права 600). Каждый сервис получает
  лишь свои переменные: пароль владельца базы видят только `migrate`, `demo-reset` и
  `backup`, процессы приложения подключаются ролью `mestechko_app` под RLS. В веб-образы
  при сборке попадают только публичные адреса (`VITE_*`).
- **Логи** — в stdout в JSON; Docker ротирует их: не больше пяти файлов по 10 МБ на сервис.

## Требования к серверу

- Ubuntu Server 24.04 LTS, x86-64, публичный IPv4-адрес.
- 2 vCPU и 4 ГБ ОЗУ (сборка образов на самом сервере; для работы хватает и 2 ГБ),
  25 ГБ SSD.
- Открытые входящие порты: 22/tcp (SSH), 80/tcp и 443/tcp (HTTP и HTTPS), 443/udp
  (HTTP/3). Порт 80 нужен Let's Encrypt для выпуска сертификатов.
- Пять DNS-имён с A-записью на IP сервера: сайт, кабинет, Mini App, виджет, API.
  Например: `mestechko.ru`, `app.mestechko.ru`, `miniapp.mestechko.ru`,
  `widget.mestechko.ru`, `api.mestechko.ru`.

Нагрузку одного такого сервера см. в [performance.md](performance.md).

## Что нужно от владельца

1. Сервер с параметрами выше и SSH-доступ к нему по ключу; добавить deploy-ключ сервера в
   репозиторий GitHub (шаг 3) — или дать доступ, чтобы это сделали мы.
2. Домен и пять DNS-записей на IP сервера (или доступ к DNS-панели).
3. Адрес почты для Let's Encrypt (`ACME_EMAIL`).
4. Токен бота Telegram от @BotFather (`TELEGRAM_BOT_TOKEN`) и его имя
   (`TELEGRAM_BOT_USERNAME`, сейчас `mestechko_zapis_bot`). После выкатки бот переходит
   на вебхук, и локальная разработка с тем же токеном перестаёт получать обновления:
   Telegram отдаёт их одному получателю. Для разработки удобнее отдельный бот.
5. Решение: публичное демо (`DEMO_MODE=true`, эмуляторы MAX и тестовой кассы, ночной
   сброс) или рабочая установка для заведений.
6. Для рабочей установки — договор с платёжным провайдером и его ключи, а для MAX —
   токен настоящего бота MAX. В демо оба эмулятора встроены в API.

## Пошаговая выкатка на чистый Ubuntu

Команды выполняются на сервере от пользователя с `sudo`.

### 1. Система и брандмауэр

```sh
sudo apt update && sudo apt -y upgrade
sudo apt -y install ca-certificates curl git ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable
sudo timedatectl set-timezone Europe/Moscow
```

### 2. Docker Engine и Compose

Из официального репозитория Docker:

```sh
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"   # перелогиньтесь, чтобы группа применилась
docker compose version
```

### 3. Код

Репозиторий приватный: серверу нужен доступ на чтение — deploy-ключ GitHub.

```sh
ssh-keygen -t ed25519 -N '' -f ~/.ssh/mestechko_deploy -C "deploy@$(hostname)"
cat ~/.ssh/mestechko_deploy.pub   # добавить в GitHub: Settings → Deploy keys (только чтение)
printf 'Host github.com\n  IdentityFile ~/.ssh/mestechko_deploy\n' >> ~/.ssh/config

sudo install -d -o "$USER" -g "$USER" /opt/mestechko
git clone git@github.com:Mr-V1be/mestechko.git /opt/mestechko
cd /opt/mestechko
git checkout main            # или тег выпуска, например v1.0.0
```

### 4. Настройки и секреты

```sh
cp .env.production.example .env.production
chmod 600 .env.production
```

Заполните в `.env.production`:

- `SITE_DOMAIN`, `CABINET_DOMAIN`, `MINIAPP_DOMAIN`, `WIDGET_DOMAIN`, `API_DOMAIN`,
  `ACME_EMAIL`;
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`;
- секреты — каждый своей командой:

```sh
for key in POSTGRES_PASSWORD APP_DB_PASSWORD REDIS_PASSWORD; do
  sed -i "s|^$key=.*|$key=$(openssl rand -hex 24)|" .env.production
done
for key in TELEGRAM_WEBHOOK_SECRET TEST_PAY_SECRET_KEY TEST_PAY_WEBHOOK_SECRET \
           WIDGET_SIGNING_KEY TELEGRAM_DEMO_SIGNING_KEY; do
  sed -i "s|^$key=.*|$key=$(openssl rand -hex 32)|" .env.production
done
```

Для публичного демо дополнительно:

```sh
DEMO_MODE=true
TEST_PAY_EMULATOR_ENABLED=true
MAX_EMULATOR_ENABLED=true
MAX_BOT_TOKEN=<любые 16+ символов, например openssl rand -hex 16>
MAX_API_BASE_URL=http://api:46210/max-emulator
```

`MINIAPP_PUBLIC_URL`, адрес вебхука Telegram (`https://API_DOMAIN/v1/telegram/webhook`) и
страница возврата после оплаты составляются из имён автоматически — отдельно задавать их
не нужно. Значения `HTTP_PORT`, `HTTPS_PORT`, `PUBLIC_BIND`, `PUBLIC_PORT_SUFFIX` оставьте
как в примере.

### 5. Каталог резервных копий

Бэкапы пишет пользователь `postgres` контейнера (uid 70):

```sh
sudo install -d -o 70 -g 70 -m 700 /opt/mestechko/backups
```

### 6. Сборка и запуск

```sh
cd /opt/mestechko
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --wait
# Для публичного демо — с профилем demo (ночной сброс демо-данных):
docker compose --env-file .env.production -f docker-compose.prod.yml --profile demo up -d --wait
```

Первая сборка занимает 5–10 минут. `up` сначала поднимает базу, затем разово выполняет
`migrate` (роль приложения и миграции), и только после его успеха стартуют `api`, `worker`,
`bot` и остальные. `--wait` возвращается, когда все сервисы здоровы.

Проверка:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS https://api.<домен>/health/ready        # {"status":"ok"}
```

Сертификаты Let's Encrypt Caddy выпускает при первом обращении к каждому имени; их
хранит том `caddy-data`, он переживает пересборки.

### 7. Демо-данные (только для публичного демо)

Первичное заполнение; дальше их каждую ночь возвращает к исходным `demo-reset`:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml --profile demo \
  run --rm --no-deps demo-reset node dist/cli/seed.js
```

### 8. Бот Telegram: `pnpm bot:setup` после выкатки

В продакшене бот получает обновления через вебхук: сервис `bot` при каждом старте
регистрирует `https://API_DOMAIN/v1/telegram/webhook` с секретом
`TELEGRAM_WEBHOOK_SECRET`, Telegram присылает обновления на `api`.

Профиль бота — команды, описание, короткое описание и кнопка меню, открывающая Mini App
по адресу `MINIAPP_PUBLIC_URL`, — настраивается командой `pnpm bot:setup`. В
продакшен-образе это тот же скрипт, скомпилированный:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  node dist/cli/setup-telegram-bot.js          # = pnpm bot:setup
```

Повторять после смены домена Mini App или текстов бота. Затем — проверка вживую: `/start`
в боте, кнопка «Записаться» открывает Mini App, запись, подтверждение в чате. Для демо
есть и сценарная проверка (`pnpm bot:check`): запись или лист ожидания от имени того, кто
последним нажал `/start`, с подтверждением и напоминаниями в чате:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  node dist/cli/bot-check.js booking --business siren   # = pnpm bot:check booking
```

## Обновление

```sh
cd /opt/mestechko
git fetch && git checkout <тег или main> && git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml [--profile demo] up -d --build --wait
```

Миграции применяются автоматически перед стартом нового кода. Пересоздаются только
изменившиеся сервисы; перерыв — секунды на перезапуск `api`. Образы можно собирать и в
CI, тогда на сервере вместо `--build` — `pull` из реестра (`IMAGE_TAG`).

**Откат кода:** `git checkout <предыдущий тег>` и та же команда `up -d --build`. Миграции
идут только вперёд: если новая версия изменила схему несовместимо, база
восстанавливается из резервной копии, сделанной перед выкаткой (см. ниже).

## Резервные копии

Сервис `backup` каждую ночь в `BACKUP_TIME` (03:30 по `BACKUP_TZ`) делает `pg_dump` в
формате custom в `/opt/mestechko/backups` и удаляет копии старше `BACKUP_KEEP_DAYS` (14).

```sh
# Копия прямо сейчас — например, перед выкаткой
docker compose --env-file .env.production -f docker-compose.prod.yml exec backup \
  /usr/local/bin/backup.sh now
ls -lh /opt/mestechko/backups
```

Восстановление (останавливает запись на время восстановления):

```sh
cd /opt/mestechko
docker compose --env-file .env.production -f docker-compose.prod.yml stop api worker bot demo-reset
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U mestechko -d mestechko --clean --if-exists --no-owner < backups/mestechko-YYYYMMDD-HHMM.dump
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --wait
```

Копии на том же диске не спасут от потери сервера: настройте вывоз каталога `backups`
в другое место (rclone или rsync по cron в объектное хранилище) — нужно хранилище от
владельца.

## Логи и наблюдение

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail 100 api worker bot
docker compose --env-file .env.production -f docker-compose.prod.yml logs edge   # журнал запросов Caddy, JSON
```

- Логи приложения — JSON (pino) с `requestId`; заголовки авторизации и cookie Caddy в
  журнал не пишет.
- Метрики Prometheus — `GET /metrics` у `api` внутри сети `edge`; снаружи Caddy отвечает
  на этот путь 404. Трассы — при заданном `OTEL_EXPORTER_OTLP_ENDPOINT`.
- `docker compose ps` показывает здоровье каждого сервиса; Docker перезапускает упавшие
  (`restart: unless-stopped`).

## Пробный запуск на своей машине

Тот же стек целиком поднимается локально — так он и проверен. Имена `*.localhost`
указывают на 127.0.0.1 без настройки DNS, Caddy выдаёт для них сертификаты своего
локального центра.

В `.env.production`:

```sh
SITE_DOMAIN=mestechko.localhost
CABINET_DOMAIN=app.mestechko.localhost
MINIAPP_DOMAIN=miniapp.mestechko.localhost
WIDGET_DOMAIN=widget.mestechko.localhost
API_DOMAIN=api.mestechko.localhost
ACME_EMAIL=ops@mestechko.localhost
HTTP_PORT=46290
HTTPS_PORT=46291
PUBLIC_BIND=127.0.0.1          # только для этой машины
PUBLIC_PORT_SUFFIX=:46291      # порт в адресах, которые приложения дают друг другу
TELEGRAM_BOT_TOKEN=            # пусто: локальный стек не трогает настоящего бота
BACKUP_DIR=./tmp/prod-backups
```

плюс секреты и настройки демо из шага 4. Затем шаги 6–7 и
`https://mestechko.localhost:46291` в браузере (сертификат локального центра браузер
попросит подтвердить). Остановить: `docker compose --env-file .env.production -f
docker-compose.prod.yml --profile demo stop`.
