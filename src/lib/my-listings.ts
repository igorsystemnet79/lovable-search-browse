import { supabase } from "@/integrations/supabase/client";
import type { Ponuda, Zahtev } from "@/lib/listings";

export const mojiOglasiQuery = (userId: string) => ({
  queryKey: ["moji-oglasi", userId],
  queryFn: async () => {
    const [p, z] = await Promise.all([
      supabase.from("ponude").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("zahtevi").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
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
    const { data, error } = await supabase
      .from("pracenja")
      .select("id, ponuda_id, pocetna_cena, ponude(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Pracenje[];
  },
});

/** Describes how the current price compares to the price when following started. */
export function promenaCene(pocetna: number | null, sada: number | null): "pala" | "porasla" | "ista" {
  if (pocetna === null || sada === null || pocetna === sada) return "ista";
  return sada < pocetna ? "pala" : "porasla";
}
