import { autoService } from './auto-service.js';
import { barbershop } from './barbershop.js';
import { beautySalon } from './beauty-salon.js';
import { dentalClinic } from './dental-clinic.js';

/** Verticals available on the platform. A new line of business is one more entry here. */
export const builtInVerticals = [beautySalon, barbershop, dentalClinic, autoService] as const;
