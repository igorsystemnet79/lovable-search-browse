import { Input } from "@/components/ui/input";

type SearchPanelProps = {
  defaultQ?: string;
  defaultLokacija?: string;
  defaultKategorija?: string;
  defaultMinCena?: string;
  defaultMaxCena?: string;
  defaultValuta?: string;
  defaultSort?: string;
  advanced?: boolean;
  searchPath?: "/pretraga" | "/ponude" | "/zahtevi";
};

export function SearchPanel({ defaultQ = "", defaultLokacija = "", defaultKategorija = "", defaultMinCena = "", defaultMaxCena = "", defaultValuta = "", defaultSort = "najnovije", advanced = false, searchPath = "/pretraga" }: SearchPanelProps) {
  return (
    <form
      action={searchPath}
      method="get"
      className={`grid gap-3 rounded-2xl bg-surface p-4 shadow-panel ${advanced ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-[2fr_1fr_auto]"}`}
    >
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
        <span aria-hidden="true" className="shrink-0 text-muted-foreground">⌕</span>
        <Input
          type="text"
          name="q"
          defaultValue={defaultQ}
          placeholder="Šta tražiš danas?"
          aria-label="Pretraži oglase"
          className="h-auto min-w-0 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
        <span aria-hidden="true" className="shrink-0">📍</span>
        <Input
          type="text"
          name="lokacija"
          defaultValue={defaultLokacija}
          placeholder="Lokacija"
          aria-label="Izaberi lokaciju"
          className="h-auto min-w-0 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      {advanced ? (
        <>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-background px-4 py-2">
            <span className="text-xs text-muted-foreground">Kategorija</span>
            <Input name="kategorija" defaultValue={defaultKategorija} placeholder="Npr. Mobilni telefoni" className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0" />
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-background px-4 py-2">
            <span className="text-xs text-muted-foreground">Cena / budžet od</span>
            <Input name="minCena" type="number" min="0" step="0.01" defaultValue={defaultMinCena} placeholder="0" className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0" />
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-background px-4 py-2">
            <span className="text-xs text-muted-foreground">Cena / budžet do</span>
            <Input name="maxCena" type="number" min="0" step="0.01" defaultValue={defaultMaxCena} placeholder="Bez ograničenja" className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0" />
          </div>
          <label className="flex flex-col gap-1 rounded-xl border border-border bg-background px-4 py-2">
            <span className="text-xs text-muted-foreground">Valuta</span>
            <select name="valuta" defaultValue={defaultValuta} className="w-full bg-transparent text-sm outline-none"><option value="">Sve valute</option><option value="EUR">EUR (€)</option><option value="RSD">RSD</option></select>
          </label>
          <label className="flex flex-col gap-1 rounded-xl border border-border bg-background px-4 py-2">
            <span className="text-xs text-muted-foreground">Sortiranje</span>
            <select name="sort" defaultValue={defaultSort} className="w-full bg-transparent text-sm outline-none"><option value="najnovije">Najnovije</option><option value="najstarije">Najstarije</option><option value="cena_rastuce">Cena / budžet: niže prvo</option><option value="cena_opadajuce">Cena / budžet: više prvo</option></select>
          </label>
        </>
      ) : null}

      <button
        type="submit"
        className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
      >
        Pretraži
      </button>
    </form>
  );
}
