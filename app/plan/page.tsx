import type { Metadata } from "next";
import { PlanBoard } from "@/components/plan-board";

export const metadata: Metadata = {
  title: "အစီအစဉ်",
};

export default function PlanPage() {
  return <PlanBoard />;
}
