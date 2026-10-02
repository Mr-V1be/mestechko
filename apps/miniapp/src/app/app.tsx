import type { i18n } from 'i18next';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { BusinessLayout } from '../features/business/business-layout';
import { BusinessPage } from '../features/business/business-page';
import { RootLayout, StartRedirect } from '../features/layout/root-layout';
import { NotFoundPage } from '../features/layout/not-found-page';
import { RouteErrorPage } from '../features/layout/route-error-page';
import { HostProvider } from '../platform/telegram/host-context';
import type { HostStatus } from '../platform/telegram/telegram-host';
import { AppProviders } from './providers';

/** Screens beyond the first one load on demand to keep the first paint fast. */
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <StartRedirect /> },
      {
        path: 'b/:slug',
        element: <BusinessLayout />,
        children: [
          { index: true, element: <BusinessPage /> },
          {
            path: 'l/:locationId/services',
            lazy: async () => ({
              Component: (await import('../features/booking/services-page')).ServicesPage,
            }),
          },
          {
            path: 'l/:locationId/staff',
            lazy: async () => ({
              Component: (await import('../features/booking/staff-page')).StaffPage,
            }),
          },
          {
            path: 'l/:locationId/time',
            lazy: async () => ({
              Component: (await import('../features/booking/time-page')).TimePage,
            }),
          },
          {
            path: 'l/:locationId/confirm',
            lazy: async () => ({
              Component: (await import('../features/booking/confirm-page')).ConfirmPage,
            }),
          },
          {
            path: 'bookings',
            lazy: async () => ({
              Component: (await import('../features/my-bookings/bookings-page')).BookingsPage,
            }),
          },
          {
            path: 'bookings/:bookingId',
            lazy: async () => ({
              Component: (await import('../features/my-bookings/booking-page')).BookingPage,
            }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App({ i18n, host }: { readonly i18n: i18n; readonly host: HostStatus }) {
  return (
    <HostProvider initial={host}>
      <AppProviders i18n={i18n}>
        <RouterProvider router={router} />
      </AppProviders>
    </HostProvider>
  );
}
