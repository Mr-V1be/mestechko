import 'reflect-metadata';
import { loadConfig } from './platform/config/app-config.js';
import { startTelemetry } from './platform/observability/telemetry.js';

const config = loadConfig();
// Telemetry hooks the module loader, so the application is imported only afterwards.
const telemetry = startTelemetry(config);
const { bootstrap } = await import('./bootstrap.js');
await bootstrap(config, telemetry);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void telemetry.shutdown();
  });
}
