import type { FastifyReply, FastifyRequest } from 'fastify';

export const SESSION_COOKIE = 'mst_session';

export interface SessionCookieSettings {
  readonly secure: boolean;
}

export function readSessionCookie(request: FastifyRequest): string | null {
  const value = request.cookies[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** HttpOnly + SameSite=Lax: unreadable by scripts and not sent on cross-site posts. */
export function writeSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  settings: SessionCookieSettings,
): void {
  void reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: settings.secure,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, settings: SessionCookieSettings): void {
  void reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: settings.secure,
    path: '/',
  });
}
