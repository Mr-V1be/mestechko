/**
 * Browser entry: the typed API client and value lists, without schemas or
 * validation code. Types still come from the schemas through type-only imports.
 */
export * from './client.js';
export * from './enums.js';
export * from './demo-phones.js';
export type * from './routes/public-catalog.js';
export type * from './routes/miniapp-bookings.js';
export type * from './routes/miniapp-waitlist.js';
export type * from './routes/auth.js';
export type * from './routes/demo.js';
export type * from './routes/cabinet.js';
export type * from './routes/max-emulator.js';
export type * from './primitives.js';
export type { ApiErrorCode } from './errors.js';
export type { RouteRequest, RouteResult } from './route.js';
