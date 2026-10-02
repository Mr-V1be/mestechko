import type { OutboundMessage } from '../application/channel.js';

const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** The bold title and plain lines, in the HTML subset both messengers accept. */
export function messageHtml(message: OutboundMessage): string {
  return [`<b>${escapeHtml(message.title)}</b>`, ...message.lines.map(escapeHtml)].join('\n');
}
