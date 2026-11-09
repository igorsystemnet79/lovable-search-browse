import { ponudimi } from "@/integrations/standalone/client";
import type { Ponuda, Zahtev } from "@/lib/listings";

export const mojiOglasiQuery = (userId: string) => ({
  queryKey: ["moji-oglasi", userId],
  queryFn: async () => {
    const [p, z] = await Promise.all([
      ponudimi.from("ponude").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ponudimi.from("zahtevi").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    if (p.error) throw p.error;
    if (z.error) throw z.error;
    return { ponude: (p.data ?? []) as Ponuda[], zahtevi: (z.data ?? []) as Zahtev[] };
  },
});

export type Pracenje = {
  id: string;
  ponuda_id: string | null;
  zahtev_id: string | null;
  pocetna_cena: number | null;
  pocetni_budzet: number | null;
  ponude: Ponuda | null;
  zahtevi: Zahtev | null;
};

export const pracenjaQuery = (userId: string) => ({
  queryKey: ["pracenja", userId],
  queryFn: async (): Promise<Pracenje[]> => {
    const [{ data, error }, { data: offers, error: offersError }, { data: requests, error: requestsError }] = await Promise.all([
      ponudimi.from("pracenja").select("id, ponuda_id, zahtev_id, pocetna_cena, pocetni_budzet").eq("user_id", userId).order("created_at", { ascending: false }),
      ponudimi.from("ponude").select("*"),
      ponudimi.from("zahtevi").select("*"),
    ]);
    if (error) throw error;
    if (offersError) throw offersError;
    if (requestsError) throw requestsError;
    const offersById = new Map<string, Ponuda>((offers ?? []).map((offer: Ponuda) => [offer.id, offer] as const));
    const requestsById = new Map<string, Zahtev>((requests ?? []).map((request: Zahtev) => [request.id, request] as const));
    const followRows = (data ?? []) as Array<Pick<Pracenje, "id" | "ponuda_id" | "zahtev_id" | "pocetna_cena" | "pocetni_budzet">>;
    return followRows.map((follow) => ({
      ...follow,
      ponude: follow.ponuda_id ? offersById.get(follow.ponuda_id) ?? null : null,
      zahtevi: follow.zahtev_id ? requestsById.get(follow.zahtev_id) ?? null : null,
    })) as Pracenje[];
  },
});
/** Describes how the current price compares to the price when following started. */
export function promenaCene(pocetna: number | null, sada: number | null): "pala" | "porasla" | "ista" {
  if (pocetna === null || sada === null || pocetna === sada) return "ista";
  return sada < pocetna ? "pala" : "porasla";
}
