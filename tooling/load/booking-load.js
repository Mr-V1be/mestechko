/**
 * Load test of the client's booking path, run by k6 from its Docker image (no install):
 * see docs/performance.md. Three scenarios, one after another, on the demo data:
 *
 *   slots        free start times of a week for a service: the busiest public read;
 *   contention   many clients book the same start at the same moment, window after window;
 *   my_bookings  each client's upcoming bookings in the Mini App.
 *
 * Settings come from the environment: BASE_URL, BUSINESS, RATE, DURATION, CONTENDERS,
 * WINDOWS. Double bookings are checked in the database after the run.
 */
import exec from 'k6/execution';
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://miniapp.mestechko.localhost:46291/api';
const BUSINESS = __ENV.BUSINESS || 'siren';
const RATE = Number(__ENV.RATE || 50);
const DURATION = __ENV.DURATION || '60s';
const DURATION_SECONDS = Number.parseInt(DURATION, 10);
const CONTENDERS = Number(__ENV.CONTENDERS || 40);
const WINDOWS = Number(__ENV.WINDOWS || 10);
const PAUSE_SECONDS = 5;
const CONTENTION_SECONDS = 60;
/** Demo user ids of the run: Telegram-like numbers no real account has in the demo. */
const FIRST_DEMO_USER = 7_100_000_000;
/** k6 has no URL class: the host name is read from the address itself. */
const host = BASE_URL.replace(/^https?:\/\//, '').split(/[:/]/)[0];

const created = new Counter('bookings_created');
const conflicts = new Counter('bookings_conflict');
const unexpected = new Counter('bookings_unexpected');

export const options = {
  // The local trial runs behind Caddy's local certificate authority.
  insecureSkipTLSVerify: host.endsWith('.localhost'),
  hosts: host.endsWith('.localhost') ? { [host]: '127.0.0.1' } : {},
  setupTimeout: '120s',
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    slots: {
      executor: 'constant-arrival-rate',
      exec: 'slots',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 50,
      maxVUs: 300,
    },
    contention: {
      executor: 'per-vu-iterations',
      exec: 'contend',
      vus: CONTENDERS,
      iterations: WINDOWS,
      startTime: `${String(DURATION_SECONDS + PAUSE_SECONDS)}s`,
      maxDuration: `${String(CONTENTION_SECONDS)}s`,
    },
    my_bookings: {
      executor: 'constant-arrival-rate',
      exec: 'myBookings',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      startTime: `${String(DURATION_SECONDS + CONTENTION_SECONDS + PAUSE_SECONDS * 2)}s`,
      preAllocatedVUs: 50,
      maxVUs: 300,
    },
  },
  thresholds: {
    'http_req_duration{scenario:slots}': ['p(95)<500'],
    'http_req_failed{scenario:slots}': ['rate<0.01'],
    'http_req_duration{scenario:contention}': ['p(95)<1500'],
    'http_req_duration{scenario:my_bookings}': ['p(95)<300'],
    'http_req_failed{scenario:my_bookings}': ['rate<0.01'],
    // Every contested window goes to exactly one client; nothing else happens.
    bookings_created: [`count==${String(WINDOWS)}`],
    bookings_unexpected: ['count==0'],
  },
};

const json = (response) => {
  if (response.status >= 400) {
    throw new Error(`${response.request.url}: ${String(response.status)} ${response.body}`);
  }
  return response.json();
};

const isoDate = (date) => date.toISOString().slice(0, 10);

function addDays(days) {
  return new Date(Date.now() + days * 86_400_000);
}

/** A UUID v4 for the idempotency key of each attempt. */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random % 4) + 8).toString(16);
  });
}

/** A demo phone (`+70…`): no such numbers exist, the API accepts them from demo launches. */
const demoPhone = (index) => `+70${String(4_000_000_00 + index).padStart(9, '0')}`;

/**
 * The demo salon's first location, a service without prepayment, one staff member and
 * one contested start per day (a day apart, so the windows never overlap each other).
 */
export function setup() {
  const business = json(http.get(`${BASE_URL}/v1/public/businesses/${BUSINESS}`));
  const locationId = business.locations[0].id;
  const catalog = json(
    http.get(`${BASE_URL}/v1/public/businesses/${BUSINESS}/services?locationId=${locationId}`),
  );
  const services = catalog.categories.flatMap((category) => category.services);
  for (const service of services) {
    const staff = json(
      http.get(
        `${BASE_URL}/v1/public/businesses/${BUSINESS}/staff?locationId=${locationId}&serviceIds=${service.id}`,
      ),
    ).staff;
    for (const member of staff) {
      const availability = json(
        http.get(
          `${BASE_URL}/v1/public/businesses/${BUSINESS}/availability?locationId=${locationId}&serviceIds=${service.id}&staffId=${member.id}&from=${isoDate(addDays(1))}&to=${isoDate(addDays(20))}`,
        ),
      );
      const windows = [];
      for (const day of availability.days) {
        const start = day.slots[day.slots.length - 1]?.start;
        if (!start || windows.length === WINDOWS) {
          continue;
        }
        const quote = json(
          http.get(
            `${BASE_URL}/v1/public/businesses/${BUSINESS}/quote?locationId=${locationId}&serviceIds=${service.id}&staffId=${member.id}&start=${encodeURIComponent(start)}`,
          ),
        );
        if (quote.available && quote.deposit === null && quote.assigned) {
          windows.push({ start, total: quote.assigned.total });
        }
      }
      if (windows.length === WINDOWS) {
        const users = [];
        for (let index = 0; index < CONTENDERS * WINDOWS; index += 1) {
          const launch = json(
            http.post(
              `${BASE_URL}/v1/demo/telegram-launch`,
              JSON.stringify({
                businessSlug: BUSINESS,
                demoUserId: String(FIRST_DEMO_USER + index),
              }),
              { headers: { 'content-type': 'application/json' } },
            ),
          );
          users.push(launch.initData);
        }
        return { locationId, serviceId: service.id, staffId: member.id, windows, users };
      }
    }
  }
  throw new Error(`No staff member has ${String(WINDOWS)} free days for one service`);
}

/** Free times of a random week ahead for a random service, as the time step asks. */
export function slots(data) {
  const from = addDays(Math.floor(Math.random() * 14));
  const to = new Date(from.getTime() + 6 * 86_400_000);
  const response = http.get(
    `${BASE_URL}/v1/public/businesses/${BUSINESS}/availability?locationId=${data.locationId}&serviceIds=${data.serviceId}&from=${isoDate(from)}&to=${isoDate(to)}`,
    { tags: { name: 'availability' } },
  );
  check(response, { 'availability 200': (r) => r.status === 200 });
}

/**
 * Every client of the scenario books window N on their N-th iteration: all of them go
 * for the same start at nearly the same moment. One booking wins, the rest get 409.
 */
export function contend(data) {
  const window = exec.vu.iterationInScenario;
  const contender = exec.vu.idInTest - 1;
  const initData = data.users[window * CONTENDERS + (contender % CONTENDERS)];
  const target = data.windows[window];
  const response = http.post(
    `${BASE_URL}/v1/miniapp/businesses/${BUSINESS}/bookings`,
    JSON.stringify({
      locationId: data.locationId,
      serviceIds: [data.serviceId],
      staffId: data.staffId,
      start: target.start,
      agreedTotal: target.total,
      contact: { name: `Клиент нагрузки ${String(contender)}`, phone: demoPhone(contender) },
      comment: null,
    }),
    {
      headers: {
        authorization: `tma ${initData}`,
        'content-type': 'application/json',
        'idempotency-key': uuid(),
      },
      tags: { name: 'book', window: String(window) },
      responseCallback: http.expectedStatuses(201, 409),
    },
  );
  if (response.status === 201) {
    created.add(1, { window: String(window) });
  } else if (response.status === 409) {
    conflicts.add(1, { window: String(window) });
  } else {
    unexpected.add(1, { status: String(response.status) });
  }
  check(response, { 'booked or taken': (r) => r.status === 201 || r.status === 409 });
}

/** A client of the run opens «Мои записи». */
export function myBookings(data) {
  const initData = data.users[Math.floor(Math.random() * data.users.length)];
  const response = http.get(
    `${BASE_URL}/v1/miniapp/businesses/${BUSINESS}/bookings?scope=upcoming`,
    {
      headers: { authorization: `tma ${initData}` },
      tags: { name: 'my-bookings' },
    },
  );
  check(response, { 'my bookings 200': (r) => r.status === 200 });
}
