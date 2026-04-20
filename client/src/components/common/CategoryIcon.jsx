import React from 'react';
import {
  Trophy,
  Music,
  Cpu,
  Gamepad2,
  Tent,
  Utensils,
  Palette,
  Users,
  Dumbbell,
  MoreHorizontal,
  MapPin
} from 'lucide-react';

const CATEGORY_ICONS = {
  Sports: Trophy,
  Music: Music,
  Tech: Cpu,
  Gaming: Gamepad2,
  Outdoors: Tent,
  Food: Utensils,
  Arts: Palette,
  Networking: Users,
  Fitness: Dumbbell,
  Other: MoreHorizontal,
};

export const CategoryIcon = ({ category, size = 24, className = "" }) => {
  const IconComponent = CATEGORY_ICONS[category] || MapPin;
  return <IconComponent size={size} className={className} />;
};

export default CategoryIcon;
