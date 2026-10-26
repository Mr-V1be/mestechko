import { chubBarbershop } from './chub-barbershop.js';
import { emalDental } from './emal-dental.js';
import { marigoldStudio } from './marigold-studio.js';
import { porshenAuto } from './porshen-auto.js';
import { sirenSalon } from './siren-salon.js';

/**
 * One Russian demo business per launch vertical, and the English-speaking demo: each
 * demo entry point opens the businesses of the visitor's language.
 */
export const demoBusinesses = [
  sirenSalon,
  chubBarbershop,
  emalDental,
  porshenAuto,
  marigoldStudio,
] as const;

/**
 * Shared password of the demo accounts: owners (`owner@<slug>.example`) and staff
 * members (`<name>@<slug>.example`, see `staffAccounts`).
 * Demo credentials only; production accounts never use seeds.
 */
export const DEMO_PASSWORD = 'slotwise-demo';
