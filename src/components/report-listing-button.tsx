import { useState, type FormEvent } from "react";
import { prijaviOglas } from "@/lib/reports";

const reasons = [
  ["sumnja_na_prevaru", "Sumnja na prevaru"],
  ["netacni_podaci", "Netačni podaci u oglasu"],
  ["neispravan_kontakt", "Neispravan kontakt"],
  ["neprimeren_sadrzaj", "Neprimeren sadržaj"],
  ["dupliran_oglas", "Dupliran oglas"],
  ["ostalo", "Ostalo"],
] as const;

export function ReportListingButton({ tabela, oglasId }: { tabela: "ponude" | "zahtevi"; oglasId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await prijaviOglas({ tabela, oglas_id: oglasId, razlog: reason, detalji: details.trim() });
      setSuccess(true);
      setMessage("Hvala. Prijava je poslata administratoru na pregled.");
      setReason("");
      setDetails("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Prijavu trenutno nije moguće poslati.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-t border-border pt-4">
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setMessage(""); }} className="text-sm font-medium text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-destructive">
          Prijavi neispravan oglas
        </button>
      ) : (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-semibold">Prijava oglasa</h2><p className="mt-1 text-xs text-muted-foreground">Prijava je poverljiva i biće poslata administratoru na proveru.</p></div>
            <button type="button" aria-label="Zatvori prijavu" onClick={() => setOpen(false)} className="rounded-full px-2 text-lg text-muted-foreground hover:bg-secondary">×</button>
          </div>
          {success ? (
            <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{message}</p>
          ) : (
            <form onSubmit={submit} className="mt-3 space-y-3">
              <label className="block text-sm font-medium">Razlog prijave
                <select required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Izaberi razlog</option>
                  {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Dodatno objašnjenje <span className="font-normal text-muted-foreground">(opciono)</span>
                <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={3} placeholder="Opiši šta nije u redu..." className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </label>
              {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={!reason || busy} className="min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{busy ? "Šaljem..." : "Pošalji prijavu"}</button>
                <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full border border-input px-4 py-2 text-sm">Odustani</button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
