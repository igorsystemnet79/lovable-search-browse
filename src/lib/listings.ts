import { supabase } from "@/integrations/supabase/client";

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
  kontakt_ime?: string | null;
  telefon?: string | null;
  created_at: string;
};

export type Zahtev = {
  id: string;
  naslov: string;
  opis: string | null;
  kategorija: string;
  lokacija: string;
  budzet: number | null;
  kontakt_ime?: string | null;
  telefon?: string | null;
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
    let q = supabase.from("ponude").select("*").order("created_at", { ascending: false });
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
    let q = supabase.from("zahtevi").select("*").order("created_at", { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Zahtev[];
  },
});

export type SearchResults = { ponude: Ponuda[]; zahtevi: Zahtev[] };

function escapeLike(value: string) {
  return value.replace(/[%,()]/g, " ").trim();
}

export const pretragaQuery = (q: string, lokacija: string) => ({
  queryKey: ["pretraga", q, lokacija],
  queryFn: async (): Promise<SearchResults> => {
    const term = escapeLike(q);
    const mesto = escapeLike(lokacija);

    let ponudeReq = supabase.from("ponude").select("*").order("created_at", { ascending: false });
    let zahteviReq = supabase.from("zahtevi").select("*").order("created_at", { ascending: false });

    if (term) {
      const filter = `naslov.ilike.%${term}%,opis.ilike.%${term}%,kategorija.ilike.%${term}%,lokacija.ilike.%${term}%`;
      ponudeReq = ponudeReq.or(filter);
      zahteviReq = zahteviReq.or(filter);
    }
    if (mesto) {
      ponudeReq = ponudeReq.ilike("lokacija", `%${mesto}%`);
      zahteviReq = zahteviReq.ilike("lokacija", `%${mesto}%`);
    }

    const [ponude, zahtevi] = await Promise.all([ponudeReq, zahteviReq]);
    if (ponude.error) throw ponude.error;
    if (zahtevi.error) throw zahtevi.error;

    return {
      ponude: (ponude.data ?? []) as Ponuda[],
      zahtevi: (zahtevi.data ?? []) as Zahtev[],
    };
  },
});
