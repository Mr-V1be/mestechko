import colorTokens from '@mestechko/ui/tokens/color.css?inline';
import scaleTokens from '@mestechko/ui/tokens/scale.css?inline';
import loaderStyles from './loader.css?inline';

/**
 * The design tokens, scoped to a shadow host instead of the page root, and the embed
 * script's own styles. The host page's custom properties are never touched.
 */
function scopedToHost(css: string): string {
  return css.replace(/:root\[([^\]]+)\]/g, ':host([$1])').replace(/:root/g, ':host');
}

export const shadowStyles = [
  scopedToHost(scaleTokens),
  scopedToHost(colorTokens),
  loaderStyles,
].join('\n');
