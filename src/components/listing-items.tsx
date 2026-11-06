import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FollowButton } from "@/components/follow-button";
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

const titleLinkClass =
  "relative z-10 block min-h-6 shrink-0 whitespace-normal break-words text-left text-sm font-semibold leading-5 text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function PonudaItem({ ponuda, hideFollow, compact = true, featured = false }: { ponuda: Ponuda; hideFollow?: boolean; compact?: boolean; featured?: boolean }) {
  const title = typeof ponuda.naslov === "string" && ponuda.naslov.trim() ? ponuda.naslov.trim() : "Oglas bez naslova";
  return (
    <li className={`flex min-h-0 flex-col rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5 ${featured ? "min-h-[250px] sm:min-h-[270px] w-full min-w-0 overflow-hidden" : compact ? "min-h-[390px] sm:min-h-[410px] w-full min-w-0" : "w-full min-w-0"} ${ponuda.zavrseno ? "opacity-70" : ""}`}>
      <Link to="/oglas/$kind/$id" params={{ kind: "ponuda", id: ponuda.id }} className={titleLinkClass} aria-label={`Otvori oglas: ${title}`}>
        {ponuda.emoji ? <span className="mr-2">{ponuda.emoji}</span> : null}{title}
      </Link>
      <p className="mt-1 shrink-0 text-xs text-muted-foreground">
        {formatCena(ponuda.cena, ponuda.valuta)} · {ponuda.lokacija} · {formatVreme(ponuda.created_at)}
      </p>
      <ListingImageGallery kind="ponuda" id={ponuda.id} singlePreview={compact} />
      {ponuda.opis ? <p className={`mt-2 text-sm text-muted-foreground ${featured || compact ? "line-clamp-2" : ""}`}>{ponuda.opis}</p> : null}
      {(ponuda.kontakt_zasticen || ponuda.ime_prezime || ponuda.kontakt_ime || ponuda.telefon || ponuda.adresa) && <div className="mt-2 space-y-1 text-sm"><p><span className="text-muted-foreground">Objavio: </span><span className={ponuda.kontakt_zasticen ? "blur-[4px] select-none" : ""}>{ponuda.ime_prezime || ponuda.kontakt_ime || "••••••••"}</span></p>{(ponuda.telefon || ponuda.kontakt_zasticen) && <p><span className="text-muted-foreground">Telefon: </span><span className={ponuda.kontakt_zasticen ? "blur-[4px] select-none" : ""}>{ponuda.telefon || "••••••••"}</span></p>}{(ponuda.adresa || ponuda.kontakt_zasticen) && <p><span className="text-muted-foreground">Adresa: </span><span className={ponuda.kontakt_zasticen ? "blur-[4px] select-none" : ""}>{ponuda.adresa || "••••••••"}</span></p>}</div>}
      <StatusIzmene id={ponuda.id} zavrseno={ponuda.zavrseno} updatedAt={ponuda.updated_at} />
      {!hideFollow && <FollowButton ponuda={ponuda} />}
    </li>
  );
}

export function ZahtevItem({ zahtev, hideFollow, compact = true, featured = false }: { zahtev: Zahtev; hideFollow?: boolean; compact?: boolean; featured?: boolean }) {
  const title = typeof zahtev.naslov === "string" && zahtev.naslov.trim() ? zahtev.naslov.trim() : "Zahtev bez naslova";
  return (
    <li className={`flex w-full min-w-0 min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5 ${featured ? "min-h-[250px] sm:min-h-[270px] overflow-hidden" : compact ? "min-h-[390px] sm:min-h-[410px]" : ""} ${zahtev.zavrseno ? "opacity-70" : ""}`}>
      <Link to="/oglas/$kind/$id" params={{ kind: "zahtev", id: zahtev.id }} className={titleLinkClass} aria-label={`Otvori zahtev: ${title}`}>{title}</Link>
      <p className="mt-1 shrink-0 text-xs text-muted-foreground">
        {zahtev.lokacija} · {formatVreme(zahtev.created_at)}
        {zahtev.budzet !== null ? ` · budžet ${formatCena(zahtev.budzet, zahtev.valuta)}` : ""}
      </p>
      <ListingImageGallery kind="zahtev" id={zahtev.id} singlePreview={compact} />
      {zahtev.opis ? <p className={`mt-2 text-sm text-muted-foreground ${featured || compact ? "line-clamp-2" : ""}`}>{zahtev.opis}</p> : null}
      {(zahtev.kontakt_zasticen || zahtev.ime_prezime || zahtev.kontakt_ime || zahtev.telefon || zahtev.adresa) && <div className="mt-2 space-y-1 text-sm"><p><span className="text-muted-foreground">Objavio: </span><span className={zahtev.kontakt_zasticen ? "blur-[4px] select-none" : ""}>{zahtev.ime_prezime || zahtev.kontakt_ime || "••••••••"}</span></p>{(zahtev.telefon || zahtev.kontakt_zasticen) && <p><span className="text-muted-foreground">Telefon: </span><span className={zahtev.kontakt_zasticen ? "blur-[4px] select-none" : ""}>{zahtev.telefon || "••••••••"}</span></p>}{(zahtev.adresa || zahtev.kontakt_zasticen) && <p><span className="text-muted-foreground">Adresa: </span><span className={zahtev.kontakt_zasticen ? "blur-[4px] select-none" : ""}>{zahtev.adresa || "••••••••"}</span></p>}</div>}
      <StatusIzmene id={zahtev.id} zavrseno={zahtev.zavrseno} updatedAt={zahtev.updated_at} />
      {!hideFollow && <FollowButton zahtev={zahtev} />}
    </li>
  );
}
