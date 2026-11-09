import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ponudimi } from "@/integrations/standalone/client";
import { pracenjaQuery } from "@/lib/my-listings";
import type { Ponuda, Zahtev } from "@/lib/listings";

type Props =
  | { ponuda: Ponuda; zahtev?: never }
  | { zahtev: Zahtev; ponuda?: never };

export function FollowButton(props: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ ...pracenjaQuery(user?.id ?? ""), enabled: !!user });
  if (!user) return null;

  const isOffer = "ponuda" in props && !!props.ponuda;
  const listing = isOffer ? props.ponuda : props.zahtev;
  if (!listing) return null;

  const followed = q.data?.find((item) =>
    isOffer ? item.ponuda_id === listing.id : item.zahtev_id === listing.id,
  );

  async function toggle() {
    if (!user) return;
    if (followed) {
      await ponudimi.from("pracenja").delete().eq("id", followed.id);
    } else {
      await ponudimi.from("pracenja").insert({
        user_id: user.id,
        ponuda_id: isOffer ? listing.id : null,
        zahtev_id: isOffer ? null : listing.id,
        pocetna_cena: isOffer ? (listing as Ponuda).cena : null,
        pocetni_budzet: isOffer ? null : (listing as Zahtev).budzet,
      });
    }
    await qc.invalidateQueries({ queryKey: ["pracenja", user.id] });
  }

  return (
    <button type="button" onClick={toggle} className="mt-2 text-xs font-semibold text-brand hover:underline">
      {followed ? "✓ Pratiš objavu (prestani)" : "☆ Prati objavu"}
    </button>
  );
}
