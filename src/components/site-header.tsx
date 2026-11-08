import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ponudimi, posaljiSignalPrisustva, ucitajKorisnikeNaMrezi } from "@/integrations/standalone/client";
import logo from "@/assets/ponudimi-logo.png";

const outline =
  "flex min-h-10 items-center justify-center rounded-full border border-brand-foreground/25 px-2 py-2 text-center font-medium leading-tight transition-colors hover:bg-brand-foreground/10 sm:px-4";
const solid =
  "flex min-h-10 items-center justify-center rounded-full bg-highlight px-2 py-2 text-center font-semibold leading-tight text-highlight-foreground transition-opacity hover:opacity-90 sm:px-4";

type OnlineUser = {
  id: string;
  ime: string | null;
  prezime: string | null;
  tip_lica?: string;
  naziv_firme?: string | null;
  last_active_at?: string;
};

export function SiteHeader() {
  const { user, isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineOpen, setOnlineOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      setOnlineOpen(false);
      return;
    }

    let active = true;
    const refreshPresence = async () => {
      try {
        await posaljiSignalPrisustva();
        const result = await ucitajKorisnikeNaMrezi();
        if (active) setOnlineUsers(Array.isArray(result.data) ? result.data : []);
      } catch {
        // A missed heartbeat is harmless; the server expires stale presence automatically.
      }
    };

    void refreshPresence();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshPresence();
    }, 25000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshPresence();
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
              <span className="hidden min-h-10 items-center justify-center px-1 text-center text-brand-foreground/80 sm:flex">
                {(user.user_metadata?.["ime"] as string) || user.email}
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
        {user && (
          <div className="relative w-full">
            <button
              type="button"
              onClick={() => setOnlineOpen((open) => !open)}
              aria-expanded={onlineOpen}
              aria-label={`Korisnici na mreži: ${onlineUsers.length}`}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-brand-foreground/25 bg-brand-foreground/5 px-3 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand-foreground/10"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              Korisnici na mreži
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 tabular-nums">{onlineUsers.length}</span>
              <span aria-hidden="true">{onlineOpen ? "▲" : "▼"}</span>
            </button>
            {onlineOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-card p-3 text-card-foreground shadow-xl">
                <div className="mb-2 text-sm font-semibold">Trenutno na mreži</div>
                {onlineUsers.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">Trenutno nema drugih aktivnih korisnika.</p>
                ) : (
                  <ul className="space-y-1">
                    {onlineUsers.map((onlineUser) => {
                      const fullName = [onlineUser.ime, onlineUser.prezime].filter(Boolean).join(" ").trim();
                      const label = onlineUser.tip_lica === "pravno" && onlineUser.naziv_firme
                        ? onlineUser.naziv_firme
                        : fullName || "Korisnik";
                      return (
                        <li key={onlineUser.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-label="Na mreži" />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          {onlineUser.id === user.id && <span className="text-xs text-muted-foreground">Vi</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  Status se automatski osvežava dok koristite platformu.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
