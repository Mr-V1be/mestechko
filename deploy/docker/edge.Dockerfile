# syntax=docker/dockerfile:1.7
# The edge proxy: automatic TLS for every public name and routing to the apps.
# Caddy binds 80 and 443 as an unprivileged user through its file capability.
FROM caddy:2.11.4-alpine
RUN addgroup -S -g 10001 edge && adduser -S -D -H -u 10001 -G edge edge \
    && chown -R edge:edge /data /config
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
USER edge
EXPOSE 80 443 443/udp
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8081/healthz"]
