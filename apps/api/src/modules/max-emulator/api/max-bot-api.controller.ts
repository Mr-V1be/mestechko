import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Inject,
  NotFoundException,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../../../platform/config/app-config.js';
import { EmulatorRefusal, MaxBotApiEmulator } from '../application/max-bot-api-emulator.js';

const DEFAULT_POLL_SECONDS = 30;
const pollQuerySchema = z.object({
  marker: z.coerce.number().int().positive().optional(),
  timeout: z.coerce.number().int().min(0).max(90).default(DEFAULT_POLL_SECONDS),
});

/**
 * The MAX Bot API as the demo's bot sees it, under `/max-emulator`. Requests carry the
 * bot token in `Authorization`, like the real API. Mounted only in demo mode.
 */
@Controller('max-emulator')
export class MaxBotApiController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(MaxBotApiEmulator) private readonly emulator: MaxBotApiEmulator,
  ) {}

  @Get('me')
  me(@Headers('authorization') token: string | undefined) {
    this.authorize(token);
    return this.emulator.me();
  }

  @Post('messages')
  sendMessage(
    @Headers('authorization') token: string | undefined,
    @Query('chat_id') chatId: string | undefined,
    @Query('user_id') userId: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(token);
    return this.refusals(() => this.emulator.sendMessage(chatId ?? userId ?? '', body));
  }

  @Put('messages')
  editMessage(
    @Headers('authorization') token: string | undefined,
    @Query('message_id') messageId: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(token);
    return this.refusals(() => this.emulator.editMessage(messageId ?? '', body));
  }

  @Post('answers')
  answer(
    @Headers('authorization') token: string | undefined,
    @Query('callback_id') callbackId: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(token);
    return this.refusals(() => this.emulator.answer(callbackId ?? '', body));
  }

  @Get('updates')
  updates(
    @Headers('authorization') token: string | undefined,
    @Query() query: unknown,
    @Req() request: FastifyRequest,
  ) {
    this.authorize(token);
    const parsed = pollQuerySchema.parse(query);
    const closed = new AbortController();
    request.raw.once('close', () => {
      closed.abort();
    });
    return this.emulator.updates(parsed.marker ?? null, parsed.timeout, closed.signal);
  }

  private authorize(token: string | undefined): void {
    const expected = this.config.max.botToken;
    if (!this.config.max.emulatorEnabled || !expected) {
      throw new NotFoundException();
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(token ?? '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new HttpException({ code: 'verify.token', message: 'Invalid access_token' }, 401);
    }
  }

  private async refusals<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof EmulatorRefusal) {
        throw new HttpException({ code: 'refused', message: error.message }, error.status);
      }
      if (error instanceof z.ZodError) {
        throw new HttpException({ code: 'proto.payload', message: 'Invalid request body' }, 400);
      }
      throw error;
    }
  }
}
