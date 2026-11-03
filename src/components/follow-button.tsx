import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ponudimi } from "@/integrations/standalone/client";
import { pracenjaQuery } from "@/lib/my-listings";
import type { Ponuda, Zahtev } from "@/lib/listings";

export function FollowButton({ ponuda, zahtev }: { ponuda?: Ponuda; zahtev?: Zahtev }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...pracenjaQuery(user?.id ?? ""), enabled: !!user });
  if (!user) return null;

  const isOffer = !!ponuda;
  const item = ponuda ?? zahtev;
  if (!item) return null;
  const f = q.data?.find((x) => isOffer ? x.ponuda_id === item.id : x.zahtev_id === item.id);

  async function toggle() {
    if (!user) return;
    if (f) {
      const { error } = await ponudimi.from("pracenja").delete().eq("id", f.id);
      if (error) { alert("Praćenje nije moglo da se ukloni. Pokušaj ponovo."); return; }
    } else {
      const values = isOffer
        ? { user_id: user.id, ponuda_id: item.id, pocetna_cena: ponuda?.cena ?? null }
        : { user_id: user.id, zahtev_id: item.id, pocetni_budzet: zahtev?.budzet ?? null };
      const { error } = await ponudimi.from("pracenja").insert(values);
      if (error) { alert("Oglas nije mogao da se doda u praćenje. Pokušaj ponovo."); return; }
    }
    await qc.invalidateQueries({ queryKey: ["pracenja", user.id] });
  }

  return (
    <button type="button" onClick={toggle} className="mt-2 text-xs font-semibold text-brand hover:underline">
      {f ? (isOffer ? "✓ Pratiš ponudu (prestani)" : "✓ Pratiš zahtev (prestani)") : (isOffer ? "☆ Prati ponudu" : "☆ Prati zahtev")}
    </button>
  );
}
