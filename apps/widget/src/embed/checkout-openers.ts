import { checkoutPresentations, type CheckoutPresentation } from '@mestechko/domain';

/**
 * How each kind of payment page opens from the widget: in place of the form (it sends
 * the visitor back here), or in a new window (the form notices the payment by itself).
 * Returns whether the page opened; a blocked window leaves the visitor a button.
 */
const openers: Readonly<Record<CheckoutPresentation, (url: string) => boolean>> = {
  embedded: (url) => {
    window.location.assign(url);
    return true;
  },
  external: (url) => {
    const opened = window.open(url, '_blank');
    if (opened) {
      opened.opener = null;
    }
    return opened !== null;
  },
};

export function openCheckout(url: string, presentation: CheckoutPresentation): boolean {
  return openers[presentation](url);
}

/** Whether the visitor stays in the form while paying elsewhere. */
export function paysOutside(presentation: CheckoutPresentation): boolean {
  return !checkoutPresentations[presentation].returnsToApp;
}
