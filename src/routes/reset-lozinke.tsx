import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { AuthShell, inputCls, btnCls } from "@/components/auth-shell";

export const Route = createFileRoute("/reset-lozinke")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [spreman, setSpreman] = useState<"ceka" | "da" | "ne">("ceka");
  const [lozinka, setLozinka] = useState("");
  const [ponovo, setPonovo] = useState("");
  const [greska, setGreska] = useState("");
  const [busy, setBusy] = useState(false);
  const [gotovo, setGotovo] = useState(false);

  useEffect(() => {
    const { data: sub } = ponudimi.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setSpreman("da");
    });
    const query = new URLSearchParams(window.location.search);
    if (query.get("token")) setSpreman("da");
    else if (query.get("error")) setSpreman("ne");
    else {
      ponudimi.auth.getSession().then(({ data }) => {
        if (data.session) setSpreman("da");
        else setSpreman("ne");
      });
    }
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGreska("");
    if (lozinka.length < 6) return setGreska("Lozinka mora imati najmanje 6 karaktera.");
    if (lozinka !== ponovo) return setGreska("Lozinke se ne poklapaju.");
    setBusy(true);
    const { error } = await ponudimi.auth.updateUser({ password: lozinka });
    setBusy(false);
    if (error) {
      if (/same|different/i.test(error.message)) return setGreska("Nova lozinka mora biti drugačija od stare.");
      if (/weak|pwned|leaked/i.test(error.message)) return setGreska("Lozinka je previše slaba. Izaberi jaču lozinku.");
      return setGreska("Link je istekao. Zatraži novi link na strani za prijavu.");
    }
    setGotovo(true);
    setTimeout(() => navigate({ to: "/" }), 1500);
  }

  if (gotovo) {
    return (
      <AuthShell title="Lozinka je promenjena" subtitle="Prijavljen si sa novom lozinkom. Vodimo te na početnu stranu...">
        <Link to="/" className={btnCls + " block text-center"}>Na početnu</Link>
      </AuthShell>
    );
  }

  if (spreman === "ne") {
    return (
      <AuthShell title="Link nije važeći" subtitle="Link za promenu lozinke je istekao ili je već iskorišćen.">
        <p className="mb-4 text-sm text-muted-foreground">
          Na strani za prijavu upiši email i klikni „Zaboravljena lozinka?" da dobiješ novi link. Otvori najnoviji link iz poruke.
        </p>
        <Link to="/prijava" className={btnCls + " block text-center"}>Nazad na prijavu</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nova lozinka" subtitle="Upiši novu lozinku dva puta (najmanje 6 karaktera).">
      {spreman === "ceka" ? (
        <p className="text-sm text-muted-foreground">Proveravamo link...</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input className={inputCls} type="password" autoComplete="new-password" minLength={6} required placeholder="Nova lozinka" value={lozinka} onChange={(e) => setLozinka(e.target.value)} />
          <input className={inputCls} type="password" autoComplete="new-password" minLength={6} required placeholder="Ponovi novu lozinku" value={ponovo} onChange={(e) => setPonovo(e.target.value)} />
          {greska && <p role="alert" className="text-sm text-destructive">{greska}</p>}
          <button className={btnCls} disabled={busy}>{busy ? "Čuvanje..." : "Sačuvaj novu lozinku"}</button>
        </form>
      )}
    </AuthShell>
  );
}
