import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { pracenjaQuery } from "@/lib/my-listings";
import type { Ponuda } from "@/lib/listings";

export function FollowButton({ ponuda }: { ponuda: Ponuda }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...pracenjaQuery(user?.id ?? ""), enabled: !!user });
  if (!user) return null;
  const f = q.data?.find((x) => x.ponuda_id === ponuda.id);

  async function toggle() {
    if (!user) return;
    if (f) await supabase.from("pracenja").delete().eq("id", f.id);
    else await supabase.from("pracenja").insert({ user_id: user.id, ponuda_id: ponuda.id, pocetna_cena: ponuda.cena });
    await qc.invalidateQueries({ queryKey: ["pracenja", user.id] });
  }

  return (
    <button type="button" onClick={toggle} className="mt-2 text-xs font-semibold text-brand hover:underline">
      {f ? "✓ Pratiš oglas (prestani)" : "☆ Prati oglas"}
    </button>
  );
}
