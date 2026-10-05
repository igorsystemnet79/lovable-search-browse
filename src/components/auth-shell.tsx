import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const inputCls =
  "w-full rounded-xl border border-input bg-surface px-4 py-3 text-sm outline-none focus:border-brand";
export const btnCls =
  "w-full rounded-full bg-highlight px-4 py-3 font-semibold text-highlight-foreground transition-opacity hover:opacity-90 disabled:opacity-60";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page flex justify-center py-12">
        <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-card">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
