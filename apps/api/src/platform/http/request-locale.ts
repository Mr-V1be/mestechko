import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { resolveLocale, type Locale } from '@slotwise/domain';
import type { FastifyRequest } from 'fastify';

const QUALITY = /^q=([01](?:\.\d{0,3})?)$/;
const DEFAULT_QUALITY = 1;

/**
 * The languages of an `Accept-Language` header, most wanted first: `ru;q=0.5, en-US`
 * → `['en-US', 'ru']`. Languages the reader refuses (`q=0`) and the wildcard are left out.
 */
export function acceptedLanguages(header: string | undefined): string[] {
  return (header ?? '')
    .split(',')
    .map((part, order) => {
      const [tag = '', ...params] = part.trim().split(';');
      const quality = params
        .map((param) => QUALITY.exec(param.trim())?.[1])
        .find((value) => value !== undefined);
      return {
        tag: tag.trim(),
        quality: quality === undefined ? DEFAULT_QUALITY : Number(quality),
        order,
      };
    })
    .filter((entry) => entry.tag !== '' && entry.tag !== '*' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.order - b.order)
    .map((entry) => entry.tag);
}

/**
 * The language to answer a request in. The apps send the language their reader chose
 * as `Accept-Language`; a browser following a link sends its own languages.
 */
export const RequestLocale = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Locale =>
    resolveLocale(
      acceptedLanguages(
        context.switchToHttp().getRequest<FastifyRequest>().headers['accept-language'],
      ),
    ),
);
