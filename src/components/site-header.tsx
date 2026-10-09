import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/ponudimi-logo.png";

const outline =
  "rounded-full border border-brand-foreground/25 px-4 py-2 font-medium transition-colors hover:bg-brand-foreground/10";
const solid =
  "rounded-full bg-highlight px-4 py-2 font-semibold text-highlight-foreground transition-opacity hover:opacity-90";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-brand text-brand-foreground">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
        <Link to="/" aria-label="PonudiMi — početna" className="flex h-10 w-32 shrink-0 items-center justify-center rounded-md bg-surface">
          <img src={logo} alt="PonudiMi" width={707} height={353} className="h-12 w-32 object-contain" />
        </Link>

        <nav aria-label="Korisničke opcije" className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/podrska" className={outline}>
            Podrška
          </Link>
          {user ? (
            <>
              <Link to="/moji-oglasi" className={outline}>Moji oglasi</Link>
              <Link to="/praceni-oglasi" className={outline}>Prati oglase</Link>
              <span className="hidden px-2 text-brand-foreground/80 sm:inline">
                {(user.user_metadata?.["ime"] as string) || user.email}
              </span>
              <button
                type="button"
                className={solid}
                onClick={async () => {
                  await supabase.auth.signOut();
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
