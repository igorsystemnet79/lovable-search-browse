import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-brand text-brand-foreground">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Ponudi<span className="text-highlight">Mi</span>
        </Link>

        <nav aria-label="Korisničke opcije" className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="rounded-full border border-brand-foreground/25 px-4 py-2 font-medium transition-colors hover:bg-brand-foreground/10"
          >
            Podrška
          </button>
          <button
            type="button"
            className="rounded-full border border-brand-foreground/25 px-4 py-2 font-medium transition-colors hover:bg-brand-foreground/10"
          >
            Prijava
          </button>
          <button
            type="button"
            className="rounded-full bg-highlight px-4 py-2 font-semibold text-highlight-foreground transition-opacity hover:opacity-90"
          >
            Registracija
          </button>
        </nav>
      </div>
    </header>
  );
}
