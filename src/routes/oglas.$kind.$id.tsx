import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/site-footer";
import { ListingImageGallery } from "@/components/listing-images";
import { FollowButton } from "@/components/follow-button";
import { ReportListingButton } from "@/components/report-listing-button";
import { API_ORIGIN, ponudimi } from "@/integrations/standalone/client";
import { formatCena, formatVreme, type Ponuda, type Zahtev } from "@/lib/listings";

export const Route = createFileRoute("/oglas/$kind/$id")({
  beforeLoad: ({ params }) => { if (params.kind !== "ponuda" && params.kind !== "zahtev") throw notFound(); },
  component: OglasPage,
});


function SendMessageButton({ listingType, listingId, ownListing = false }: { listingType: "ponude" | "zahtevi"; listingId: string; ownListing?: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const session = JSON.parse(localStorage.getItem("ponudimi_session") || "null");
      const response = await fetch(`${API_ORIGIN}/api/messages/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ listing_type: listingType, listing_id: listingId, message: message.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Poruka nije poslata.");
      window.location.href = "/poruke?razgovor=" + encodeURIComponent(data.conversation_id);
    } catch (e) { setError(e instanceof Error ? e.message : "Greška pri slanju poruke."); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">{ownListing ? "Pošalji sebi test poruku" : "Pošalji privatnu poruku"}</button>
    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Pošalji privatnu poruku">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 text-foreground shadow-xl">
        <h2 className="text-lg font-semibold">Pošalji privatnu poruku</h2>
        <p className="mt-1 text-sm text-muted-foreground">{ownListing ? "Ovo je probna poruka na sopstveni oglas. Proverićeš da li stiže u odeljak Poruke i obaveštenja." : "Poruku vide samo učesnici razgovora i ovlašćeni administrator uz evidentiran razlog."}</p>
        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} rows={5} className="mt-4 w-full rounded-xl border border-input bg-background p-3 text-sm" placeholder={ownListing ? "Napiši test poruku sebi…" : "Napiši poruku oglašivaču…"}/>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-input px-4 py-2 text-sm">Odustani</button>
          <button type="button" disabled={!message.trim() || busy} onClick={send} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{busy ? "Slanje…" : "Pošalji"}</button>
        </div>
      </div>
    </div>}
  </>;
}

function OglasPage() {
  const { kind, id } = Route.useParams();
  const isOffer = kind === "ponuda";
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["oglas-detalj", kind, id],
    queryFn: async () => {
      const { data, error } = await ponudimi.from(isOffer ? "ponude" : "zahtevi").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Ponuda | Zahtev;
    },
  });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container-page py-6 sm:py-10"><div className="w-full min-w-0">
        <Link to="/" className="text-sm font-medium text-brand hover:underline">← Početna</Link>
        {isLoading && <p className="py-16 text-center text-muted-foreground">Učitavanje oglasa…</p>}
        {isError && <p className="py-16 text-center text-destructive">Oglas trenutno nije moguće učitati.</p>}
        {data && <article className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <header className="border-b border-border p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">{isOffer ? "Ponuda" : "Zahtev"} · {data.kategorija}</p>
            <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{data.naslov}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{data.lokacija} · {formatVreme(data.created_at)} · {isOffer ? formatCena((data as Ponuda).cena, data.valuta) : (data as Zahtev).budzet !== null ? "Budžet " + formatCena((data as Zahtev).budzet, data.valuta) : "Budžet nije naveden"}</p>
            {(data as any).verifikovan_korisnik && <span className="mt-3 inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">✓ Verifikovan korisnik</span>}
          </header>
          <div className="space-y-6 p-5 sm:p-7">
            <section><h2 className="mb-3 text-lg font-semibold">Fotografije</h2><ListingImageGallery kind={kind as "ponuda" | "zahtev"} id={id} /></section>
            <section><h2 className="mb-3 text-lg font-semibold">Opis oglasa</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">{data.opis?.trim() || "Opis nije dodat."}</p></section>
            {(data.kontakt_zasticen || data.ime_prezime || data.kontakt_ime || data.telefon || data.adresa) && <section className="rounded-xl bg-secondary/60 p-4"><h2 className="mb-2 font-semibold">Podaci o oglašivaču</h2><p className="text-sm"><span className="text-muted-foreground">Ime i prezime: </span><span className={data.kontakt_zasticen ? "blur-[5px] select-none" : ""}>{data.ime_prezime || data.kontakt_ime || "••••••••"}</span></p><p className="mt-1 text-sm"><span className="text-muted-foreground">Telefon: </span>{data.kontakt_zasticen ? <span className="blur-[5px] select-none">••••••••</span> : data.telefon ? <a className="font-semibold text-brand hover:underline" href={"tel:" + data.telefon.replace(/[^+0-9]/g, "")}>{data.telefon}</a> : "Nije naveden"}</p><p className="mt-1 text-sm"><span className="text-muted-foreground">Adresa: </span><span className={data.kontakt_zasticen ? "blur-[5px] select-none" : ""}>{data.adresa || (data.kontakt_zasticen ? "••••••••" : "Nije navedena")}</span></p>{data.kontakt_zasticen && <><p className="mt-3 text-xs text-muted-foreground">Registruj se ili se prijavi da vidiš pune kontakt podatke oglašivača.</p><div className="mt-3 flex flex-wrap gap-2"><Link to="/registracija" className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground">Registruj se</Link><Link to="/prijava" className="rounded-full border border-input px-4 py-2 text-xs font-semibold">Prijavi se</Link></div></>}</section>}
            {user && <div className="border-t border-border pt-4">{isOffer ? <FollowButton ponuda={data as Ponuda} /> : <FollowButton zahtev={data as Zahtev} />}</div>}
            {user && <div className="border-t border-border pt-4"><SendMessageButton listingType={isOffer ? "ponude" : "zahtevi"} listingId={id} ownListing={(data as any).user_id === user.id} /></div>}
            {!user && <div className="border-t border-border pt-4"><Link to="/prijava" className="font-semibold text-brand hover:underline">Prijavi se da pošalješ privatnu poruku</Link></div>}
            {(!user || (data as any).user_id !== user.id) && <ReportListingButton tabela={isOffer ? "ponude" : "zahtevi"} oglasId={id} />}
          </div>
        </article>}
      </div></main>
      <SiteFooter />
    </div>
  );
}
