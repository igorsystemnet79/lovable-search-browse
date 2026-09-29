type SearchPanelProps = {
  defaultQ?: string;
  defaultLokacija?: string;
  /** Otvori rezultate u novom tabu (početna strana). */
  newTab?: boolean;
};

export function SearchPanel({ defaultQ = "", defaultLokacija = "", newTab }: SearchPanelProps) {
  return (
    <form
      action="/pretraga"
      method="get"
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      className="grid gap-3 rounded-2xl bg-surface p-4 shadow-panel sm:grid-cols-[2fr_1fr_auto]"
    >
      <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
        <span aria-hidden="true" className="text-muted-foreground">
          ⌕
        </span>
        <input
          type="search"
          name="q"
          defaultValue={defaultQ}
          placeholder="Šta tražiš danas?"
          aria-label="Pretraži oglase"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
        <span aria-hidden="true">📍</span>
        <input
          type="text"
          name="lokacija"
          defaultValue={defaultLokacija}
          placeholder="Lokacija"
          aria-label="Izaberi lokaciju"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <button
        type="submit"
        className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
      >
        Pretraži
      </button>
    </form>
  );
}
