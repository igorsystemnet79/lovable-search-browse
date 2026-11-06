import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FollowButton } from "@/components/follow-button";
import { Link } from "@tanstack/react-router";
import { ListingImageGallery } from "@/components/listing-images";
import { formatCena, formatVreme, izmeneQuery, type Ponuda, type Zahtev } from "@/lib/listings";

function StatusIzmene({ id, zavrseno, updatedAt }: { id: string; zavrseno?: boolean | undefined; updatedAt?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ ...izmeneQuery(id), enabled: open });
  if (!zavrseno && !updatedAt) return null;
  return (
    <div className="mt-2 text-xs">
      {zavrseno && <span className="mr-2 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">Oglas je završen</span>}
      {updatedAt && (
        <button type="button" onClick={() => setOpen(!open)} className="font-semibold text-muted-foreground hover:underline">
          Izmenjeno {formatVreme(updatedAt)} {open ? "▴" : "▾"}
        </button>
      )}
      {open && (
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {q.data?.map((i) => <li key={i.id}>{formatVreme(i.created_at)}: {i.opis}</li>)}
        </ul>
      )}
    </div>
  );
}

export function PonudaItem({ ponuda, hideFollow, maskContacts = false }: { ponuda: Ponuda; hideFollow?: boolean; maskContacts?: boolean }) {
  return (
    <li className={`rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5 ${ponuda.zavrseno ? "opacity-70" : ""}`}>
      <Link to="/oglas/$kind/$id" params={{ kind: "ponuda", id: ponuda.id }} className="font-medium hover:text-brand hover:underline">
        {ponuda.emoji ? <span className="mr-2">{ponuda.emoji}</span> : null}
        {ponuda.naslov}
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatCena(ponuda.cena, ponuda.valuta)} · {ponuda.lokacija} · {formatVreme(ponuda.created_at)}
      </p>
      <ListingImageGallery kind="ponuda" id={ponuda.id} />
      {ponuda.opis ? <p className="mt-2 text-sm text-muted-foreground">{ponuda.opis}</p> : null}
      {ponuda.verifikovan_korisnik && <div className="mt-2"><span className="mr-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">✓ Verifikovan korisnik</span></div>}
      {ponuda.kontakt_ime && <div className="mt-2 text-sm">
        {maskContacts ? (
          <div className="flex flex-wrap items-center gap-2">
            <span aria-label="Ime i telefon su sakriveni" className="select-none blur-[4px]">{ponuda.kontakt_ime}{ponuda.telefon ? ` · ${ponuda.telefon}` : ""}</span>
            <Link to="/prijava" className="font-semibold text-brand hover:underline">Prijavi se za kontakt</Link>
          </div>
        ) : <p>{ponuda.kontakt_ime}{ponuda.telefon && <> · <a className="text-brand hover:underline" href={`tel:${ponuda.telefon.replace(/[^+0-9]/g, "")}`}>{ponuda.telefon}</a></>}</p>}
      </div>}
      <StatusIzmene id={ponuda.id} zavrseno={ponuda.zavrseno} updatedAt={ponuda.updated_at} />
      {!hideFollow && <FollowButton ponuda={ponuda} />}
    </li>
  );
}

export function ZahtevItem({ zahtev, maskContacts = false }: { zahtev: Zahtev; maskContacts?: boolean }) {
  return (
    <li className={`rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5 ${zahtev.zavrseno ? "opacity-70" : ""}`}>
      <Link to="/oglas/$kind/$id" params={{ kind: "zahtev", id: zahtev.id }} className="font-medium hover:text-brand hover:underline">{zahtev.naslov}</Link>
      <p className="mt-1 text-xs text-muted-foreground">
        {zahtev.lokacija} · {formatVreme(zahtev.created_at)}
        {zahtev.budzet !== null ? ` · budžet ${formatCena(zahtev.budzet, zahtev.valuta)}` : ""}
      </p>
      <ListingImageGallery kind="zahtev" id={zahtev.id} />
      {zahtev.opis ? <p className="mt-2 text-sm text-muted-foreground">{zahtev.opis}</p> : null}
      {zahtev.verifikovan_korisnik && <div className="mt-2"><span className="mr-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">✓ Verifikovan korisnik</span></div>}
      {zahtev.kontakt_ime && <div className="mt-2 text-sm">
        {maskContacts ? (
          <div className="flex flex-wrap items-center gap-2">
            <span aria-label="Ime i telefon su sakriveni" className="select-none blur-[4px]">{zahtev.kontakt_ime}{zahtev.telefon ? ` · ${zahtev.telefon}` : ""}</span>
            <Link to="/prijava" className="font-semibold text-brand hover:underline">Prijavi se za kontakt</Link>
          </div>
        ) : <p>{zahtev.kontakt_ime}{zahtev.telefon && <> · <a className="text-brand hover:underline" href={`tel:${zahtev.telefon.replace(/[^+0-9]/g, "")}`}>{zahtev.telefon}</a></>}</p>}
      </div>}
      <StatusIzmene id={zahtev.id} zavrseno={zahtev.zavrseno} updatedAt={zahtev.updated_at} />
    </li>
  );
}
