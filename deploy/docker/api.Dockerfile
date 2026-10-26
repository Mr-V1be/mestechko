# syntax=docker/dockerfile:1.7
# The API image. One image serves every server-side role, picked by APP_ROLES:
# api (HTTP), worker (queued jobs), bot (messenger updates); the same image runs
# migrations and the nightly demo reset as one-off commands.

FROM node:24.21.0-alpine AS toolchain
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM toolchain AS build
# Dependencies first: they change less often than the code and stay cached.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN --mount=type=cache,id=slotwise-pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=slotwise-pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@slotwise/api..."
RUN pnpm --filter "@slotwise/api..." build
# A self-contained copy: compiled code and production dependencies only.
RUN --mount=type=cache,id=slotwise-pnpm,target=/pnpm/store \
    pnpm --filter @slotwise/api deploy --prod --legacy /out

FROM node:24.21.0-alpine AS runtime
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=46210
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# The unprivileged user of the base image.
USER node
EXPOSE 46210
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "dist/cli/healthcheck.js"]
CMD ["node", "dist/main.js"]
