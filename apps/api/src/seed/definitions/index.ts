import { chubBarbershop } from './chub-barbershop.js';
import { emalDental } from './emal-dental.js';
import { porshenAuto } from './porshen-auto.js';
import { sirenSalon } from './siren-salon.js';

/** One demo business per launch vertical. */
export const demoBusinesses = [sirenSalon, chubBarbershop, emalDental, porshenAuto] as const;

/**
 * Shared password of the demo accounts: owners (`owner@<slug>.example`) and staff
 * members (`<name>@<slug>.example`, see `staffAccounts`).
 * Demo credentials only; production accounts never use seeds.
 */
export const DEMO_PASSWORD = 'mestechko-demo';
