import * as auth from './auth.js';
import * as desk from './cabinet/booking-desk.js';
import * as catalogAdmin from './cabinet/catalog.js';
import * as clients from './cabinet/clients.js';
import * as loyalty from './cabinet/loyalty.js';
import * as maxEmulator from './cabinet/max-emulator.js';
import * as reports from './cabinet/reports.js';
import * as cabinet from './cabinet/schedule.js';
import * as settings from './cabinet/settings.js';
import * as team from './cabinet/team.js';
import * as miniapp from './client/miniapp-bookings.js';
import * as waitlist from './client/miniapp-waitlist.js';
import * as catalog from './client/public-catalog.js';
import * as widget from './client/widget.js';
import * as demo from './demo.js';

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
  startMiniAppPayment: miniapp.startMiniAppPayment,
  joinMiniAppWaitlist: waitlist.joinMiniAppWaitlist,
  listMiniAppWaitlist: waitlist.listMiniAppWaitlist,
  leaveMiniAppWaitlist: waitlist.leaveMiniAppWaitlist,
  createWidgetBooking: widget.createWidgetBooking,
  getWidgetBooking: widget.getWidgetBooking,
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
  createCabinetBooking: desk.createCabinetBooking,
  moveCabinetBooking: desk.moveCabinetBooking,
  cancelCabinetBooking: desk.cancelCabinetBooking,
  completeCabinetBooking: desk.completeCabinetBooking,
  markCabinetNoShow: desk.markCabinetNoShow,
  getVisitSettlementOptions: desk.getVisitSettlementOptions,
  listTeam: team.listTeam,
  getTeamMember: team.getTeamMember,
  createTeamMember: team.createTeamMember,
  updateTeamMember: team.updateTeamMember,
  setTeamMemberServices: team.setTeamMemberServices,
  previewScheduleChange: team.previewScheduleChange,
  applyScheduleChange: team.applyScheduleChange,
  getCabinetCatalog: catalogAdmin.getCabinetCatalog,
  createServiceCategory: catalogAdmin.createServiceCategory,
  updateServiceCategory: catalogAdmin.updateServiceCategory,
  createService: catalogAdmin.createService,
  updateService: catalogAdmin.updateService,
  setServiceStaff: catalogAdmin.setServiceStaff,
  setServiceIncompatibilities: catalogAdmin.setServiceIncompatibilities,
  listClients: clients.listClients,
  listClientTags: clients.listClientTags,
  getClientCard: clients.getClientCard,
  createClient: clients.createClient,
  updateClient: clients.updateClient,
  addClientNote: clients.addClientNote,
  deleteClientNote: clients.deleteClientNote,
  exportClients: clients.exportClients,
  importClients: clients.importClients,
  getLoyaltySettings: loyalty.getLoyaltySettings,
  updateLoyaltyProgram: loyalty.updateLoyaltyProgram,
  createPassPlan: loyalty.createPassPlan,
  updatePassPlan: loyalty.updatePassPlan,
  sellClientPass: loyalty.sellClientPass,
  adjustClientPoints: loyalty.adjustClientPoints,
  getBusinessReport: reports.getBusinessReport,
  getBusinessSettings: settings.getBusinessSettings,
  updateBusinessSettings: settings.updateBusinessSettings,
  listMaxEmulatorChats: maxEmulator.listMaxEmulatorChats,
  getMaxEmulatorChat: maxEmulator.getMaxEmulatorChat,
  startMaxEmulatorChat: maxEmulator.startMaxEmulatorChat,
  sendMaxEmulatorText: maxEmulator.sendMaxEmulatorText,
  pressMaxEmulatorButton: maxEmulator.pressMaxEmulatorButton,
} as const;

export type ApiRoutes = typeof apiRoutes;
