import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inputCls } from "@/components/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { kategorije } from "@/lib/kategorije";
import { listingFormSchema, type ListingFormValues } from "@/lib/listing-form";

export type ListingKind = "ponuda" | "zahtev";
const empty: ListingFormValues = { naslov: "", opis: "", kategorija: "", lokacija: "", kontakt_ime: "", telefon: "", iznos: "", valuta: "EUR" };

export function ListingFormDialog({ kind, onClose }: { kind: ListingKind | null; onClose: () => void }) {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!kind) return;
    setSaved(false);
    setError("");
    setForm({ ...empty, kontakt_ime: typeof user?.user_metadata["ime"] === "string" ? user.user_metadata["ime"] : "", telefon: typeof user?.user_metadata["telefon"] === "string" ? user.user_metadata["telefon"] : "", lokacija: typeof user?.user_metadata["grad"] === "string" ? user.user_metadata["grad"] : "" });
    try {
      const raw = sessionStorage.getItem("ponudimi-listing-draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.kind === kind) setForm({ ...empty, ...draft.form });
      }
    } catch { /* Storage may be unavailable. */ }
  }, [kind, user?.id]);

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
    if (!kategorije.some((k) => k.naziv === result.data.kategorija)) { setError("Izaberi kategoriju."); return; }
    setBusy(true);
    setError("");
    try {
      const { iznos, ...values } = result.data;
      const amount = iznos === "" ? null : Number(iznos);
      const common = { ...values, user_id: user.id };
      const response = kind === "ponuda"
        ? await supabase.from("ponude").insert({ ...common, cena: amount, istaknuto: false })
        : await supabase.from("zahtevi").insert({ ...common, budzet: amount });
      if (response.error) throw response.error;
      setSaved(true);
      try { sessionStorage.removeItem("ponudimi-listing-draft"); } catch { /* Optional draft. */ }
      await queryClient.invalidateQueries();
    } catch { setError("Objava nije uspela. Proveri vezu i prijavu, pa pokušaj ponovo."); }
    finally { setBusy(false); }
  }

  const offer = kind === "ponuda";
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg bg-surface">
        <DialogHeader>
          <DialogTitle>{saved ? "Uspešno objavljeno" : offer ? "Objavi oglas" : "Postavi zahtev"}</DialogTitle>
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
            <label className="space-y-1 text-sm font-medium">Kategorija<select className={inputCls} required {...field("kategorija")}><option value="">Izaberi kategoriju</option>{kategorije.map((k) => <option key={k.slug} value={k.naziv}>{k.naziv}</option>)}</select></label>
            <label className="space-y-1 text-sm font-medium">Grad / mesto<input className={inputCls} required minLength={2} maxLength={100} {...field("lokacija")} /></label>
            <label className="space-y-1 text-sm font-medium">{offer ? "Prodavac / ponuđač" : "Ime osobe za kontakt"}<input className={inputCls} required minLength={2} maxLength={100} autoComplete="name" {...field("kontakt_ime")} /></label>
            <label className="space-y-1 text-sm font-medium">Telefon<input className={inputCls} type="tel" required minLength={6} maxLength={30} autoComplete="tel" {...field("telefon")} /></label>
            <label className="space-y-1 text-sm font-medium">{offer ? "Cena (opciono)" : "Budžet (opciono)"}<input className={inputCls} type="number" min={0} step="0.01" placeholder="Po dogovoru" {...field("iznos")} /></label>
            <label className="space-y-1 text-sm font-medium">Valuta<select className={inputCls} {...field("valuta")}><option value="EUR">EUR — evro</option><option value="RSD">RSD — dinar</option></select></label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Ime i telefon biće javno prikazani uz objavu.</p>
            {!loading && !user && <p className="text-sm sm:col-span-2">Za objavu se <Link to="/prijava" onClick={keepDraft} className="font-semibold text-brand underline">prijavi</Link> ili <Link to="/registracija" onClick={keepDraft} className="font-semibold text-brand underline">registruj besplatno</Link>.</p>}
            {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button type="submit" disabled={busy || loading || !user} className="h-auto rounded-full bg-highlight py-3 text-highlight-foreground hover:bg-highlight/90 sm:col-span-2">{busy ? "Objavljivanje…" : offer ? "Objavi oglas" : "Postavi zahtev"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}