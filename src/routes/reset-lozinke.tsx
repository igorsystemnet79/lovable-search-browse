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
  const [prikaziLozinku, setPrikaziLozinku] = useState(false);
  const [prikaziPonovo, setPrikaziPonovo] = useState(false);
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
    if (lozinka.length < 8) return setGreska("Lozinka mora imati najmanje 8 karaktera.");
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
    <AuthShell title="Nova lozinka" subtitle="Upiši novu lozinku dva puta (najmanje 8 karaktera).">
      {spreman === "ceka" ? (
        <p className="text-sm text-muted-foreground">Proveravamo link...</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="relative">
            <input className={`${inputCls} pr-12`} type={prikaziLozinku ? "text" : "password"} autoComplete="new-password" minLength={8} required placeholder="Nova lozinka" value={lozinka} onChange={(e) => setLozinka(e.target.value)} />
            <button type="button" onClick={() => setPrikaziLozinku((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={prikaziLozinku ? "Sakrij lozinku" : "Prikaži lozinku"} aria-pressed={prikaziLozinku}>
              {prikaziLozinku ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.2 3.1M6.2 6.2C3.9 7.6 2.8 9.5 2.5 12c1 2.5 4.5 7 9.5 7 1.1 0 2.1-.2 3-.6" /></svg> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
            </button>
          </div>
          <div className="relative">
            <input className={`${inputCls} pr-12`} type={prikaziPonovo ? "text" : "password"} autoComplete="new-password" minLength={8} required placeholder="Ponovi novu lozinku" value={ponovo} onChange={(e) => setPonovo(e.target.value)} />
            <button type="button" onClick={() => setPrikaziPonovo((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={prikaziPonovo ? "Sakrij ponovljenu lozinku" : "Prikaži ponovljenu lozinku"} aria-pressed={prikaziPonovo}>
              {prikaziPonovo ? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.2 3.1M6.2 6.2C3.9 7.6 2.8 9.5 2.5 12c1 2.5 4.5 7 9.5 7 1.1 0 2.1-.2 3-.6" /></svg> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
            </button>
          </div>
          {greska && <p role="alert" className="text-sm text-destructive">{greska}</p>}
          <button className={btnCls} disabled={busy}>{busy ? "Čuvanje..." : "Zapamti"}</button>
          <Link to="/prijava" className="block w-full rounded-full border border-input px-4 py-3 text-center text-sm font-medium hover:bg-secondary">Odustani</Link>
        </form>
      )}
    </AuthShell>
  );
}
