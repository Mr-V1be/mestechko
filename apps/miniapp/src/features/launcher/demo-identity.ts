const DEMO_USER_KEY = 'mst-demo-user';

/** The same demo visitor across visits, so "my bookings" keeps its history. */
export function storedDemoUserId(): string | null {
  try {
    return window.localStorage.getItem(DEMO_USER_KEY);
  } catch {
    return null;
  }
}

export function rememberDemoUserId(id: string): void {
  try {
    window.localStorage.setItem(DEMO_USER_KEY, id);
  } catch {
    // A new demo identity will be issued next time.
  }
}
