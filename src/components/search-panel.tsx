import { useState } from "react";
import { ClearableSearchInput } from "@/components/clearable-search-input";

type SearchPanelProps = {
  defaultQ?: string;
  defaultLokacija?: string;
  /** Otvori rezultate u novom tabu (početna strana). */
  newTab?: boolean;
};

export function SearchPanel({ defaultQ = "", defaultLokacija = "", newTab }: SearchPanelProps) {
  const [q, setQ] = useState(defaultQ);
  const [lokacija, setLokacija] = useState(defaultLokacija);

  return (
    <form
      action="/pretraga"
      method="get"
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      className="grid gap-3 rounded-2xl bg-surface p-4 shadow-panel sm:grid-cols-[2fr_1fr_auto]"
    >
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
        <span aria-hidden="true" className="shrink-0 text-muted-foreground">⌕</span>
        <ClearableSearchInput
          value={q}
          onChange={setQ}
          placeholder="Šta tražiš danas?"
          ariaLabel="Pretraži oglase"
          className="text-sm"
        />
      </div>

      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
        <span aria-hidden="true" className="shrink-0">📍</span>
        <ClearableSearchInput
          value={lokacija}
          onChange={setLokacija}
          placeholder="Lokacija"
          ariaLabel="Lokacija"
          className="text-sm"
        />
      </div>

      <button
        type="submit"
        className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
      >
        Pretraži
      </button>
    </form>
  );
}
