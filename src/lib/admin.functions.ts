import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }; userId: string };

async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Nemate administratorska prava.");
}

export const obrisiKorisnika = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    if (data.userId === context.userId) throw new Error("Ne možete obrisati sopstveni nalog.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("pracenja").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("ponude").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("zahtevi").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Brisanje korisnika nije uspelo.");
    return { ok: true };
  });

const firmaSchema = z.object({
  pib: z.string().regex(/^[0-9]{9}$/),
  maticni_broj: z.string().optional().nullable(),
  naziv: z.string().min(1),
  sediste: z.string().optional().nullable(),
  adresa: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

/** Pulls the company register from the configured APR service and upserts it. */
export const sinhronizujApr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const url = process.env["APR_API_URL"];
    const key = process.env["APR_API_KEY"];
    const log = async (uspeh: boolean, broj: number, poruka: string) =>
      supabaseAdmin.from("apr_sinhronizacije").insert({ pokrenuo: context.userId, uspeh, broj_firmi: broj, poruka });
    if (!url || !key) {
      await log(false, 0, "APR pristup nije podešen.");
      return { ok: false, broj: 0, poruka: "APR pristup još nije podešen." };
    }
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
      if (!res.ok) throw new Error(`APR je vratio grešku ${res.status}`);
      const body = (await res.json()) as unknown;
      const lista = Array.isArray(body) ? body : ((body as { data?: unknown[] }).data ?? []);
      const firme = lista.map((f) => firmaSchema.safeParse(f)).filter((r) => r.success).map((r) => ({ ...r.data, synced_at: new Date().toISOString() }));
      for (let i = 0; i < firme.length; i += 500) {
        const batch = firme.slice(i, i + 500).map((f) => ({
          pib: f.pib, naziv: f.naziv, synced_at: f.synced_at,
          maticni_broj: f.maticni_broj ?? null, sediste: f.sediste ?? null, adresa: f.adresa ?? null, status: f.status ?? null,
        }));
        const { error } = await supabaseAdmin.from("apr_firme").upsert(batch);
        if (error) throw new Error(error.message);
      }
      // Re-verify company accounts against the fresh register.
      const { data: pravna } = await supabaseAdmin.from("profiles").select("id, pib").eq("tip_lica", "pravno");
      const pibovi = new Set(firme.map((f) => f.pib));
      for (const p of pravna ?? []) {
        if (p.pib && pibovi.has(p.pib)) await supabaseAdmin.from("profiles").update({ firma_verifikovana: true }).eq("id", p.id);
      }
      await log(true, firme.length, "Uspešno");
      return { ok: true, broj: firme.length, poruka: `Sinhronizovano ${firme.length} firmi.` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nepoznata greška";
      await log(false, 0, msg);
      return { ok: false, broj: 0, poruka: "Sinhronizacija nije uspela: " + msg };
    }
  });
