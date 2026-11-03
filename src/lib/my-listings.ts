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

export type Pracenje = { id: string; ponuda_id: string; pocetna_cena: number | null; ponude: Ponuda | null };

export const pracenjaQuery = (userId: string) => ({
  queryKey: ["pracenja", userId],
  queryFn: async (): Promise<Pracenje[]> => {
    const [{ data, error }, { data: offers, error: offersError }] = await Promise.all([
      ponudimi.from("pracenja").select("id, ponuda_id, pocetna_cena").eq("user_id", userId).order("created_at", { ascending: false }),
      ponudimi.from("ponude").select("*"),
    ]);
    if (error) throw error;
    if (offersError) throw offersError;
    const byId = new Map((offers ?? []).map((offer: Ponuda) => [offer.id, offer]));
    return (data ?? []).map((follow: any) => ({ ...follow, ponude: byId.get(follow.ponuda_id) ?? null })) as Pracenje[];
  },
});

/** Describes how the current price compares to the price when following started. */
export function promenaCene(pocetna: number | null, sada: number | null): "pala" | "porasla" | "ista" {
  if (pocetna === null || sada === null || pocetna === sada) return "ista";
  return sada < pocetna ? "pala" : "porasla";
}
