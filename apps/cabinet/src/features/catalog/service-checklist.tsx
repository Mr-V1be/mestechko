import type { CategoryAdmin, ServiceAdmin } from '@slotwise/contracts/client';
import { Checkbox, ListGroup, ListItem } from '@slotwise/ui';
import { useId, type ReactNode } from 'react';

export interface ServiceChecklistProps {
  /** Categories with the services to offer; empty categories are left out. */
  readonly categories: readonly CategoryAdmin[];
  readonly selected: readonly string[];
  readonly onChange: (serviceIds: string[]) => void;
  /** A short line under the service name, e.g. its price. */
  readonly describe?: (service: ServiceAdmin) => ReactNode;
}

/** Several services of many, grouped by category as in the catalog. */
export function ServiceChecklist({
  categories,
  selected,
  onChange,
  describe,
}: ServiceChecklistProps) {
  const idPrefix = useId();
  return categories
    .filter((category) => category.services.length > 0)
    .map((category) => (
      <ListGroup key={category.id} title={category.name}>
        {category.services.map((service) => {
          const controlId = `${idPrefix}-${service.id}`;
          const checked = selected.includes(service.id);
          return (
            <ListItem
              key={service.id}
              controlId={controlId}
              title={service.name}
              description={describe?.(service)}
              trailing={
                <Checkbox
                  id={controlId}
                  checked={checked}
                  onCheckedChange={(next) => {
                    onChange(
                      next
                        ? [...selected, service.id]
                        : selected.filter((serviceId) => serviceId !== service.id),
                    );
                  }}
                />
              }
            />
          );
        })}
      </ListGroup>
    ));
}
