import { describe, expect, it } from 'vitest';
import { frameUrl, widgetLocation, type LoaderConfig } from '../src/loader/loader-config';

const PAGE = 'https://salon.example/booking';

function config(scriptSrc: string): LoaderConfig {
  return {
    business: 'siren',
    theme: 'auto',
    mode: 'inline',
    target: null,
    launcher: true,
    ...widgetLocation(scriptSrc, PAGE),
  };
}

describe('the widget frame', () => {
  it('opens next to the script on a name of its own', () => {
    expect(frameUrl(config('https://widget.mestechko.example/widget.js'), 'inline')).toBe(
      'https://widget.mestechko.example/embed.html?business=siren&theme=auto&mode=inline',
    );
  });

  it('opens next to the script under a path of a shared name', () => {
    const shared = config('https://mestechko.example/widget/widget.js');
    expect(shared.origin).toBe('https://mestechko.example');
    expect(frameUrl(shared, 'popup')).toBe(
      'https://mestechko.example/widget/embed.html?business=siren&theme=auto&mode=popup',
    );
  });

  it('resolves a script address relative to the page', () => {
    expect(config('../widget.js').base).toBe('https://salon.example/');
  });
});
