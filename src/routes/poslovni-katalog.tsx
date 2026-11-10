import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/hooks/use-auth";
import { API_ORIGIN, dodajSlikeArtikluKataloga } from "@/integrations/standalone/client";
import { inputCls } from "@/components/auth-shell";
import { ucitajPoslovniKatalog, ucitajArtikleKataloga, sacuvajArtikalKataloga, izmeniArtikalKataloga, obrisiArtikalKataloga, obrisiCeoKatalog, uveziCSVKataloga } from "@/integrations/standalone/client";

export const Route = createFileRoute("/poslovni-katalog")({
  head: () => ({ meta: [{ title: "Poslovni katalog — PonudiMi" }, { name: "robots", content: "noindex" }] }),
  component: PoslovniKatalogPage,
});


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
  const [editingId,setEditingId]=useState<string|null>(null);
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
    try{const payload={...form,cena:form.cena===""?null:Number(form.cena),kolicina:form.kolicina===""?null:Number(form.kolicina)};if(editingId){const {sifra,...changes}=payload;await izmeniArtikalKataloga(editingId,changes);setMessage("Izmene artikla su sačuvane.");setEditingId(null);}else{await sacuvajArtikalKataloga(payload);setMessage("Artikal je sačuvan.");}setForm({sifra:"",naziv:"",opis:"",kategorija:"",cena:"",valuta:"RSD",kolicina:"",proizvodjac:""});await load();}
    catch(e:any){setError(e?.message||"Artikal nije sačuvan.");}finally{setBusy(false);}
  }
  async function importCsv(){
    if(!csvFile)return;setBusy(true);setError("");setMessage("");
    try{
      let csvText="";
      if(/\.xlsx?$/i.test(csvFile.name)){
        const workbook=XLSX.read(await csvFile.arrayBuffer(),{type:"array"});
        const sheet=workbook.Sheets["Artikli"]||workbook.Sheets[workbook.SheetNames[0]];
        if(!sheet)throw new Error("Excel fajl nema radni list sa artiklima.");
        const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false}) as unknown[][];
        const escapeCell=(value:unknown)=>{const text=String(value??"");return /[;"\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
        csvText=rows.map(row=>row.map(escapeCell).join(";")).join("\n");
      }else{
        csvText=await csvFile.text();
      }
      const result=await uveziCSVKataloga(csvText);setMessage(`Uvoz završen: ${result.dodato} novih artikala, ${result.azurirano} ažuriranih.`);setCsvFile(null);await load();
    }
    catch(e:any){setError(e?.message||"Uvoz Excel/CSV fajla nije uspeo.");}finally{setBusy(false);}
  }
  async function uploadImages(id:string,files:FileList|null){
    if(!files?.length)return;setBusy(true);setError("");setMessage("");
    try{await dodajSlikeArtikluKataloga(id,Array.from(files));setMessage("Fotografije artikla su sačuvane.");await load();}
    catch(e:any){setError(e?.message||"Fotografije nisu sačuvane.");}finally{setBusy(false);}
  }
  function editItem(item:any){setEditingId(item.id);setForm({sifra:item.sifra||"",naziv:item.naziv||"",opis:item.opis||"",kategorija:item.kategorija||"",cena:item.cena==null?"":String(item.cena),valuta:item.valuta||"RSD",kolicina:item.kolicina==null?"":String(item.kolicina),proizvodjac:item.proizvodjac||""});setError("");setMessage("");window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEdit(){setEditingId(null);setForm({sifra:"",naziv:"",opis:"",kategorija:"",cena:"",valuta:"RSD",kolicina:"",proizvodjac:""});}
  async function removeItem(id:string){
    if(!window.confirm("Da li sigurno želiš da obrišeš ovaj artikal?"))return;
    setBusy(true);setError("");
    try{await obrisiArtikalKataloga(id);setMessage("Artikal je obrisan.");await load();}
    catch(e:any){setError(e?.message||"Artikal nije obrisan.");}finally{setBusy(false);}
  }
  async function clearCatalog(){
    const confirmed=window.confirm("Da li sigurno želiš da obrišeš CEO poslovni katalog? Biće obrisani svi artikli i njihove fotografije. Ova radnja ne može da se poništi.");
    if(!confirmed)return;
    setBusy(true);setError("");setMessage("");
    try{const result=await obrisiCeoKatalog();setMessage(`Katalog je obrisan. Uklonjeno artikala: ${result.obrisano||0}.`);await load();}
    catch(e:any){setError(e?.message||"Poslovni katalog nije obrisan.");}finally{setBusy(false);}
  }
  function downloadTemplate(){
    const workbook=XLSX.utils.book_new();
    const headers=["sifra","naziv","opis","kategorija","cena","valuta","kolicina","proizvodjac","jedinica_mere","aktivan"];
    const products=XLSX.utils.aoa_to_sheet([headers]);
    products["!cols"]=[{wch:16},{wch:32},{wch:48},{wch:22},{wch:14},{wch:10},{wch:14},{wch:24},{wch:16},{wch:12}];
    XLSX.utils.book_append_sheet(workbook,products,"Artikli");
    const example=XLSX.utils.aoa_to_sheet([headers,["TEST-001","Primer proizvoda","Opis proizvoda","Tehnika",1299,"RSD",25,"Proizvođač","kom","da"]]);
    example["!cols"]=products["!cols"];
    XLSX.utils.book_append_sheet(workbook,example,"Primer");
    const instructions=XLSX.utils.aoa_to_sheet([
      ["UPUTSTVO ZA POPUNJAVANJE PONUDIMI KATALOGA"],
      ["1. Unosite svoje proizvode na list Artikli, po jedan proizvod u svaki red."],
      ["2. Ne menjajte nazive kolona u prvom redu."],
      ["3. Šifra artikla i naziv su obavezni. Šifra mora biti jedinstvena u okviru kataloga firme."],
      ["4. Cena i količina mogu ostati prazni ako nisu poznati."],
      ["5. Valuta je najčešće RSD. Jedinica mere npr. kom, kg, m, l."],
      ["6. U koloni aktivan unesite da ili ne."],
      ["7. List Primer prikazuje primer unosa. Nemojte kopirati probni artikal u list Artikli."],
      ["8. Sačuvajte fajl u .xlsx formatu i direktno ga učitajte u Poslovnom katalogu."],
      ["9. Fotografije se dodaju posebno, nakon uvoza, za svaki artikal (do 7 fotografija)."],
      ["10. Ista šifra artikla ažurira postojeći artikal umesto da napravi duplikat."]
    ]);
    instructions["!cols"]=[{wch:110}];
    XLSX.utils.book_append_sheet(workbook,instructions,"Uputstvo");
    XLSX.writeFile(workbook,"ponudimi-obrazac-poslovni-katalog.xlsx");
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
        <div><h2 className="text-xl font-semibold">Masovni uvoz artikala</h2><p className="text-sm text-muted-foreground">Preuzmi Excel obrazac, popuni list Artikli i učitaj .xlsx fajl direktno. Podržan je i CSV UTF-8. Do 5.000 redova po jednom uvozu. Ista šifra artikla ažurira postojeći artikal.</p></div>
        <button type="button" onClick={downloadTemplate} className="min-h-10 rounded-full border border-input px-4 text-sm font-medium hover:bg-secondary">Preuzmi Excel obrazac (.xlsx)</button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><input id="business-catalog-import-file" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>setCsvFile(e.target.files?.[0]||null)} className="sr-only" aria-label="Izaberi Excel ili CSV fajl"/><label htmlFor="business-catalog-import-file" className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-brand/30 bg-background px-5 text-sm font-semibold shadow-sm transition-colors hover:border-brand hover:bg-brand/5 sm:w-auto">{csvFile?"Promeni fajl":"Izaberi Excel / CSV fajl"}</label>{csvFile&&<p className="mt-2 max-w-full truncate text-xs text-muted-foreground" title={csvFile.name}>Izabran fajl: {csvFile.name}</p>}</div><button type="button" disabled={!csvFile||busy} onClick={importCsv} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground disabled:opacity-50">{busy?"Obrada...":"Uvezi Excel / CSV"}</button></div>
      </section>
      <section className="rounded-2xl bg-surface p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">{editingId?"Izmeni postojeći artikal":"Dodaj pojedinačni artikal"}</h2>{editingId&&<button type="button" onClick={cancelEdit} className="rounded-full border px-4 py-2 text-sm">Odustani od izmene</button>}</div>
        <form onSubmit={addProduct} className="grid gap-3 sm:grid-cols-2">
          {(["sifra","naziv","kategorija","cena","valuta","kolicina","proizvodjac"] as const).map(key=><label key={key} className="space-y-1 text-sm"><span className="font-medium">{({sifra:"Šifra artikla",naziv:"Naziv",kategorija:"Kategorija",cena:"Cena",valuta:"Valuta",kolicina:"Količina",proizvodjac:"Proizvođač"} as any)[key]}</span><input className={inputCls+" w-full"} value={form[key]} onChange={e=>setForm(old=>({...old,[key]:e.target.value}))} required={["sifra","naziv","kategorija"].includes(key)} disabled={editingId!==null&&key==="sifra"} /></label>)}
          <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Opis</span><textarea className={inputCls+" min-h-20 w-full"} value={form.opis} onChange={e=>setForm(old=>({...old,opis:e.target.value}))}/></label>
          <button disabled={busy} className="min-h-11 rounded-full bg-highlight px-5 font-semibold text-highlight-foreground disabled:opacity-50 sm:col-span-2">{busy?"Čuvanje...":editingId?"Sačuvaj izmene":"Sačuvaj artikal"}</button>
        </form>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Artikli firme</h2><div className="flex flex-wrap gap-2"><input className={inputCls+" min-w-0"} placeholder="Pretraži katalog..." value={query} onChange={e=>setQuery(e.target.value)}/><button type="button" className="rounded-full border px-4 text-sm" onClick={()=>void load()}>Pretraži</button><button type="button" disabled={busy||!Number(summary?.ukupno)} onClick={()=>void clearCatalog()} className="min-h-10 rounded-full border border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-40">Obriši ceo katalog</button></div></div>
        {busy&&!items.length?<p className="text-sm text-muted-foreground">Učitavanje kataloga...</p>:items.length===0?<p className="rounded-xl border p-5 text-sm text-muted-foreground">Još nema artikala u katalogu.</p>:<div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-secondary"><tr>{["Šifra","Naziv","Kategorija","Cena","Količina","Status",""].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody>{items.map(item=><tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.sifra}</td><td className="p-3"><div className="font-medium">{item.naziv}</div><div className="mt-2 flex gap-1">{(item.slike||[]).map((image:any)=><img key={image.id} src={API_ORIGIN+image.storage_path} alt={item.naziv} className="h-10 w-10 rounded-md border object-cover"/>)}</div></td><td className="p-3">{item.kategorija}</td><td className="p-3">{item.cena==null?"Na upit":Number(item.cena).toLocaleString("sr-RS")+" "+item.valuta}</td><td className="p-3">{item.kolicina??"—"}</td><td className="p-3">{item.aktivan?"Aktivan":"Neaktivan"}</td><td className="p-3"><div className="flex min-w-36 flex-col gap-2"><span className="text-xs text-muted-foreground">{(item.slike||[]).length} / 7 fotografija</span><label className="flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-3 text-center text-xs font-medium transition-colors hover:border-brand hover:bg-secondary"><span>Dodaj fotografije</span><input aria-label={"Dodaj fotografije za "+item.naziv} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={e=>void uploadImages(item.id,e.target.files)}/></label><button type="button" onClick={()=>editItem(item)} className="min-h-9 rounded-lg border border-brand/40 bg-background px-3 text-left text-xs font-semibold text-brand shadow-sm transition-colors hover:border-brand hover:bg-brand/5">Izmeni artikal</button><button type="button" onClick={()=>void removeItem(item.id)} className="min-h-9 rounded-lg border border-destructive/40 bg-background px-3 text-left text-xs font-semibold text-destructive shadow-sm transition-colors hover:border-destructive hover:bg-destructive/5">Obriši artikal</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </>}</main><SiteFooter/></div>;
}
