import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Overview",
};

export default function HomePage() {
  return <Dashboard />;
}
