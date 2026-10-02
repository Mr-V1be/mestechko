import { builtInVerticals } from './definitions/index.js';
import { VerticalRegistry } from './vertical-registry.js';

export const verticalRegistry = new VerticalRegistry(builtInVerticals);
