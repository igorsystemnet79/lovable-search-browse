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

        <button
          type="button"
          className="rounded-full bg-highlight px-6 py-3 font-semibold text-highlight-foreground transition-opacity hover:opacity-90"
        >
          Pridruži se besplatno
        </button>
      </div>
    </footer>
  );
}
