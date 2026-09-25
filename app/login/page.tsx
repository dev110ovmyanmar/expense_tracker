import type { Metadata } from "next";
import { AuthForms } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return <AuthForms />;
}
