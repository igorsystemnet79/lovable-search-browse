import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inputCls } from "@/components/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { ponudimi } from "@/integrations/standalone/client";
import { kategorije, vrednostKategorije } from "@/lib/kategorije";
import { listingFormSchema, type ListingFormValues } from "@/lib/listing-form";
import { ListingImages, ucitajSlikeOglasa, sacuvajSlikeOglasa, type ListingPhoto } from "@/components/listing-images";

export type ListingKind = "ponuda" | "zahtev";
const empty: ListingFormValues = { naslov: "", opis: "", kategorija: "", lokacija: "", kontakt_ime: "", telefon: "", iznos: "", valuta: "EUR" };

export type ListingEdit = { id: string; values: ListingFormValues };
export function ListingFormDialog({ kind, onClose, edit }: { kind: ListingKind | null; onClose: () => void; edit?: ListingEdit | null }) {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [subcategoryPickerOpen, setSubcategoryPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const selectedCategoryData = kategorije.find((category) => category.naziv === selectedCategory);
  const visibleCategories = kategorije.filter((category) =>
    category.naziv.toLocaleLowerCase("sr-Latn").includes(pickerSearch.trim().toLocaleLowerCase("sr-Latn")),
  );
  const visibleSubcategories = (selectedCategoryData?.podkategorije ?? []).filter((subcategory) =>
    subcategory.toLocaleLowerCase("sr-Latn").includes(pickerSearch.trim().toLocaleLowerCase("sr-Latn")),
  );

  useEffect(() => {
    if (!kind) return;
    setSaved(false);
    setError("");
    setPhotos([]);
    setCreatedId(null);
    setSelectedCategory("");
    setSelectedSubcategory("");
    setPickerSearch("");
    setForm({ ...empty, kontakt_ime: typeof user?.user_metadata?.["ime"] === "string" ? user.user_metadata["ime"] : "", telefon: typeof user?.user_metadata?.["telefon"] === "string" ? user.user_metadata["telefon"] : "", lokacija: typeof user?.user_metadata?.["grad"] === "string" ? user.user_metadata["grad"] : "" });
    if (edit) {
      setForm(edit.values);
      const [categoryName, subcategoryName] = edit.values.kategorija.split(" / ", 2);
      setSelectedCategory(categoryName ?? "");
      setSelectedSubcategory(subcategoryName ?? "");
      return;
    }
    try {
      const raw = sessionStorage.getItem("ponudimi-listing-draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.kind === kind) {
          setForm({ ...empty, ...draft.form });
          const [categoryName, subcategoryName] = String(draft.form?.kategorija ?? "").split(" / ", 2);
          setSelectedCategory(categoryName ?? "");
          setSelectedSubcategory(subcategoryName ?? "");
        }
      }
    } catch { /* Storage may be unavailable. */ }
  }, [kind, user?.id, edit?.id]);

  useEffect(() => {
    let active = true;
    if (!kind || !edit?.id) return;
    ucitajSlikeOglasa(kind, edit.id)
      .then((items) => { if (active) setPhotos(items); })
      .catch(() => { if (active) setError("Fotografije postojećeg oglasa nisu mogle da se učitaju."); });
    return () => { active = false; };
  }, [kind, edit?.id]);

  function keepDraft() {
    try { sessionStorage.setItem("ponudimi-listing-draft", JSON.stringify({ kind, form })); } catch { /* Optional draft. */ }
  }
  function field(key: keyof ListingFormValues) {
    return { value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((old) => ({ ...old, [key]: e.target.value })) };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !kind || busy) return;
    const result = listingFormSchema.safeParse(form);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Proveri podatke."); return; }
    if (!selectedCategory || !selectedSubcategory || !vrednostKategorije(result.data.kategorija)) {
      setError("Obavezno izaberi kategoriju i potkategoriju.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { iznos, ...values } = result.data;
      const amount = iznos === "" ? null : Number(iznos);
      const common = { ...values, user_id: user.id };
      let listingId = edit?.id ?? createdId ?? "";
      if (edit || createdId) {
        const response = kind === "ponuda"
          ? await ponudimi.from("ponude").update({ ...values, cena: amount }).eq("id", listingId)
          : await ponudimi.from("zahtevi").update({ ...values, budzet: amount }).eq("id", listingId);
        if (response.error) throw response.error;
      } else if (kind === "ponuda") {
        const response = await ponudimi.from("ponude").insert({ ...common, cena: amount, istaknuto: false }).select("id").single();
        if (response.error) throw response.error;
        listingId = response.data.id;
        setCreatedId(listingId);
      } else {
        const response = await ponudimi.from("zahtevi").insert({ ...common, budzet: amount }).select("id").single();
        if (response.error) throw response.error;
        listingId = response.data.id;
        setCreatedId(listingId);
      }
      // Oglas bez fotografija ne treba da zavisi od dostupnosti tabele ili Storage-a za slike.
      // Kod izmene ipak pozivamo čuvanje i sa praznom listom kako bi uklonjene slike bile obrisane.
      if (photos.length > 0 || edit) {
        try {
          await sacuvajSlikeOglasa(kind, listingId, user.id, photos);
        } catch (photoError) {
          const detail = photoError instanceof Error ? photoError.message : "";
          throw new Error(`Oglas je sačuvan, ali fotografije nisu. ${detail}`.trim());
        }
      }
      setSaved(true);
      try { sessionStorage.removeItem("ponudimi-listing-draft"); } catch { /* Optional draft. */ }
      await queryClient.invalidateQueries();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.startsWith("Oglas je sačuvan, ali fotografije nisu.")) {
        setError(message + " Možeš ponovo pokušati sa fotografijama ili ukloniti slike i sačuvati oglas.");
      } else if (/row-level security|permission denied|not allowed/i.test(message)) {
        setError("Nemamo dozvolu da sačuvamo ove podatke ili fotografije. Proveri prijavu i dozvole naloga.");
      } else if (/bucket.*not found|storage.*not found/i.test(message)) {
        setError("Prostor za fotografije nije podešen na serveru. Oglas može biti sačuvan bez fotografija.");
      } else if (/does not exist|could not find the table/i.test(message)) {
        setError("Nedostaje tabela potrebna za čuvanje fotografija. Oglas može biti sačuvan bez fotografija.");
      } else if (/network|fetch|failed to fetch|timeout/i.test(message)) {
        setError("Veza sa serverom nije uspela. Proveri internet i pokušaj ponovo.");
      } else {
        setError(message ? `Objava nije uspela: ${message}` : "Objava nije uspela. Pokušaj ponovo.");
      }
    }
    finally { setBusy(false); }
  }

  const offer = kind === "ponuda";
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg bg-surface">
        <DialogHeader>
          <DialogTitle>{saved ? (edit ? "Izmene sačuvane" : "Uspešno objavljeno") : edit ? "Izmeni objavu" : offer ? "Objavi oglas" : "Postavi zahtev"}</DialogTitle>
          <DialogDescription>{saved ? (offer ? "Tvoj oglas je objavljen." : "Tvoj zahtev je objavljen.") : offer ? "Podaci o proizvodu ili usluzi i kontaktu." : "Podaci o onome što tražiš i kontaktu."}</DialogDescription>
        </DialogHeader>
        {saved ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90"><Link to={offer ? "/ponude" : "/zahtevi"}>Pogledaj {offer ? "ponude" : "zahteve"}</Link></Button>
            <Button variant="outline" onClick={onClose}>Zatvori</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium sm:col-span-2">{offer ? "Šta prodaješ ili nudiš?" : "Šta tražiš?"}<input className={inputCls} required minLength={3} maxLength={150} {...field("naslov")} /></label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">Opis<textarea className={inputCls} rows={3} maxLength={3000} {...field("opis")} /></label>
            <ListingImages value={photos} onChange={setPhotos} disabled={busy} />
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
              <div className="space-y-1 text-sm font-medium">
                <span className="block">Kategorija <span className="text-destructive">*</span></span>
                <Button type="button" variant="outline" className="h-11 w-full justify-between rounded-md px-3 font-normal" onClick={() => { setPickerSearch(""); setCategoryPickerOpen(true); }}>
                  <span className={selectedCategory ? "text-foreground" : "text-muted-foreground"}>{selectedCategory || "Izaberi kategoriju"}</span>
                  <span aria-hidden="true">⌄</span>
                </Button>
              </div>
              <div className="space-y-1 text-sm font-medium">
                <span className="block">Potkategorija <span className="text-destructive">*</span></span>
                <Button type="button" variant="outline" disabled={!selectedCategory} className="h-11 w-full justify-between rounded-md px-3 font-normal" onClick={() => { setPickerSearch(""); setSubcategoryPickerOpen(true); }}>
                  <span className={selectedSubcategory ? "text-foreground" : "text-muted-foreground"}>{selectedSubcategory || "Izaberi potkategoriju"}</span>
                  <span aria-hidden="true">⌄</span>
                </Button>
              </div>
              <input type="hidden" name="kategorija" value={form.kategorija} />
              <Dialog open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
                <DialogContent className="max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-surface">
                  <DialogHeader><DialogTitle>Izaberi kategoriju</DialogTitle><DialogDescription>Odaberi kategoriju kojoj pripada tvoj oglas ili zahtev.</DialogDescription></DialogHeader>
                  <input className={inputCls} type="search" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Pretraži kategorije…" autoComplete="off" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {visibleCategories.map((category) => (
                      <Button key={category.slug} type="button" variant={selectedCategory === category.naziv ? "default" : "outline"} className="h-auto min-h-11 justify-start whitespace-normal text-left" onClick={() => {
                        setSelectedCategory(category.naziv);
                        setSelectedSubcategory("");
                        setForm((old) => ({ ...old, kategorija: category.naziv }));
                        setCategoryPickerOpen(false);
                        setPickerSearch("");
                      }}>{category.naziv}</Button>
                    ))}
                    {visibleCategories.length === 0 && <p className="text-sm text-muted-foreground sm:col-span-2">Nema rezultata pretrage.</p>}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={subcategoryPickerOpen} onOpenChange={setSubcategoryPickerOpen}>
                <DialogContent className="max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-surface">
                  <DialogHeader><DialogTitle>Izaberi potkategoriju</DialogTitle><DialogDescription>{selectedCategory} — izaberi odgovarajuću potkategoriju.</DialogDescription></DialogHeader>
                  <input className={inputCls} type="search" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Pretraži potkategorije…" autoComplete="off" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {visibleSubcategories.map((subcategory) => (
                      <Button key={subcategory} type="button" variant={selectedSubcategory === subcategory ? "default" : "outline"} className="h-auto min-h-11 justify-start whitespace-normal text-left" onClick={() => {
                        setSelectedSubcategory(subcategory);
                        setForm((old) => ({ ...old, kategorija: `${selectedCategory} / ${subcategory}` }));
                        setSubcategoryPickerOpen(false);
                        setPickerSearch("");
                      }}>{subcategory}</Button>
                    ))}
                    {visibleSubcategories.length === 0 && <p className="text-sm text-muted-foreground sm:col-span-2">Nema rezultata pretrage.</p>}
                  </div>
                </DialogContent>
              </Dialog>
              <p className="text-xs text-muted-foreground sm:col-span-2">Obavezno je izabrati prvo kategoriju, a zatim jednu od njenih potkategorija.</p>
            </div>
            <label className="space-y-1 text-sm font-medium">Adresa (grad/mesto) <span className="text-destructive">*</span><input className={inputCls} required minLength={2} maxLength={100} autoComplete="address-level2" {...field("lokacija")} /></label>
            <label className="space-y-1 text-sm font-medium">Ime i prezime <span className="text-destructive">*</span><input className={inputCls} required minLength={5} maxLength={100} autoComplete="name" {...field("kontakt_ime")} /></label>
            <label className="space-y-1 text-sm font-medium">Telefon <span className="text-destructive">*</span><input className={inputCls} type="tel" required minLength={6} maxLength={30} autoComplete="tel" {...field("telefon")} /></label>
            <label className="space-y-1 text-sm font-medium">{offer ? "Cena (opciono)" : "Budžet (opciono)"}<input className={inputCls} type="number" min={0} step="0.01" placeholder="Po dogovoru" {...field("iznos")} /></label>
            <label className="space-y-1 text-sm font-medium">Valuta<select className={inputCls} {...field("valuta")}><option value="EUR">EUR — evro</option><option value="RSD">RSD — dinar</option></select></label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Ime i prezime, grad/mesto i telefon biće prikazani uz objavu.</p>
            {!loading && !user && <p className="text-sm sm:col-span-2">Za objavu se <Link to="/prijava" onClick={keepDraft} className="font-semibold text-brand underline">prijavi</Link> ili <Link to="/registracija" onClick={keepDraft} className="font-semibold text-brand underline">registruj besplatno</Link>.</p>}
            {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={busy || loading || !user} className="h-auto rounded-full bg-highlight py-3 text-highlight-foreground hover:bg-highlight/90 sm:col-span-2">{busy ? "Čuvanje…" : edit ? "Sačuvaj izmene" : offer ? "Objavi oglas" : "Postavi zahtev"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}