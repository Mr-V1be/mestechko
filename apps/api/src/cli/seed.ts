import { demoResetSettingsFrom, resetDemo } from '../seed/demo-reset.js';

const seconds = await resetDemo(demoResetSettingsFrom(), {
  info: (message) => {
    console.log(message);
  },
  warn: (message) => {
    console.warn(message);
  },
});
console.log(`Demo data is ready in ${seconds.toFixed(1)} s.`);
