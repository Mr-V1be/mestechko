/** Texts of the page, from the translation system. */
export interface ReturnPageTexts {
  readonly locale: string;
  readonly title: string;
  readonly lead: string;
  readonly close: string;
  readonly brand: string;
}

const escape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Where a payer lands after a payment page opened outside the app. It only says what
 * happens next: the app learns about the payment from the provider, not from this page.
 */
export function renderReturnPage(texts: ReturnPageTexts): string {
  return `<!doctype html>
<html lang="${escape(texts.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(texts.title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #f4f5f7; --card: #ffffff; --text: #22242a;
    --muted: #5d6370; --accent: #ff6b1a; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #111215; --card: #1a1c20; --text: #f1f2f4; --muted: #a3a8b3; --accent: #ff8a3d; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
    background: var(--bg); color: var(--text);
    font: 16px/1.5 "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 420px; background: var(--card); border-radius: 24px;
    padding: 32px 24px; display: grid; gap: 12px; text-align: center; justify-items: center; }
  .mark { width: 56px; height: 56px; border-radius: 18px; background: var(--accent);
    display: grid; place-items: center; }
  .mark span { width: 14px; height: 14px; border-radius: 50%; background: #22242a; }
  h1 { font-size: 24px; margin: 8px 0 0; }
  p { margin: 0; color: var(--muted); }
  .brand { font-weight: 800; color: var(--text); }
</style>
</head>
<body>
<main>
  <div class="mark" aria-hidden="true"><span></span></div>
  <p class="brand">${escape(texts.brand)}</p>
  <h1>${escape(texts.title)}</h1>
  <p>${escape(texts.lead)}</p>
  <p>${escape(texts.close)}</p>
</main>
</body>
</html>`;
}
