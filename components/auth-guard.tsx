"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/context/AuthContext";

const PUBLIC = new Set(["/login", "/reset-password"]);

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const isPublic = PUBLIC.has(pathname);

  useEffect(() => {
    if (!configured || loading) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && pathname === "/login") router.replace("/");
  }, [configured, isPublic, loading, pathname, router, user]);

  if (!configured) return <AppShell>{children}</AppShell>;
  if (loading) {
    return <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">Checking your session…</div>;
  }
  if (!user && !isPublic) {
    return <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">Checking your session…</div>;
  }
  if (isPublic) return children;
  return <AppShell>{children}</AppShell>;
}
