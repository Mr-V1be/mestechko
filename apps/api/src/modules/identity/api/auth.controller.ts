import { Controller, Inject, Req, Res } from '@nestjs/common';
import {
  createDemoSession,
  createSession,
  deleteCurrentSession,
  getMe,
  type Me,
  type RouteInput,
} from '@mestechko/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SessionUser } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import { GetMe } from '../application/me.js';
import { CabinetSessions, type IssuedSession } from '../application/sessions.js';
import {
  clearSessionCookie,
  writeSessionCookie,
  type SessionCookieSettings,
} from './session-cookie.js';

export const SESSION_COOKIE_SETTINGS = Symbol('SESSION_COOKIE_SETTINGS');

@Controller()
export class AuthController {
  constructor(
    @Inject(CabinetSessions) private readonly sessions: CabinetSessions,
    @Inject(GetMe) private readonly me: GetMe,
    @Inject(SESSION_COOKIE_SETTINGS) private readonly cookies: SessionCookieSettings,
  ) {}

  @ContractRoute(createSession)
  async signIn(
    @ContractInput() input: RouteInput<typeof createSession>,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Me> {
    const issued = await this.sessions.signIn(input.body.email, input.body.password, request.ip);
    return this.respondWithSession(issued, reply);
  }

  @ContractRoute(createDemoSession)
  async signInDemo(
    @ContractInput() input: RouteInput<typeof createDemoSession>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Me> {
    const issued = await this.sessions.signInDemo(input.body.businessSlug);
    return this.respondWithSession(issued, reply);
  }

  @ContractRoute(deleteCurrentSession)
  async signOut(
    @SessionUser() user: { sessionId: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.sessions.signOut(user.sessionId);
    clearSessionCookie(reply, this.cookies);
  }

  @ContractRoute(getMe)
  current(@SessionUser() user: { userId: string }): Promise<Me> {
    return this.me.execute(user.userId);
  }

  private async respondWithSession(issued: IssuedSession, reply: FastifyReply): Promise<Me> {
    writeSessionCookie(reply, issued.token, issued.expiresAt, this.cookies);
    return this.me.execute(issued.userId);
  }
}
