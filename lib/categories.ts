import type { Category } from "@/types/expense";

export const CATEGORY_META: Record<
  Category,
  { color: string; tint: string; description: string }
> = {
  Food: {
    color: "#c4622d",
    tint: "#f4e3d4",
    description: "Groceries, coffee, and meals",
  },
  Transport: {
    color: "#2a7a78",
    tint: "#d7eceb",
    description: "Transit, rides, and fuel",
  },
  Utilities: {
    color: "#3d5a80",
    tint: "#dce4ef",
    description: "Power, internet, and phone",
  },
  Entertainment: {
    color: "#7a4e8a",
    tint: "#eadff0",
    description: "Tickets, streaming, and nights out",
  },
  Shopping: {
    color: "#b44b6a",
    tint: "#f6dde5",
    description: "Clothes, goods, and gifts",
  },
  Health: {
    color: "#3f7d4e",
    tint: "#dceade",
    description: "Pharmacy, fitness, and care",
  },
  Housing: {
    color: "#a67c2d",
    tint: "#f3e8cf",
    description: "Home upkeep and household supplies",
  },
  Other: {
    color: "#6b645b",
    tint: "#e7e4df",
    description: "Everything that doesn't fit yet",
  },
};
