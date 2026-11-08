import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ErrorRouteComponent } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PonudiMi — oglasi i zahtevi na jednom mestu" },
      { name: "description", content: "PonudiMi je platforma za kupovinu i prodaju: objavi oglas, postavi zahtev i pronađi ono što tražiš." },
      { property: "og:title", content: "PonudiMi — oglasi i zahtevi na jednom mestu" },
      { property: "og:description", content: "PonudiMi je platforma za kupovinu i prodaju: objavi oglas, postavi zahtev i pronađi ono što tražiš." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "PonudiMi" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent as unknown as ErrorRouteComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="sr-Latn">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function MaintenanceNotice() {
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const session = JSON.parse(localStorage.getItem("ponudimi_session") || "null");
        const response = await fetch("/api/platform/status", {
          cache: "no-store",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        if (alive) setMaintenance(data.maintenance && !data.isAdmin ? {
          active: true,
          message: data.message || "Platforma je u fazi izrade ili prepravke. Molimo vas za strpljenje.",
        } : null);
      } catch { /* Keep the site usable if the status service is temporarily unavailable. */ }
    };
    check();
    const timer = window.setInterval(check, 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  if (!maintenance?.active) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-label="Platforma je privremeno nedostupna" className="fixed inset-0 z-[100] flex items-center justify-center bg-brand px-6 text-center text-brand-foreground">
      <div className="max-w-xl rounded-3xl bg-surface p-8 text-foreground shadow-2xl sm:p-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-highlight/20 text-3xl" aria-hidden="true">🛠️</div>
        <h1 className="text-2xl font-bold sm:text-3xl">Privremeno održavanje</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{maintenance.message}</p>
        <p className="mt-5 text-sm text-muted-foreground">Hvala na razumevanju.</p>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <MaintenanceNotice />
    </QueryClientProvider>
  );
}
