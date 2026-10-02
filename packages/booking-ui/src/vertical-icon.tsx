import {
  Dumbbell,
  Scissors,
  SmilePlus,
  Sparkles,
  Store,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/** Icons available to verticals; a vertical names its icon in its registry entry. */
const verticalIcons: Readonly<Record<string, LucideIcon>> = {
  sparkles: Sparkles,
  scissors: Scissors,
  smile_plus: SmilePlus,
  wrench: Wrench,
  dumbbell: Dumbbell,
};

export function VerticalIcon({
  name,
  className,
}: {
  readonly name: string;
  readonly className?: string;
}) {
  const Icon = verticalIcons[name] ?? Store;
  return <Icon className={className} aria-hidden="true" />;
}
