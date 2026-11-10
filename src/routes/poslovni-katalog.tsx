import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/hooks/use-auth";
import { API_ORIGIN, dodajSlikeArtikluKataloga } from "@/integrations/standalone/client";
import { inputCls } from "@/components/auth-shell";
import { ucitajPoslovniKatalog, ucitajArtikleKataloga, sacuvajArtikalKataloga, obrisiArtikalKataloga, uveziCSVKataloga } from "@/integrations/standalone/client";

export const Route = createFileRoute("/poslovni-katalog")({
  head: () => ({ meta: [{ title: "Poslovni katalog — PonudiMi" }, { name: "robots", content: "noindex" }] }),
  component: PoslovniKatalogPage,
});

const template = "sifra,naziv,opis,kategorija,cena,valuta,kolicina,proizvodjac,jedinica_mere,aktivan\nART-001,Primer proizvoda,Opis proizvoda,Tehnika,1299,RSD,25,Proizvođač,kom,da\n";

function PoslovniKatalogPage() {
  const { user } = useAuth();
  const [summary,setSummary]=useState<any>(null);
  const [items,setItems]=useState<any[]>([]);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [csvFile,setCsvFile]=useState<File|null>(null);
  const [form,setForm]=useState({sifra:"",naziv:"",opis:"",kategorija:"",cena:"",valuta:"RSD",kolicina:"",proizvodjac:""});
  const load=useCallback(async()=>{
    if(!user)return;
    setBusy(true);setError("");
    try{
      const [s,p]=await Promise.all([ucitajPoslovniKatalog(),ucitajArtikleKataloga(query,100,0)]);
      setSummary(s.data);setItems(p.data||[]);
    }catch(e:any){setError(e?.message||"Poslovni katalog trenutno nije dostupan.");}
    finally{setBusy(false);}
  },[user,query]);
  useEffect(()=>{void load();},[load]);
  async function addProduct(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try{await sacuvajArtikalKataloga({...form,cena:form.cena===""?null:Number(form.cena),kolicina:form.kolicina===""?null:Number(form.kolicina)});setForm({sifra:"",naziv:"",opis:"",kategorija:"",cena:"",valuta:"RSD",kolicina:"",proizvodjac:""});setMessage("Artikal je sačuvan.");await load();}
    catch(e:any){setError(e?.message||"Artikal nije sačuvan.");}finally{setBusy(false);}
  }
  async function importCsv(){
    if(!csvFile)return;setBusy(true);setError("");setMessage("");
    try{const result=await uveziCSVKataloga(await csvFile.text());setMessage(`Uvoz završen: ${result.dodato} novih artikala, ${result.azurirano} ažuriranih.`);setCsvFile(null);await load();}
    catch(e:any){setError(e?.message||"Uvoz CSV fajla nije uspeo.");}finally{setBusy(false);}
  }
  async function uploadImages(id:string,files:FileList|null){
    if(!files?.length)return;setBusy(true);setError("");setMessage("");
    try{await dodajSlikeArtikluKataloga(id,Array.from(files));setMessage("Fotografije artikla su sačuvane.");await load();}
    catch(e:any){setError(e?.message||"Fotografije nisu sačuvane.");}finally{setBusy(false);}
  }
  async function removeItem(id:string){
    if(!window.confirm("Da li sigurno želiš da obrišeš ovaj artikal?"))return;
    setBusy(true);setError("");
    try{await obrisiArtikalKataloga(id);setMessage("Artikal je obrisan.");await load();}
    catch(e:any){setError(e?.message||"Artikal nije obrisan.");}finally{setBusy(false);}
  }
  function downloadTemplate(){
    const blob=new Blob(["\uFEFF"+template],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="ponudimi-katalog-obrazac.csv";a.click();URL.revokeObjectURL(url);
  }
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader/><main className="container-page py-8 space-y-6">
    <div><Link to="/" className="text-sm text-brand hover:underline">← Početna</Link><h1 className="mt-3 text-3xl font-bold">Poslovni katalog</h1><p className="mt-2 text-sm text-muted-foreground">Upravljaj artiklima svoje firme. Katalog je odvojen od klasičnih oglasa i svaki artikal ima svoju šifru.</p></div>
    {!user?<div className="rounded-xl border p-5">Za pristup katalogu potrebno je da se <Link to="/prijava" className="text-brand underline">prijaviš</Link>.</div>:<>
      {error&&<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {message&&<p role="status" className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-sm">{message}</p>}
      {summary&&<div className="grid gap-3 sm:grid-cols-4">
        {[["Firma",summary.firma],["Paket",summary.paket],["Artikli",Number(summary.ukupno).toLocaleString("sr-RS")+" / "+Number(summary.limit).toLocaleString("sr-RS")],["Preostalo",Number(summary.preostalo).toLocaleString("sr-RS")]].map(([label,value])=><div key={label} className="rounded-2xl bg-surface p-4 shadow-card"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}
      </div>}
      <section className="rounded-2xl bg-surface p-5 shadow-card space-y-4">
        <div><h2 className="text-xl font-semibold">Masovni uvoz artikala</h2><p className="text-sm text-muted-foreground">Popuni CSV obrazac u Excel-u ili drugom programu i sačuvaj ga kao CSV UTF-8. Do 5.000 redova po jednom uvozu. Ista šifra artikla ažurira postojeći artikal.</p></div>
        <button type="button" onClick={downloadTemplate} className="min-h-10 rounded-full border border-input px-4 text-sm font-medium hover:bg-secondary">Preuzmi CSV / Excel obrazac</button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><input type="file" accept=".csv,text/csv" onChange={e=>setCsvFile(e.target.files?.[0]||null)} className="min-w-0 text-sm"/><button type="button" disabled={!csvFile||busy} onClick={importCsv} className="min-h-10 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground disabled:opacity-50">{busy?"Obrada...":"Uvezi artikle"}</button></div>
      </section>
      <section className="rounded-2xl bg-surface p-5 shadow-card space-y-4">
        <h2 className="text-xl font-semibold">Dodaj pojedinačni artikal</h2>
        <form onSubmit={addProduct} className="grid gap-3 sm:grid-cols-2">
          {(["sifra","naziv","kategorija","cena","valuta","kolicina","proizvodjac"] as const).map(key=><label key={key} className="space-y-1 text-sm"><span className="font-medium">{({sifra:"Šifra artikla",naziv:"Naziv",kategorija:"Kategorija",cena:"Cena",valuta:"Valuta",kolicina:"Količina",proizvodjac:"Proizvođač"} as any)[key]}</span><input className={inputCls+" w-full"} value={form[key]} onChange={e=>setForm(old=>({...old,[key]:e.target.value}))} required={["sifra","naziv","kategorija"].includes(key)} /></label>)}
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Opis</span><textarea className={inputCls+" min-h-20 w-full"} value={form.opis} onChange={e=>setForm(old=>({...old,opis:e.target.value}))}/></label>
          <button disabled={busy} className="min-h-11 rounded-full bg-highlight px-5 font-semibold text-highlight-foreground disabled:opacity-50 sm:col-span-2">{busy?"Čuvanje...":"Sačuvaj artikal"}</button>
        </form>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Artikli firme</h2><div className="flex gap-2"><input className={inputCls+" min-w-0"} placeholder="Pretraži katalog..." value={query} onChange={e=>setQuery(e.target.value)}/><button type="button" className="rounded-full border px-4 text-sm" onClick={()=>void load()}>Pretraži</button></div></div>
        {busy&&!items.length?<p className="text-sm text-muted-foreground">Učitavanje kataloga...</p>:items.length===0?<p className="rounded-xl border p-5 text-sm text-muted-foreground">Još nema artikala u katalogu.</p>:<div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-secondary"><tr>{["Šifra","Naziv","Kategorija","Cena","Količina","Status",""].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody>{items.map(item=><tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.sifra}</td><td className="p-3">{item.naziv}</td><td className="p-3">{item.kategorija}</td><td className="p-3">{item.cena==null?"Na upit":Number(item.cena).toLocaleString("sr-RS")+" "+item.valuta}</td><td className="p-3">{item.kolicina??"—"}</td><td className="p-3">{item.aktivan?"Aktivan":"Neaktivan"}</td><td className="p-3"><div className="flex flex-col gap-2"><span className="text-xs text-muted-foreground">{(item.slike||[]).length} / 7 fotografija</span><input aria-label={"Dodaj fotografije za "+item.naziv} type="file" accept="image/jpeg,image/png,image/webp" multiple className="max-w-40 text-xs" onChange={e=>void uploadImages(item.id,e.target.files)}/><button type="button" onClick={()=>void removeItem(item.id)} className="text-left text-destructive hover:underline">Obriši artikal</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </>}</main><SiteFooter/></div>;
}
