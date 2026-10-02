import type { ClientBooking } from '@mestechko/contracts';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { ClientBookingView } from '../ports.js';

export function toClientBooking(view: ClientBookingView, avatars: AvatarUrls): ClientBooking {
  return {
    id: view.id,
    status: view.status,
    start: view.startsAt.toISOString(),
    end: view.endsAt.toISOString(),
    location: view.location,
    staff: {
      id: view.staff.id,
      displayName: view.staff.displayName,
      title: view.staff.title,
      avatarUrl: avatars.forSeed(view.staff.avatarSeed),
    },
    services: view.services.map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: { amountMinor: service.priceMinor, currency: view.currency },
    })),
    total: { amountMinor: view.totalPriceMinor, currency: view.currency },
    comment: view.comment,
    createdAt: view.createdAt.toISOString(),
  };
}
