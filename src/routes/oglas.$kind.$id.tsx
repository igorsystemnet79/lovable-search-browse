import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";\nimport { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/site-footer";
import { ListingImageGallery } from "@/components/listing-images";
import { FollowButton } from "@/components/follow-button";
import { ponudimi } from "@/integrations/standalone/client";
import { formatCena, formatVreme, type Ponuda, type Zahtev } from "@/lib/listings";\nimport { prijaviOglas } from "@/lib/admin.functions";

export const Route = createFileRoute("/oglas/$kind/$id")({
  beforeLoad: ({ params }) => { if (params.kind !== "ponuda" && params.kind !== "zahtev") throw notFound(); },
  component: OglasPage,
});

function OglasPage() {
  const { kind, id } = Route.useParams();
  const isOffer = kind === "ponuda";
  const { user } = useAuth();\n  const [reportOpen, setReportOpen] = useState(false);\n  const [reportReason, setReportReason] = useState("sumnja_na_prevaru");\n  const [reportDetails, setReportDetails] = useState("");\n  const [reportMessage, setReportMessage] = useState("");\n  const [reportBusy, setReportBusy] = useState(false);
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
            {data.verifikovan_korisnik && <span className="mt-3 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">✓ Verifikovan korisnik</span>}
          </header>
          <div className="space-y-6 p-5 sm:p-7">
            <section><h2 className="mb-3 text-lg font-semibold">Fotografije</h2><ListingImageGallery kind={kind as "ponuda" | "zahtev"} id={id} /></section>
            <section><h2 className="mb-3 text-lg font-semibold">Opis oglasa</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">{data.opis?.trim() || "Opis nije dodat."}</p></section>
            {(data.kontakt_zasticen || data.ime_prezime || data.kontakt_ime || data.telefon || data.adresa) && <section className="rounded-xl bg-secondary/60 p-4"><h2 className="mb-2 font-semibold">Podaci o oglašivaču</h2>{data.verifikovan_korisnik && <span className="mb-3 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">✓ Verifikovan korisnik</span>}<p className="text-sm"><span className="text-muted-foreground">Ime i prezime: </span><span className={data.kontakt_zasticen ? "blur-[5px] select-none" : ""}>{data.ime_prezime || data.kontakt_ime || "••••••••"}</span></p><p className="mt-1 text-sm"><span className="text-muted-foreground">Telefon: </span>{data.kontakt_zasticen ? <span className="blur-[5px] select-none">••••••••</span> : data.telefon ? <a className="font-semibold text-brand hover:underline" href={"tel:" + data.telefon.replace(/[^+0-9]/g, "")}>{data.telefon}</a> : "Nije naveden"}</p><p className="mt-1 text-sm"><span className="text-muted-foreground">Adresa: </span><span className={data.kontakt_zasticen ? "blur-[5px] select-none" : ""}>{data.adresa || (data.kontakt_zasticen ? "••••••••" : "Nije navedena")}</span></p>{data.kontakt_zasticen && <><p className="mt-3 text-xs text-muted-foreground">Registruj se ili se prijavi da vidiš pune kontakt podatke oglašivača.</p><div className="mt-3 flex flex-wrap gap-2"><Link to="/registracija" className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground">Registruj se</Link><Link to="/prijava" className="rounded-full border border-input px-4 py-2 text-xs font-semibold">Prijavi se</Link></div></>}</section>}
            {user && <div className="border-t border-border pt-4">{isOffer ? <FollowButton ponuda={data as Ponuda} /> : <FollowButton zahtev={data as Zahtev} />}</div>}
            <section className="border-t border-border pt-4">
              {!reportOpen ? <div><button type="button" onClick={() => { setReportOpen(true); setReportMessage(""); }} className="text-sm font-medium text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-destructive">Prijavi oglas</button>{reportMessage && <p role="status" className="mt-2 text-sm text-brand">{reportMessage}</p>}</div> : <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <h2 className="font-semibold">Prijava oglasa</h2>
                <p className="mt-1 text-xs text-muted-foreground">Prijava će biti prosleđena administratoru na proveru.</p>
                <label className="mt-3 block text-sm font-medium" htmlFor="report-reason">Razlog prijave</label>
                <select id="report-reason" className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm" value={reportReason} onChange={e=>setReportReason(e.target.value)}>
                  <option value="sumnja_na_prevaru">Sumnja na prevaru</option><option value="netacni_podaci">Netačni podaci</option><option value="neispravan_kontakt">Neispravan kontakt</option><option value="neprimeren_sadrzaj">Neprimeren sadržaj</option><option value="dupliran_oglas">Dupliran oglas</option><option value="ostalo">Ostalo</option>
                </select>
                <label className="mt-3 block text-sm font-medium" htmlFor="report-details">Dodatno objašnjenje (opciono)</label>
                <textarea id="report-details" className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm" rows={3} maxLength={1000} value={reportDetails} onChange={e=>setReportDetails(e.target.value)} placeholder="Opiši problem..." />
                {reportMessage && <p role="status" className="mt-2 text-sm text-brand">{reportMessage}</p>}
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={reportBusy} onClick={async()=>{setReportBusy(true);setReportMessage("");try{await prijaviOglas(isOffer?"ponude":"zahtevi",id,reportReason,reportDetails);setReportMessage("Hvala. Prijava je uspešno poslata administratoru.");setReportOpen(false);setReportDetails("");}catch(e){setReportMessage(e instanceof Error?e.message:"Prijava nije poslata. Pokušaj ponovo.");}finally{setReportBusy(false);}}} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{reportBusy?"Slanje...":"Pošalji prijavu"}</button><button type="button" className={small} onClick={()=>setReportOpen(false)} disabled={reportBusy}>Odustani</button></div>
              </div>}
            </section>
          </div>
        </article>}
      </div></main>
      <SiteFooter />
    </div>
  );
}
