import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ponudimi, posaljiSignalPrisustva } from "@/integrations/standalone/client";
import logo from "@/assets/ponudimi-logo.png";

const outline =
  "flex min-h-10 items-center justify-center rounded-full border border-brand-foreground/25 px-2 py-2 text-center font-medium leading-tight transition-colors hover:bg-brand-foreground/10 sm:px-4";
const solid =
  "flex min-h-10 items-center justify-center rounded-full bg-highlight px-2 py-2 text-center font-semibold leading-tight text-highlight-foreground transition-opacity hover:opacity-90 sm:px-4";

export function SiteHeader() {
  const { user, isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;

    let active = true;
    const sendPresence = async () => {
      if (!active || document.visibilityState !== "visible") return;
      try {
        await posaljiSignalPrisustva();
      } catch {
        // Presence is best-effort; a missed heartbeat expires automatically.
      }
    };

    void sendPresence();
    const interval = window.setInterval(() => void sendPresence(), 25000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sendPresence();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [user?.id]);

  return (
    <header className="sticky top-0 z-30 bg-brand text-brand-foreground">
      <div className="site-header-inner container-page flex flex-col items-start gap-3 py-3">
        <div className="flex w-full items-center justify-between gap-3">
          <Link to="/" aria-label="PonudiMi — početna" className="flex h-10 w-32 shrink-0 items-center justify-center rounded-md bg-surface">
            <img src={logo} alt="PonudiMi" width={707} height={353} className="h-12 w-32 object-contain" />
          </Link>
          <Link
            to="/pravila-platforme"
            className="flex h-10 w-32 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-100 px-2 text-center text-xs font-semibold leading-tight text-amber-950 shadow-sm transition-colors hover:bg-amber-200 sm:w-40 sm:text-sm"
          >
            Pravila platforme
          </Link>
        </div>

        <nav aria-label="Korisničke opcije" className="site-header-nav grid w-full min-w-0 grid-cols-3 items-center gap-2 text-xs sm:text-sm">
          <Link to="/podrska" className={outline}>
            Podrška
          </Link>
          {user ? (
            <>
              {isAdmin && <Link to="/admin" className={outline}>Admin</Link>}
              <Link to="/moji-oglasi" className={outline}>Moji oglasi</Link>
              <Link to="/praceni-oglasi" className={outline}>Prati oglase</Link>
              <span className="inline-flex min-h-10 items-center justify-center gap-2 px-1 text-center text-brand-foreground/80">
                <span className="relative inline-flex h-2.5 w-2.5 shrink-0" title="Na mreži" aria-label="Na mreži">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="hidden sm:inline">{(user.user_metadata?.["ime"] as string) || user.email}</span>
              </span>
              <button
                type="button"
                className={solid}
                onClick={async () => {
                  await ponudimi.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                Odjava
              </button>
            </>
          ) : (
            <>
              <Link to="/prijava" className={outline}>
                Prijava
              </Link>
              <Link to="/registracija" className={solid}>
                Registracija
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
