import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-brand text-brand-foreground">
      <div className="container-page flex flex-wrap items-center justify-between gap-6 py-12">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground"
          >
            ✓
          </span>
          <div>
            <h2 className="text-xl font-semibold">
              Pridruži se zajednici koja kupuje i prodaje pametnije.
            </h2>
            <p className="mt-1 text-sm text-brand-foreground/70">
              Hiljade oglasa i zahteva na jednom mestu.
            </p>
          </div>
        </div>

        <nav aria-label="Pravne informacije" className="flex flex-wrap gap-4 text-sm text-brand-foreground/80">
          <Link to="/za-firme" className="hover:underline">Za firme — paketi</Link>
          <Link to="/pravila-platforme" className="hover:underline">Pravila platforme</Link>
          <Link to="/politika-privatnosti" className="hover:underline">Politika privatnosti</Link>
          <Link to="/informacije-o-kupovini" className="hover:underline">Informacije o kupovini</Link>
        </nav>

        <Button
          asChild
          className="h-auto rounded-full bg-highlight px-6 py-3 font-semibold text-highlight-foreground transition-opacity hover:bg-highlight hover:opacity-90"
        >
          <Link to="/registracija">Pridruži se besplatno</Link>
        </Button>
      </div>
    </footer>
  );
}
