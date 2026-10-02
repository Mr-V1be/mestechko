// Single import point for the Temporal API: switching to the native implementation
// once the runtimes ship it is a one-line change.
export { Temporal } from 'temporal-polyfill';
