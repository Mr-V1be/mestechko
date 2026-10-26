# syntax=docker/dockerfile:1.7
# A web app of the product (landing, cabinet, miniapp or widget), built with Vite and
# served as static files by an unprivileged Caddy. The edge proxy terminates TLS and
# routes /api to the API.
#
#   docker build -f deploy/docker/web.Dockerfile --build-arg APP=cabinet .

FROM node:24.21.0-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=slotwise-pnpm,target=/pnpm/store pnpm fetch
COPY . .
ARG APP
RUN test -n "$APP" || (echo "Pass --build-arg APP=landing|cabinet|miniapp|widget" && exit 1)
RUN --mount=type=cache,id=slotwise-pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@slotwise/${APP}..."
# Public addresses are part of the bundle: Vite reads them at build time.
ARG VITE_API_BASE_URL=/api
ARG VITE_DEMO_MODE=false
ARG VITE_WIDGET_BASE_URL
ARG VITE_LANDING_URL
ARG VITE_CABINET_URL
ARG VITE_MINIAPP_URL
ARG VITE_BOT_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DEMO_MODE=$VITE_DEMO_MODE \
    VITE_WIDGET_BASE_URL=$VITE_WIDGET_BASE_URL \
    VITE_LANDING_URL=$VITE_LANDING_URL \
    VITE_CABINET_URL=$VITE_CABINET_URL \
    VITE_MINIAPP_URL=$VITE_MINIAPP_URL \
    VITE_BOT_URL=$VITE_BOT_URL
RUN pnpm --filter "@slotwise/${APP}" build && mv "apps/${APP}/dist" /site

FROM caddy:2.11.4-alpine AS runtime
RUN addgroup -S -g 10001 web && adduser -S -D -H -u 10001 -G web web \
    && chown -R web:web /data /config
COPY deploy/docker/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=web:web /site /srv
USER web
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/healthz"]
