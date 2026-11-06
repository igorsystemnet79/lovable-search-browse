import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ponudimi } from "@/integrations/standalone/client";
import { AuthShell, inputCls, btnCls } from "@/components/auth-shell";

export const Route = createFileRoute("/potvrda-email")({
  head: () => ({ meta: [{ title: "Potvrda naloga — PonudiMi" }, { name: "robots", content: "noindex" }] }),
  component: PotvrdaEmail,
});

function PotvrdaEmail() {
  const navigate = useNavigate();
  const [verificationToken, setVerificationToken] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("Proveravamo e-mail adresu...");

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) { setError("Nedostaje link za potvrdu. Otvori link iz e-mail poruke."); setBusy(false); return; }
    ponudimi.verification.confirmEmail(token)
      .then(async (result: any) => {
        if (!active) return;
        setVerificationToken(result.verification_token);
        setInfo("E-mail je potvrđen. Šaljemo SMS kod na broj koji si uneo prilikom registracije...");
        await ponudimi.verification.startPhone(result.verification_token);
        if (active) setInfo("SMS kod je poslat. Unesi ga ispod da završiš verifikaciju.");
      })
      .catch((e: any) => { if (active) setError(e?.message || "Potvrda e-maila nije uspela."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function resend() {
    if (!verificationToken || sending) return;
    setSending(true); setError(""); setInfo("");
    try { await ponudimi.verification.startPhone(verificationToken); setInfo("Novi SMS kod je poslat."); }
    catch (e: any) { setError(e?.message || "Slanje SMS koda nije uspelo."); }
    finally { setSending(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationToken || busy) return;
    setBusy(true); setError("");
    try {
      const result = await ponudimi.verification.checkPhone(verificationToken, code);
      if (result.session) await ponudimi.auth.setSession(result.session);
      setDone(true);
      setInfo("Uspešno! E-mail i broj telefona su potvrđeni. Tvoj nalog sada ima status Verifikovan korisnik.");
    } catch (e: any) { setError(e?.message || "SMS verifikacija nije uspela."); }
    finally { setBusy(false); }
  }

  return (
    <AuthShell title={done ? "Nalog je verifikovan" : "Potvrda naloga"} subtitle="Zaštitimo tvoj PonudiMi nalog.">
      {busy && !verificationToken && <p className="text-sm text-muted-foreground">{info}</p>}
      {info && <p role="status" className="text-sm text-brand">{info}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!done && verificationToken && (
        <form onSubmit={verify} className="mt-4 space-y-3">
          <label className="block text-sm font-medium" htmlFor="sms-code">SMS verifikacioni kod</label>
          <input id="sms-code" className={inputCls} required inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="Unesi kod iz SMS poruke" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className={btnCls} disabled={busy || code.length < 4}>{busy ? "Proveravamo..." : "Potvrdi broj telefona"}</button>
          <button type="button" className="w-full rounded-full border border-input px-4 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50" disabled={sending} onClick={resend}>{sending ? "Šaljem..." : "Pošalji novi SMS kod"}</button>
        </form>
      )}
      {done && <Link to="/prijava" className={btnCls + " mt-4"}>Nastavi na PonudiMi</Link>}
      {!verificationToken && !busy && !done && <Link to="/registracija" className="mt-4 block text-sm font-semibold text-brand hover:underline">Vrati se na registraciju</Link>}
    </AuthShell>
  );
}
