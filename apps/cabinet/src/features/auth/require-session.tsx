import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../../platform/api/queries';
import { defaultMembership } from '../../platform/session/active-business';
import { SessionContext, useSession } from '../../platform/session/session-context';
import { isUnauthenticated } from '../common/error-message';
import { FullScreenLoading, QueryErrorState } from '../common/states';
import { navigationSections } from '../shell/navigation';

/** Screens below need a cabinet session; without one the person signs in first. */
export function RequireSession() {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) {
    return <FullScreenLoading />;
  }
  if (me.isError) {
    return isUnauthenticated(me.error) ? (
      <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
    ) : (
      <QueryErrorState error={me.error} onRetry={() => void me.refetch()} />
    );
  }
  return (
    <SessionContext value={me.data}>
      <Outlet />
    </SessionContext>
  );
}

/** Opens the last used business on its first permitted section. */
export function HomeRedirect() {
  const me = useSession();
  const membership = defaultMembership(me);
  if (!membership) {
    return <Navigate to="/sign-in" replace />;
  }
  const section = navigationSections.find(
    (candidate) => membership.access[candidate.area] !== 'none',
  );
  return <Navigate to={`/b/${membership.business.id}/${section?.path ?? 'schedule'}`} replace />;
}
