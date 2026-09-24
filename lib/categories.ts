import type { Category } from "@/types/expense";

export const CATEGORY_META: Record<
  Category,
  { color: string; tint: string; description: string }
> = {
  "Food & Beverages": {
    color: "#c4622d",
    tint: "#f4e3d4",
    description: "Tea shops, cafes, and meals",
  },
  Groceries: {
    color: "#2f6f4e",
    tint: "#dceade",
    description: "Markets and convenience stores",
  },
  Food: {
    color: "#a65b3a",
    tint: "#f3e0d4",
    description: "Other meals",
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
  Salary: {
    color: "#1f7a4d",
    tint: "#d7f0e3",
    description: "Monthly pay and wages",
  },
  Freelance: {
    color: "#1d6b8a",
    tint: "#d6eef6",
    description: "Client work and contracts",
  },
  Investments: {
    color: "#8a6a1d",
    tint: "#f6edd4",
    description: "Dividends, interest, and returns",
  },
};
