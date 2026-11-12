import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ErrorRouteComponent } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { API_ORIGIN } from "@/integrations/standalone/client";

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
      { name: "theme-color", content: "#173b67" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "PonudiMi" },
      { title: "PonudiMi — oglasi i zahtevi na jednom mestu" },
      { name: "description", content: "PonudiMi je platforma za kupovinu i prodaju: objavi oglas, postavi zahtev i pronađi ono što tražiš." },
      { property: "og:title", content: "PonudiMi — oglasi i zahtevi na jednom mestu" },
      { property: "og:description", content: "PonudiMi je platforma za kupovinu i prodaju: objavi oglas, postavi zahtev i pronađi ono što tražiš." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "PonudiMi" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/ponudimi-app-icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/ponudimi-app-icon.svg" },
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; isAdmin: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const token = JSON.parse(window.localStorage.getItem("ponudimi_session") || "null")?.access_token;
        const response = await fetch(`${API_ORIGIN}/api/maintenance-status`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        if (active) setMaintenance({ enabled: Boolean(data.enabled), isAdmin: Boolean(data.isAdmin), message: data.message || "Platforma PonudiMi je trenutno u fazi izrade ili unapređenja. Molimo vas za strpljenje. Uskoro se vraćamo!" });
      } catch { /* Privremeni prekid API-ja ne sme sam da aktivira režim održavanja. */ }
    };
    void check();
    const interval = window.setInterval(check, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  // iOS Safari may keep the visual viewport magnified after a pinch even when
  // the viewport meta tag is reset. Try the native reset first; if Safari keeps
  // the zoom, visually normalize the app root without changing catalog layout.
  useEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const appRoot = document.getElementById("root");
    if (!viewport || !appRoot) return;

    const originalContent = viewport.content || "width=device-width, initial-scale=1";
    let resetTimer: number | undefined;
    let restoreTimer: number | undefined;
    let transitionTimer: number | undefined;
    let compensationActive = false;

    const clearCompensation = () => {
      compensationActive = false;
      appRoot.style.removeProperty("transform");
      appRoot.style.removeProperty("transform-origin");
      appRoot.style.removeProperty("will-change");
      appRoot.style.removeProperty("transition");
      window.visualViewport?.removeEventListener("resize", updateCompensation);
      window.visualViewport?.removeEventListener("scroll", updateCompensation);
      window.removeEventListener("scroll", updateCompensation);
    };

    const updateCompensation = () => {
      const visualViewport = window.visualViewport;
      if (!visualViewport || visualViewport.scale <= 1.02) {
        clearCompensation();
        return;
      }

      const scale = visualViewport.scale;
      // Counter the visual viewport scale and its pan while retaining the
      // current document scroll position. This changes no element dimensions.
      const x = visualViewport.offsetLeft + window.scrollX * (1 - 1 / scale);
      const y = visualViewport.offsetTop + window.scrollY * (1 - 1 / scale);
      appRoot.style.transformOrigin = "0 0";
      appRoot.style.willChange = "transform";
      appRoot.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 / scale})`;
    };

    const enableCompensation = () => {
      const visualViewport = window.visualViewport;
      if (!visualViewport || visualViewport.scale <= 1.02) return;
      compensationActive = true;
      appRoot.style.transition = "transform 240ms ease-out";
      updateCompensation();
      visualViewport.addEventListener("resize", updateCompensation, { passive: true });
      visualViewport.addEventListener("scroll", updateCompensation, { passive: true });
      window.addEventListener("scroll", updateCompensation, { passive: true });
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(() => {
        appRoot.style.removeProperty("transition");
        transitionTimer = undefined;
      }, 280);
    };

    const restoreDeviceScale = () => {
      viewport.content = "width=device-width, initial-scale=1, maximum-scale=1";
      restoreTimer = window.setTimeout(() => {
        if ((window.visualViewport?.scale ?? 1) > 1.02) {
          enableCompensation();
        } else {
          clearCompensation();
        }
        viewport.content = originalContent;
        restoreTimer = undefined;
      }, 450);
    };

    const scheduleReset = () => {
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        resetTimer = undefined;
        if ((window.visualViewport?.scale ?? 1) > 1.02) restoreDeviceScale();
      }, 220);
    };

    const onTouchStart = (event: TouchEvent) => {
      // Let a new two-finger gesture zoom naturally; normalize again on release.
      if (event.touches.length >= 2 && compensationActive) clearCompensation();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) scheduleReset();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("gestureend", scheduleReset, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("gestureend", scheduleReset);
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
      clearCompensation();
      viewport.content = originalContent;
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("PonudiMi service worker registration failed:", error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {maintenance?.enabled && !maintenance.isAdmin && currentPath !== "/prijava" && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="maintenance-title" className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-[#102b49] px-5 py-10 text-center text-white">
          <div className="w-full max-w-xl rounded-3xl border border-amber-300/50 bg-white p-7 text-[#173b67] shadow-2xl sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl" aria-hidden="true">🛠️</div>
            <h1 id="maintenance-title" className="mt-5 text-2xl font-bold sm:text-3xl">PonudiMi je trenutno na održavanju</h1>
            <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-slate-600">{maintenance.message}</p>
            <p className="mt-6 text-sm font-medium text-slate-500">Hvala na razumevanju i strpljenju.</p>
            <a
              href="/prijava"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#173b67] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#214f83] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
            >
              Prijava administratora
            </a>
          </div>
        </div>
      )}
    </QueryClientProvider>
  );
}
