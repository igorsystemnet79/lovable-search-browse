import { useState } from "react";
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

export function PonudaItem({ ponuda, hideFollow, compact = false }: { ponuda: Ponuda; hideFollow?: boolean; compact?: boolean }) {
  return (
    <li className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5 ${compact ? "h-[390px] sm:h-[410px]" : ""} ${ponuda.zavrseno ? "opacity-70" : ""}`}>
      <p className="font-medium">
        {ponuda.emoji ? <span className="mr-2">{ponuda.emoji}</span> : null}
        {ponuda.naslov}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatCena(ponuda.cena, ponuda.valuta)} · {ponuda.lokacija} · {formatVreme(ponuda.created_at)}
      </p>
      <ListingImageGallery kind="ponuda" id={ponuda.id} singlePreview={compact} />
      {ponuda.opis ? <p className={`mt-2 text-sm text-muted-foreground ${compact ? "line-clamp-2" : ""}`}>{ponuda.opis}</p> : null}
      {ponuda.kontakt_ime && <p className="mt-2 text-sm">{ponuda.kontakt_ime}{ponuda.telefon && <> · <a className="text-brand hover:underline" href={`tel:${ponuda.telefon.replace(/[^+0-9]/g, "")}`}>{ponuda.telefon}</a></>}</p>}
      <StatusIzmene id={ponuda.id} zavrseno={ponuda.zavrseno} updatedAt={ponuda.updated_at} />
      {!hideFollow && <FollowButton ponuda={ponuda} />}
    </li>
  );
}

export function ZahtevItem({ zahtev, hideFollow, compact = false }: { zahtev: Zahtev; hideFollow?: boolean; compact?: boolean }) {
  return (
    <li className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5 ${compact ? "h-[390px] sm:h-[410px]" : ""} ${zahtev.zavrseno ? "opacity-70" : ""}`}>
      <p className="font-medium">{zahtev.naslov}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {zahtev.lokacija} · {formatVreme(zahtev.created_at)}
        {zahtev.budzet !== null ? ` · budžet ${formatCena(zahtev.budzet, zahtev.valuta)}` : ""}
      </p>
      <ListingImageGallery kind="zahtev" id={zahtev.id} singlePreview={compact} />
      {zahtev.opis ? <p className={`mt-2 text-sm text-muted-foreground ${compact ? "line-clamp-2" : ""}`}>{zahtev.opis}</p> : null}
      {zahtev.kontakt_ime && <p className="mt-2 text-sm">{zahtev.kontakt_ime}{zahtev.telefon && <> · <a className="text-brand hover:underline" href={`tel:${zahtev.telefon.replace(/[^+0-9]/g, "")}`}>{zahtev.telefon}</a></>}</p>}
      <StatusIzmene id={zahtev.id} zavrseno={zahtev.zavrseno} updatedAt={zahtev.updated_at} />
      {!hideFollow && <FollowButton zahtev={zahtev} />}
    </li>
  );
}
