/**
 * The product site's picture for link previews, one per language: the brand, the site's
 * own headline and lead in that language, and the product's screens in it, taken from the
 * site's media (`pnpm media:landing`), so a preview always shows the current product.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { shareImage as shareImageSpec } from '../../apps/landing/src/app/share-image.ts';
import { brandPage } from './brand-page.ts';
import { lockupSvg } from './brand-svg.ts';
import type { Picture } from './icons.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));

interface HeroTexts {
  readonly hero: { readonly title: string; readonly lead: string };
}

const escape = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const dataUrl = (file: string): string =>
  `data:image/webp;base64,${readFileSync(`${root}${file}`).toString('base64')}`;

const style = `
body{position:relative;background:radial-gradient(ellipse at 92% 0%,var(--color-accent-soft),transparent 62%),var(--color-canvas)}
.copy{position:absolute;left:72px;top:64px;width:500px;display:flex;flex-direction:column;gap:28px}
.title{margin-top:44px;font-size:84px;font-weight:900;line-height:1.02;letter-spacing:-.025em;text-wrap:balance}
.lead{color:var(--color-text-secondary);font-size:30px;line-height:1.35;text-wrap:pretty}
.device{position:absolute;overflow:hidden;background:var(--color-device);box-shadow:0 36px 80px rgb(20 22 28/.22),0 10px 24px rgb(20 22 28/.12)}
.device img{display:block;width:100%;height:100%;object-fit:cover;object-position:left top}
.laptop{left:640px;top:96px;width:780px;height:488px;padding:14px;border-radius:22px}
.laptop img{border-radius:8px}
.phone{left:588px;top:178px;width:250px;height:541px;padding:10px;border-radius:42px}
.phone img{border-radius:32px}`;

/** The preview picture of the site's page in `locale`. */
export function shareImage(locale: string): Picture {
  const texts = JSON.parse(
    readFileSync(`${root}apps/landing/src/locales/${locale}.json`, 'utf8'),
  ) as HeroTexts;
  const media = `apps/landing/public/media/${locale}`;
  const body = `
    <div class="copy">
      ${lockupSvg(34)}
      <div class="title">${escape(texts.hero.title)}</div>
      <div class="lead">${escape(texts.hero.lead)}</div>
    </div>
    <div class="device laptop"><img src="${dataUrl(`${media}/cabinet-schedule-light.webp`)}" alt=""></div>
    <div class="device phone"><img src="${dataUrl(`${media}/miniapp-time-light.webp`)}" alt=""></div>`;
  const { width, height } = shareImageSpec;
  return {
    file: `apps/landing/public/${shareImageSpec.path(locale)}`,
    width,
    height,
    html: brandPage(width, height, style, body),
  };
}
