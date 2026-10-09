import { FollowButton } from "@/components/follow-button";
import { formatCena, formatVreme, type Ponuda, type Zahtev } from "@/lib/listings";

export function PonudaItem({ ponuda, hideFollow }: { ponuda: Ponuda; hideFollow?: boolean }) {
  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5">
      <p className="font-medium">
        {ponuda.emoji ? <span className="mr-2">{ponuda.emoji}</span> : null}
        {ponuda.naslov}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatCena(ponuda.cena, ponuda.valuta)} · {ponuda.lokacija} · {formatVreme(ponuda.created_at)}
      </p>
      {ponuda.opis ? <p className="mt-2 text-sm text-muted-foreground">{ponuda.opis}</p> : null}
      {ponuda.kontakt_ime && <p className="mt-2 text-sm">{ponuda.kontakt_ime}{ponuda.telefon && <> · <a className="text-brand hover:underline" href={`tel:${ponuda.telefon.replace(/[^+0-9]/g, "")}`}>{ponuda.telefon}</a></>}</p>}
      {!hideFollow && <FollowButton ponuda={ponuda} />}
    </li>
  );
}

export function ZahtevItem({ zahtev }: { zahtev: Zahtev }) {
  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card transition-transform hover:-translate-y-0.5">
      <p className="font-medium">{zahtev.naslov}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {zahtev.lokacija} · {formatVreme(zahtev.created_at)}
        {zahtev.budzet !== null ? ` · budžet ${formatCena(zahtev.budzet, zahtev.valuta)}` : ""}
      </p>
      {zahtev.opis ? <p className="mt-2 text-sm text-muted-foreground">{zahtev.opis}</p> : null}
      {zahtev.kontakt_ime && <p className="mt-2 text-sm">{zahtev.kontakt_ime}{zahtev.telefon && <> · <a className="text-brand hover:underline" href={`tel:${zahtev.telefon.replace(/[^+0-9]/g, "")}`}>{zahtev.telefon}</a></>}</p>}
    </li>
  );
}
