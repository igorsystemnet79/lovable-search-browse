import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ponudimi } from "@/integrations/standalone/client";
import { pracenjaQuery } from "@/lib/my-listings";
import type { Ponuda, Zahtev } from "@/lib/listings";

export function FollowButton({ ponuda, zahtev }: { ponuda?: Ponuda; zahtev?: Zahtev }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ ...pracenjaQuery(user?.id ?? ""), enabled: !!user });
  if (!user) return null;

  const isOffer = !!ponuda;
  const item = ponuda ?? zahtev;
  if (!item) return null;
  const f = q.data?.find((x) => isOffer ? x.ponuda_id === item.id : x.zahtev_id === item.id);

  async function toggle() {
    if (!user || busy || q.isLoading) return;
    setBusy(true);
    try {
      if (f) {
        const { error } = await ponudimi.from("pracenja").delete().eq("id", f.id);
        if (error) throw error;
      } else {
        const values = isOffer
          ? { user_id: user.id, ponuda_id: item.id, pocetna_cena: ponuda?.cena ?? null }
          : { user_id: user.id, zahtev_id: item.id, pocetni_budzet: zahtev?.budzet ?? null };
        const { error } = await ponudimi.from("pracenja").insert(values);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["pracenja", user.id] });
    } catch (error) {
      console.error("Promena praćenja oglasa nije uspela:", error);
      alert(f ? "Praćenje nije moglo da se ukloni. Pokušaj ponovo." : "Oglas nije mogao da se doda u praćenje. Možda ga već pratiš. Osveži stranicu i pokušaj ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy || q.isLoading} aria-pressed={!!f} className="mt-2 text-xs font-semibold text-brand hover:underline disabled:cursor-wait disabled:opacity-60">
      {busy ? "Čuvanje..." : f ? (isOffer ? "✓ Pratiš ponudu (prestani)" : "✓ Pratiš zahtev (prestani)") : (isOffer ? "☆ Prati ponudu" : "☆ Prati zahtev")}
    </button>
  );
}
