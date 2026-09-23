import {
  Bus,
  CircleDot,
  Clapperboard,
  HeartPulse,
  Home,
  ShoppingBag,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_META } from "@/lib/categories";
import type { Category } from "@/types/expense";

const ICONS: Record<Category, LucideIcon> = {
  Food: UtensilsCrossed,
  Transport: Bus,
  Utilities: Zap,
  Entertainment: Clapperboard,
  Shopping: ShoppingBag,
  Health: HeartPulse,
  Housing: Home,
  Other: CircleDot,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const Icon = ICONS[category];
  return <Icon className={className} aria-hidden />;
}

export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  return (
    <span
      className={className}
      style={{ backgroundColor: CATEGORY_META[category].color }}
      aria-hidden
    />
  );
}
