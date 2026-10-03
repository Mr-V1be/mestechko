import { isRetryableError } from '@mestechko/contracts/client';
import { ThemeProvider, ToastProvider } from '@mestechko/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { i18n } from 'i18next';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { HomeRedirect, RequireSession } from '../features/auth/require-session';
import { SignInPage } from '../features/auth/sign-in-page';
import { RouteErrorPage } from '../features/common/states';
import { AppShell } from '../features/shell/app-shell';
import { ApiProvider } from '../platform/api/api-context';
import { THEME_STORAGE_KEY } from './config';

const RETRY_LIMIT = 2;
const STALE_MS = 30_000;

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: 'sign-in', element: <SignInPage /> },
      {
        element: <RequireSession />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            path: 'b/:businessId',
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="schedule" replace /> },
              {
                path: 'schedule',
                lazy: async () => ({
                  Component: (await import('../features/schedule/schedule-page')).SchedulePage,
                }),
              },
              {
                path: 'bookings',
                lazy: async () => ({
                  Component: (await import('../features/bookings/bookings-page')).BookingsPage,
                }),
              },
              {
                path: 'clients',
                lazy: async () => ({
                  Component: (await import('../features/clients/clients-page')).ClientsPage,
                }),
              },
              {
                path: 'clients/:clientId',
                lazy: async () => ({
                  Component: (await import('../features/clients/card/client-card-page'))
                    .ClientCardPage,
                }),
              },
              {
                path: 'max-emulator/:userId?',
                lazy: async () => ({
                  Component: (await import('../features/max-emulator/max-emulator-page'))
                    .MaxEmulatorPage,
                }),
              },
            ],
          },
          { path: '*', element: <HomeRedirect /> },
        ],
      },
    ],
  },
]);

export function App({ i18n }: { readonly i18n: i18n }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_MS,
            retry: (failures, error) => failures < RETRY_LIMIT && isRetryableError(error),
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider storageKey={THEME_STORAGE_KEY}>
          <ApiProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </ApiProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
