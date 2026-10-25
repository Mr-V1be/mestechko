import type { Money } from '@mestechko/domain';
import { formatMoney } from '@mestechko/i18n';
import type { Translator } from '../../../shared/application/translations.js';

/** Texts of the payment page in the payer's language. */
export type CheckoutTexts = Translator;

export interface CheckoutPageModel {
  readonly paymentId: string;
  readonly description: string;
  readonly amount: Money;
  /** `null` while the payment can be paid. */
  readonly closed: 'succeeded' | 'cancelled' | null;
  /** Whole minutes left to pay, at least one while open. */
  readonly minutesLeft: number;
  readonly returnUrl: string;
  readonly actionBase: string;
}

const escape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * The provider's hosted page, self-contained: no scripts (forms post the decision),
 * styles inline, light and dark by the visitor's system setting.
 */
export function renderCheckoutPage(model: CheckoutPageModel, texts: CheckoutTexts): string {
  const amount = formatMoney(texts.locale, model.amount);
  const body = model.closed
    ? `<p class="state">${escape(texts.text(`closed.${model.closed}`))}</p>
       <a class="button secondary" href="${escape(model.returnUrl)}">${escape(texts.text('back'))}</a>`
    : `<form method="post" action="${escape(`${model.actionBase}/pay`)}">
         <button class="button primary" type="submit">${escape(texts.text('pay', { amount }))}</button>
       </form>
       <form method="post" action="${escape(`${model.actionBase}/cancel`)}">
         <button class="button secondary" type="submit">${escape(texts.text('cancel'))}</button>
       </form>
       <p class="hint">${escape(texts.text('expiresIn', { count: model.minutesLeft }))}</p>`;
  return `<!doctype html>
<html lang="${escape(texts.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(texts.text('title'))}</title>
<style>
  :root { color-scheme: light dark; --bg: #f3f4f6; --card: #ffffff; --text: #111827;
    --muted: #4b5563; --line: #e5e7eb; --accent: #1f6feb; --accent-text: #ffffff;
    --notice: #fff7e6; --notice-text: #7a4b00; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1117; --card: #161b22; --text: #e6edf3; --muted: #9aa4af;
      --line: #30363d; --accent: #4493f8; --accent-text: #0d1117;
      --notice: #2d2310; --notice-text: #f2cc8f; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
    background: var(--bg); color: var(--text);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 420px; background: var(--card); border: 1px solid var(--line);
    border-radius: 16px; padding: 24px; display: grid; gap: 16px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { font-size: 18px; margin: 0; }
  .secure { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; }
  .label { color: var(--muted); font-size: 14px; margin: 0; }
  .amount { font-size: 32px; font-weight: 700; margin: 0; font-variant-numeric: tabular-nums; }
  .description { margin: 0; overflow-wrap: anywhere; }
  .notice { margin: 0; padding: 12px; border-radius: 12px; background: var(--notice);
    color: var(--notice-text); font-size: 14px; }
  form { margin: 0; }
  .button { display: block; width: 100%; min-height: 48px; border-radius: 12px; border: 1px solid transparent;
    font: inherit; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none;
    line-height: 46px; }
  .primary { background: var(--accent); color: var(--accent-text); }
  .secondary { background: transparent; color: var(--text); border-color: var(--line); }
  .button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .hint, .state { margin: 0; color: var(--muted); font-size: 14px; text-align: center; }
  .state { font-size: 16px; color: var(--text); }
</style>
</head>
<body>
<main>
  <header>
    <h1>${escape(texts.text('title'))}</h1>
    <span class="secure">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      ${escape(texts.text('secure'))}
    </span>
  </header>
  <div>
    <p class="label">${escape(texts.text('amount'))}</p>
    <p class="amount">${escape(amount)}</p>
  </div>
  <p class="description">${escape(model.description)}</p>
  <p class="notice">${escape(texts.text('testNotice'))}</p>
  ${body}
</main>
</body>
</html>`;
}
