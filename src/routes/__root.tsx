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

  // Controlled pinch zoom: prevent Safari from horizontally panning the page,
  // and remove the temporary transform immediately when the gesture ends.
  // Keeping the transform temporary avoids changing document layout/width.
  useEffect(() => {
    const root = document.getElementById("root");
    const html = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    const previousHtmlTouchAction = html.style.touchAction;
    const previousBodyTouchAction = body.style.touchAction;
    const previousRootTouchAction = root.style.touchAction;
    html.style.touchAction = "pan-y";
    body.style.touchAction = "pan-y";
    root.style.touchAction = "pan-y";

    let pinchStartDistance = 0;
    let pinchOriginX = 0;
    let pinchOriginY = 0;
    let pinching = false;
    let cleanupFrame = 0;

    const distance = (a: Touch, b: Touch) =>
      Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    const clearTemporaryZoom = () => {
      if (!pinching && !cleanupFrame) return;
      pinching = false;

      // First remove the temporary scale and let Safari commit the original
      // layout. Resetting scrollLeft while the scaled layer is still active
      // can be undone by WebKit when it recalculates the transformed bounds.
      root.style.transition = "none";
      root.style.transform = "none";
      root.style.transformOrigin = "0 0";
      cancelAnimationFrame(cleanupFrame);

      const pageTop = window.scrollY;
      cleanupFrame = requestAnimationFrame(() => {
        // Restore horizontal alignment only after the unscaled frame has
        // been committed by WebKit. Keep the user's vertical position.
        window.scrollTo({ left: 0, top: pageTop, behavior: "instant" });
        document.documentElement.scrollLeft = 0;
        document.body.scrollLeft = 0;

        // A wide business-catalog table has its own horizontal scroller.
        // iOS Safari can leave that nested scroller offset after the root
        // pinch transform is removed, even when the document is reset.
        // Restore the catalog's outer scroller to its centered starting edge.
        root.querySelectorAll<HTMLElement>(".catalog-page .overflow-x-auto").forEach((scroller) => {
          scroller.scrollLeft = 0;
        });

        cleanupFrame = requestAnimationFrame(() => {
          root.style.removeProperty("transform");
          root.style.removeProperty("transform-origin");
          root.style.removeProperty("transition");
          root.style.removeProperty("will-change");
          cleanupFrame = 0;
        });
      });
      pinchStartDistance = 0;
    };

    // Safari iOS emits proprietary gesture events for native page zoom.
    // Cancel them so only our controlled temporary root transform handles pinch.
    const preventNativeSafariZoom = (event: Event) => {
      event.preventDefault();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      cancelAnimationFrame(cleanupFrame);
      cleanupFrame = 0;
      const a = event.touches[0];
      const b = event.touches[1];
      pinchStartDistance = Math.max(1, distance(a, b));
      // Anchor the temporary scale to the top-left corner. Scaling around
      // the center creates negative horizontal bounds on iOS Safari; WebKit
      // can preserve that horizontal displacement after the transform clears.
      pinchOriginX = 0;
      pinchOriginY = 0;
      pinching = true;
      root.style.transition = "none";
      root.style.transformOrigin = `${pinchOriginX}px ${pinchOriginY}px`;
      root.style.willChange = "transform";
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pinching || event.touches.length !== 2) return;
      event.preventDefault();
      const scale = Math.min(2.5, Math.max(1, distance(event.touches[0], event.touches[1]) / pinchStartDistance));
      root.style.transform = scale === 1 ? "none" : `scale(${scale})`;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (pinching && event.touches.length < 2) clearTemporaryZoom();
    };

    document.addEventListener("gesturestart", preventNativeSafariZoom, { passive: false });
    document.addEventListener("gesturechange", preventNativeSafariZoom, { passive: false });
    document.addEventListener("gestureend", preventNativeSafariZoom, { passive: false });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", clearTemporaryZoom, { passive: true });

    return () => {
      document.removeEventListener("gesturestart", preventNativeSafariZoom);
      document.removeEventListener("gesturechange", preventNativeSafariZoom);
      document.removeEventListener("gestureend", preventNativeSafariZoom);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", clearTemporaryZoom);
      cancelAnimationFrame(cleanupFrame);
      root.style.removeProperty("transform");
      root.style.removeProperty("transform-origin");
      root.style.removeProperty("transition");
      root.style.removeProperty("will-change");
      html.style.touchAction = previousHtmlTouchAction;
      body.style.touchAction = previousBodyTouchAction;
      root.style.touchAction = previousRootTouchAction;
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
