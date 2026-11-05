import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PonudaItem, ZahtevItem } from "@/components/listing-items";
import { ListingFormDialog, type ListingEdit, type ListingKind } from "@/components/listing-form-dialog";
import { useAuth } from "@/hooks/use-auth";
import { ponudimi } from "@/integrations/standalone/client";
import { mojiOglasiQuery } from "@/lib/my-listings";
import type { Ponuda, Zahtev } from "@/lib/listings";

export const Route = createFileRoute("/moji-oglasi")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Moji oglasi — PonudiMi" },
      { name: "description", content: "Istorija tvojih objavljenih oglasa i zahteva na PonudiMi." },
      { property: "og:title", content: "Moji oglasi — PonudiMi" },
      { property: "og:description", content: "Istorija tvojih objavljenih oglasa i zahteva na PonudiMi." },
    ],
  }),
  component: MojiOglasi,
});

function toValues(x: Ponuda | Zahtev, iznos: number | null) {
  return { naslov: x.naslov, opis: x.opis ?? "", kategorija: x.kategorija, lokacija: x.lokacija, kontakt_ime: x.kontakt_ime ?? "", telefon: x.telefon ?? "", iznos: iznos === null ? "" : String(iznos), valuta: (x.valuta === "RSD" ? "RSD" : "EUR") as "EUR" | "RSD" };
}

function MojiOglasi() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...mojiOglasiQuery(user?.id ?? ""), enabled: !!user });
  const [kind, setKind] = useState<ListingKind | null>(null);
  const [edit, setEdit] = useState<ListingEdit | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function obrisi(table: "ponude" | "zahtevi", id: string) {
    if (busyId) return;
    if (!confirm("Da li sigurno želiš da obrišeš ovu objavu?")) return;
    setBusyId(id);
    setActionError("");
    try {
      const column = table === "ponude" ? "ponuda_id" : "zahtev_id";
      const { data: photos, error: photosError } = await ponudimi.from("slike_oglasa").select("storage_path").eq(column, id);
      if (photosError) throw new Error("Fotografije nisu mogle da se pripreme za brisanje.");
      const paths = (photos ?? []).map((photo) => photo.storage_path).filter((path): path is string => !!path);
      if (paths.length) {
        const { error: storageError } = await ponudimi.storage.from("slike-oglasa").remove(paths);
        if (storageError) throw new Error("Fotografije nisu mogle da se obrišu. Oglas nije obrisan.");
      }
      const { error } = await ponudimi.from(table).delete().eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries();
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Oglas nije mogao da se obriše. Pokušaj ponovo.");
    } finally {
      setBusyId(null);
    }
  }

  async function zavrsi(table: "ponude" | "zahtevi", id: string, v: boolean) {
    if (busyId) return;
    setBusyId(id);
    setActionError("");
    try {
      const { error } = await ponudimi.from(table).update({ zavrseno: v }).eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries();
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Status oglasa nije mogao da se promeni. Pokušaj ponovo.");
    } finally {
      setBusyId(null);
    }
  }

  async function pauziraj(table: "ponude" | "zahtevi", id: string, v: boolean) {
    if (busyId) return;
    setBusyId(id);
    setActionError("");
    try {
      const { error } = await ponudimi.from(table).update({ pauziran: v }).eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries();
    } catch (error) {
      setActionError(error instanceof Error && error.message ? error.message : "Status pauze nije mogao da se promeni. Pokušaj ponovo.");
    } finally {
      setBusyId(null);
    }
  }

  const actions = (k: ListingKind, x: Ponuda | Zahtev, iznos: number | null) => (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 text-sm">
      <button type="button" disabled={!!busyId} className="font-semibold text-brand hover:underline disabled:cursor-wait disabled:opacity-50" onClick={() => { setEdit({ id: x.id, values: toValues(x, iznos) }); setKind(k); }}>Izmeni</button>
      <button type="button" disabled={!!busyId} className="font-semibold text-destructive hover:underline disabled:cursor-wait disabled:opacity-50" onClick={() => obrisi(k === "ponuda" ? "ponude" : "zahtevi", x.id)}>{busyId === x.id ? "Sačekaj…" : "Obriši"}</button>
      <button type="button" disabled={!!busyId} className="font-semibold text-muted-foreground hover:underline disabled:cursor-wait disabled:opacity-50" onClick={() => zavrsi(k === "ponuda" ? "ponude" : "zahtevi", x.id, !x.zavrseno)}>{busyId === x.id ? "Čuvanje…" : x.zavrseno ? "Ponovo aktiviraj" : "Završi oglas"}</button>
      <button type="button" disabled={!!busyId || !!x.zavrseno} className="font-semibold text-muted-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50" onClick={() => pauziraj(k === "ponuda" ? "ponude" : "zahtevi", x.id, !x.pauziran)}>{busyId === x.id ? "Čuvanje…" : x.pauziran ? "Nastavi oglas" : "Pauziraj oglas"}</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-10">
        <h1 className="text-3xl font-bold">Moji oglasi</h1>
        {!loading && !user && <p className="mt-4">Da vidiš svoje oglase, <Link to="/prijava" className="font-semibold text-brand underline">prijavi se</Link>.</p>}
        {user && (
          <div className="mt-6 grid w-full min-w-0 grid-cols-1 gap-6">
            {actionError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{actionError}</p>}
            {q.isError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">Tvoji oglasi trenutno nisu mogli da se učitaju. Osveži stranicu ili pokušaj ponovo.</p>}
            <section className="rounded-2xl bg-secondary/60 p-5">
              <h2 className="text-xl font-semibold">Moje ponude</h2>
              {q.data?.ponude.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Još nemaš objavljenih oglasa.</p>}
              <ul className="mt-4 space-y-4">{q.data?.ponude.map((p) => <div key={p.id}><PonudaItem ponuda={p} hideFollow />{actions("ponuda", p, p.cena)}</div>)}</ul>
            </section>
            <section className="rounded-2xl bg-secondary/60 p-5">
              <h2 className="text-xl font-semibold">Moji zahtevi</h2>
              {q.data?.zahtevi.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Još nemaš postavljenih zahteva.</p>}
              <ul className="mt-4 space-y-4">{q.data?.zahtevi.map((z) => <div key={z.id}><ZahtevItem zahtev={z} />{actions("zahtev", z, z.budzet)}</div>)}</ul>
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
      <ListingFormDialog kind={kind} edit={edit} onClose={() => { setKind(null); setEdit(null); }} />
    </div>
  );
}
