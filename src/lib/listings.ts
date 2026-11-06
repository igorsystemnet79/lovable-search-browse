import { ponudimi } from "@/integrations/standalone/client";

export type Ponuda = {
  id: string;
  naslov: string;
  opis: string | null;
  kategorija: string;
  lokacija: string;
  cena: number | null;
  valuta: string;
  emoji: string | null;
  istaknuto: boolean;
  zavrseno?: boolean;
  updated_at?: string | null;
  kontakt_ime?: string | null;
  telefon?: string | null;
  ime_prezime?: string | null;
  adresa?: string | null;
  kontakt_zasticen?: boolean;
  verifikovan_korisnik?: boolean;
  created_at: string;
};

export type Zahtev = {
  id: string;
  naslov: string;
  opis: string | null;
  kategorija: string;
  lokacija: string;
  budzet: number | null;
  zavrseno?: boolean;
  updated_at?: string | null;
  kontakt_ime?: string | null;
  telefon?: string | null;
  ime_prezime?: string | null;
  adresa?: string | null;
  kontakt_zasticen?: boolean;
  verifikovan_korisnik?: boolean;
  valuta: string;
  created_at: string;
};

export function formatCena(value: number | null, valuta = "EUR") {
  if (value === null || value === undefined) return "Po dogovoru";
  const simbol = valuta === "EUR" ? "€" : valuta;
  return `${new Intl.NumberFormat("sr-Latn-RS").format(value)} ${simbol}`;
}

export function formatVreme(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sati = Math.floor(diff / 3_600_000);
  if (sati < 1) return "upravo sada";
  if (sati < 24) return `pre ${sati} ${sati === 1 ? "sat" : sati < 5 ? "sata" : "sati"}`;
  const dana = Math.floor(sati / 24);
  return `pre ${dana} ${dana === 1 ? "dan" : "dana"}`;
}

export const ponudeQuery = (limit?: number, samoIstaknute = false) => ({
  queryKey: ["ponude", limit ?? "sve", samoIstaknute],
  queryFn: async (): Promise<Ponuda[]> => {
    let q = ponudimi.from("ponude").select("*").order("created_at", { ascending: false });
    if (samoIstaknute) q = q.eq("istaknuto", true);
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Ponuda[];
  },
});

export const zahteviQuery = (limit?: number) => ({
  queryKey: ["zahtevi", limit ?? "sve"],
  queryFn: async (): Promise<Zahtev[]> => {
    let q = ponudimi.from("zahtevi").select("*").order("created_at", { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Zahtev[];
  },
});

export type SearchResults = { ponude: Ponuda[]; zahtevi: Zahtev[] };

export const pretragaQuery = (q: string, lokacija: string) => ({
  queryKey: ["pretraga", q, lokacija],
  queryFn: async (): Promise<SearchResults> => {
    const args = { q: q.slice(0, 200), mesto: lokacija.slice(0, 100) };
    const [ponude, zahtevi] = await Promise.all([
      ponudimi.rpc("pretrazi_ponude", args),
      ponudimi.rpc("pretrazi_zahteve", args),
    ]);
    if (ponude.error) throw ponude.error;
    if (zahtevi.error) throw zahtevi.error;
    return { ponude: (ponude.data ?? []) as Ponuda[], zahtevi: (zahtevi.data ?? []) as Zahtev[] };
  },
});

export type Izmena = { id: string; oglas_id: string; opis: string; created_at: string };

export const izmeneQuery = (oglasId: string) => ({
  queryKey: ["izmene", oglasId],
  queryFn: async (): Promise<Izmena[]> => {
    const { data, error } = await ponudimi.from("izmene_oglasa").select("id, oglas_id, opis, created_at").eq("oglas_id", oglasId).order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    return data ?? [];
  },
});
