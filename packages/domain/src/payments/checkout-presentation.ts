/**
 * Where a provider's payment page opens. An embedded page opens in place of the app
 * and sends the payer back into it; an external one opens in the browser (many real
 * providers refuse to be framed), the payer returns to a neutral page and the app
 * notices the payment by itself.
 */
export const checkoutPresentations = {
  embedded: { returnsToApp: true },
  external: { returnsToApp: false },
} as const satisfies Record<string, { readonly returnsToApp: boolean }>;

export type CheckoutPresentation = keyof typeof checkoutPresentations;

export const checkoutPresentationIds = Object.keys(checkoutPresentations) as CheckoutPresentation[];
