import { Fragment, type ReactNode } from 'react';

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const TOKEN = /(<\/?(?:b|strong|i|em)>|<br\s*\/?>|\n)/g;

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * Message text in the HTML subset bots use in MAX: bold, italics and line breaks.
 * Built as elements, never as markup, so a message cannot inject anything.
 */
export function RichText({ text, html }: { readonly text: string; readonly html: boolean }) {
  if (!html) {
    return <>{text}</>;
  }
  const nodes: ReactNode[] = [];
  let bold = false;
  let italic = false;
  text.split(TOKEN).forEach((part, index) => {
    if (part === '') {
      return;
    }
    if (/^<(b|strong)>$/.test(part)) {
      bold = true;
    } else if (/^<\/(b|strong)>$/.test(part)) {
      bold = false;
    } else if (/^<(i|em)>$/.test(part)) {
      italic = true;
    } else if (/^<\/(i|em)>$/.test(part)) {
      italic = false;
    } else if (part === '\n' || part.startsWith('<br')) {
      nodes.push(<br key={index} />);
    } else {
      const value = decode(part);
      const styled = bold ? <strong>{value}</strong> : value;
      nodes.push(<Fragment key={index}>{italic ? <em>{styled}</em> : styled}</Fragment>);
    }
  });
  return <>{nodes}</>;
}
