import { ListGroup, ListItem } from '@mestechko/ui';
import { ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { Page } from '../layout/page';
import { useCurrentBusiness } from './business-context';

/** Where the client starts: choose a branch, or go straight to services when there is one. */
export function BusinessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const business = useCurrentBusiness();
  const servicesPath = (locationId: string) =>
    `/b/${encodeURIComponent(business.slug)}/l/${encodeURIComponent(locationId)}/services`;
  const [only] = business.locations;
  if (business.locations.length === 1 && only) {
    return <Navigate to={servicesPath(only.id)} replace />;
  }
  return (
    <Page title={t('business.chooseLocation')}>
      <ListGroup>
        {business.locations.map((location) => (
          <ListItem
            key={location.id}
            leading={<MapPin aria-hidden="true" />}
            title={location.name}
            description={location.address}
            trailing={<ChevronRight />}
            onClick={() => {
              void navigate(servicesPath(location.id));
            }}
          />
        ))}
      </ListGroup>
    </Page>
  );
}
