import type { Category, EntryType } from "@/types/expense";

export type Frequency = "daily" | "weekly" | "monthly";

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  category: Category;
  type: EntryType;
  frequency: Frequency;
  nextDue: string;
  autoLog: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringInput {
  name: string;
  amount: number;
  category: Category;
  type: EntryType;
  frequency: Frequency;
  nextDue: string;
  autoLog: boolean;
  active: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  monthlyAllocation: number;
  savedAmount: number;
  lastAllocated: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoalInput {
  name: string;
  targetAmount: number;
  targetDate: string | null;
  monthlyAllocation: number;
  savedAmount: number;
}
