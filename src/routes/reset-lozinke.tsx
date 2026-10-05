import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, inputCls, btnCls } from "@/components/auth-shell";

export const Route = createFileRoute("/reset-lozinke")({
  head: () => ({
    meta: [
      { title: "Nova lozinka — PonudiMi" },
      { name: "description", content: "Postavi novu lozinku za PonudiMi nalog." },
      { property: "og:title", content: "Nova lozinka — PonudiMi" },
      { property: "og:description", content: "Postavi novu lozinku za PonudiMi nalog." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [lozinka, setLozinka] = useState("");
  const [greska, setGreska] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: lozinka });
    if (error) return setGreska("Link je istekao ili lozinka nije dovoljno jaka.");
    navigate({ to: "/" });
  }

  return (
    <AuthShell title="Nova lozinka" subtitle="Upiši novu lozinku (najmanje 6 karaktera).">
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={inputCls} type="password" minLength={6} required placeholder="Nova lozinka" value={lozinka} onChange={(e) => setLozinka(e.target.value)} />
        {greska && <p className="text-sm text-destructive">{greska}</p>}
        <button className={btnCls}>Sačuvaj lozinku</button>
      </form>
    </AuthShell>
  );
}
