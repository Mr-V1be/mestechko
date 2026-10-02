import * as auth from './auth.js';
import * as cabinet from './cabinet.js';
import * as demo from './demo.js';
import * as miniapp from './miniapp-bookings.js';
import * as waitlist from './miniapp-waitlist.js';
import * as catalog from './public-catalog.js';

/** Every route of the API, keyed by operation id. */
export const apiRoutes = {
  getPublicBusiness: catalog.getPublicBusiness,
  listPublicServices: catalog.listPublicServices,
  listPublicStaff: catalog.listPublicStaff,
  getAvailability: catalog.getAvailability,
  getBookingQuote: catalog.getBookingQuote,
  createMiniAppBooking: miniapp.createMiniAppBooking,
  listMiniAppBookings: miniapp.listMiniAppBookings,
  getMiniAppBooking: miniapp.getMiniAppBooking,
  getMiniAppProfile: miniapp.getMiniAppProfile,
  getMiniAppNotifications: miniapp.getMiniAppNotifications,
  cancelMiniAppBooking: miniapp.cancelMiniAppBooking,
  getRescheduleOptions: miniapp.getRescheduleOptions,
  rescheduleMiniAppBooking: miniapp.rescheduleMiniAppBooking,
  confirmMiniAppAttendance: miniapp.confirmMiniAppAttendance,
  joinMiniAppWaitlist: waitlist.joinMiniAppWaitlist,
  listMiniAppWaitlist: waitlist.listMiniAppWaitlist,
  leaveMiniAppWaitlist: waitlist.leaveMiniAppWaitlist,
  createSession: auth.createSession,
  createDemoSession: auth.createDemoSession,
  deleteCurrentSession: auth.deleteCurrentSession,
  getMe: auth.getMe,
  listDemoBusinesses: demo.listDemoBusinesses,
  createTelegramLaunch: demo.createTelegramLaunch,
  getCabinetOverview: cabinet.getCabinetOverview,
  getSchedule: cabinet.getSchedule,
  listCabinetBookings: cabinet.listCabinetBookings,
  getCabinetBooking: cabinet.getCabinetBooking,
} as const;

export type ApiRoutes = typeof apiRoutes;
