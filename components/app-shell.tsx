"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleHelp, Download, FileText, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { AccessGate, LockedPlaceholder, useAccess } from "@/components/access-gate";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const links = [
  { href: "/", label: "Přehled", icon: LayoutDashboard },
  { href: "/faktury", label: "Faktury", icon: FileText },
  { href: "/statistiky", label: "Statistiky", icon: BarChart3 },
  { href: "/odberatele", label: "Odběratelé", icon: Users },
  { href: "/import", label: "Import", icon: Download },
  { href: "/nastaveni", label: "Nastavení", icon: Settings },
  { href: "/napoveda", label: "Nápověda", icon: CircleHelp },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ShellChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { unlocked, status, ico, logout } = useAccess();
  const showContent = unlocked;

  return (
    <div className="min-h-screen">
      <aside
        className="app-shell-chrome no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[oklch(0.28_0.04_158)] text-[oklch(0.96_0.01_95)] md:flex"
        data-print-hide
      >
        <div className="px-5 pt-6 pb-5">
          <Link href="/" className="block">
            <span className="font-heading text-2xl tracking-tight">Faktura</span>
            <span className="mt-1 block text-sm text-white/70">Evidence dokladů</span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                  !unlocked ? "pointer-events-none opacity-40" : "",
                )}
                tabIndex={unlocked ? undefined : -1}
                aria-disabled={!unlocked}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 px-5 py-5">
          {unlocked && ico ? (
            <div className="space-y-2">
              <p className="text-xs text-white/55">Přihlášeno IČO {ico}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={logout}
                className="h-auto w-full justify-start gap-2 px-0 py-0 text-xs text-white/70 hover:bg-transparent hover:text-white"
              >
                <LogOut className="size-3.5" />
                Odhlásit / změnit IČO
              </Button>
            </div>
          ) : null}
          <p className="text-xs leading-5 text-white/55">Data zůstávají v souboru na tomto počítači.</p>
        </div>
      </aside>

      <div className="md:pl-60">
        <div
          className="app-shell-chrome no-print sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur md:hidden"
          data-print-hide
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-heading text-xl">
              Faktura
            </Link>
            {unlocked ? (
              <Button type="button" variant="ghost" size="sm" onClick={logout} className="text-xs text-muted-foreground">
                Změnit IČO
              </Button>
            ) : null}
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-sm",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    !unlocked ? "pointer-events-none opacity-40" : "",
                  )}
                  tabIndex={unlocked ? undefined : -1}
                  aria-disabled={!unlocked}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {status === "loading" ? (
            <div className="rounded-xl bg-card px-5 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              Ověřuji přístup…
            </div>
          ) : showContent ? (
            children
          ) : (
            <LockedPlaceholder />
          )}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate>
      <ShellChrome>{children}</ShellChrome>
    </AccessGate>
  );
}
