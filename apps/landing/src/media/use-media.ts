import { useLocale } from '@mestechko/booking-ui';
import { siteMediaOf, type SiteMedia } from './media';

/** The product's screens and loops captured in the page's language. */
export function useSiteMedia(): SiteMedia {
  return siteMediaOf(useLocale().locale);
}
