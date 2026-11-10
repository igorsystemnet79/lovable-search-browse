import { randomUUID } from 'node:crypto';
// PonudiMi poslovni katalog — odvojen od klasičnih oglasa.
const schema = `
ALTER TABLE business_package_catalog
  ADD COLUMN IF NOT EXISTS max_artikala integer NOT NULL DEFAULT 1000;
UPDATE business_package_catalog SET max_artikala=CASE slug
  WHEN 'light' THEN 100 WHEN 'average' THEN 1000
  WHEN 'advanced' THEN 10000 WHEN 'total' THEN 50000
  ELSE max_artikala END;
CREATE TABLE IF NOT EXISTS business_catalog_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 sifra text NOT NULL,
 naziv text NOT NULL,
 opis text,
 kategorija text NOT NULL,
 cena numeric(14,2),
 valuta text NOT NULL DEFAULT 'RSD',
 kolicina numeric(14,3),
 proizvodjac text,
 jedinica_mere text,
 aktivan boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,sifra)
);
CREATE INDEX IF NOT EXISTS business_catalog_products_search_idx
 ON business_catalog_products USING gin
 (to_tsvector('simple', coalesce(naziv,'') || ' ' || coalesce(opis,'') || ' ' || coalesce(sifra,'') || ' ' || coalesce(kategorija,'')));
CREATE INDEX IF NOT EXISTS business_catalog_products_category_idx
 ON business_catalog_products(kategorija, aktivan, updated_at DESC);
CREATE TABLE IF NOT EXISTS business_catalog_product_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES business_catalog_products(id) ON DELETE CASCADE,
 storage_path text NOT NULL,
 pozicija integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_catalog_product_images_product_idx
 ON business_catalog_product_images(product_id,pozicija);
`;

function csvRows(input) {
 const rows=[]; let row=[], field='', quoted=false;
 const text=String(input||'').replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const ch=text[i], next=text[i+1];
  if(quoted){if(ch==='"'&&next==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===','){row.push(field);field='';}
  else if(ch==='\n'){row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}
  else if(ch!=='\r')field+=ch;
 }
 row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 if(quoted)throw new Error('CSV sadrži nezatvoren navodnik.');
 return rows;
}
const clean = (v,max=2000)=>String(v??'').trim().slice(0,max);
const numeric = (v)=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:NaN;};

export async function registerBusinessCatalog({app,pool,auth,asyncRoute,memoryUpload,normalizeImage,saveImage,removeImage}) {
 await pool.query(schema);
 const firm = async userId => {
  const r=await pool.query(`SELECT p.id,p.tip_lica,p.firma_verifikovana,p.naziv_firme,
   k.paket,k.vazi_do,k.status,bc.max_artikala
   FROM profiles p
   LEFT JOIN LATERAL (SELECT paket,vazi_do,status FROM paketi_firmi
    WHERE user_id=p.id AND status='aktivan' AND vazi_do >= (now() AT TIME ZONE 'Europe/Belgrade')::date
    ORDER BY vazi_do DESC LIMIT 1) k ON true
   LEFT JOIN business_package_catalog bc ON bc.slug=k.paket
   WHERE p.id=$1`,[userId]);
  const f=r.rows[0];
  if(!f||f.tip_lica!=='pravno')return {error:'Poslovni katalog je dostupan samo nalozima pravnih lica.',status:403};
  if(!f.firma_verifikovana)return {error:'Firma mora biti verifikovana u APR evidenciji pre aktiviranja kataloga.',status:403};
  if(!f.paket)return {error:'Za korišćenje poslovnog kataloga potreban je aktivan paket firme.',status:403};
  return {firm:f,limit:Number(f.max_artikala||1000)};
 };
 const wrapped=(handler)=>asyncRoute(async(req,res)=>{const access=await firm(req.user.sub);if(access.error)return res.status(access.status).json({error:access.error});return handler(req,res,access);});
 app.get('/api/business/catalog/summary',auth,wrapped(async(req,res,{firm:f,limit})=>{
  const r=await pool.query(`SELECT count(*)::int ukupno,count(*) FILTER(WHERE aktivan)::int aktivni
   FROM business_catalog_products WHERE user_id=$1`,[req.user.sub]);
  res.json({data:{firma:f.naziv_firme,paket:f.paket,limit,ukupno:r.rows[0].ukupno,aktivni:r.rows[0].aktivni,preostalo:Math.max(0,limit-r.rows[0].ukupno)}});
 }));
 app.get('/api/business/catalog/products',auth,wrapped(async(req,res)=>{
  const q=clean(req.query.q,100),cat=clean(req.query.kategorija,100);
  const limit=Math.min(200,Math.max(1,Number(req.query.limit)||50)),offset=Math.max(0,Number(req.query.offset)||0);
  const r=await pool.query(`SELECT p.*,COALESCE((SELECT json_agg(i ORDER BY i.pozicija) FROM
   (SELECT id,storage_path,pozicija FROM business_catalog_product_images WHERE product_id=p.id) i),'[]') slike
   FROM business_catalog_products p WHERE p.user_id=$1
   AND ($2='' OR unaccent(lower(concat_ws(' ',p.sifra,p.naziv,p.opis,p.kategorija))) LIKE '%'||unaccent(lower($2))||'%')
   AND ($3='' OR lower(p.kategorija)=lower($3))
   ORDER BY p.updated_at DESC LIMIT $4 OFFSET $5`,[req.user.sub,q,cat,limit,offset]);
  res.json({data:r.rows});
 }));
 app.post('/api/business/catalog/products',auth,wrapped(async(req,res,{limit})=>{
  const b=req.body||{},sku=clean(b.sifra,100),name=clean(b.naziv,200),category=clean(b.kategorija,120);
  if(!sku||!name||!category)return res.status(400).json({error:'Šifra artikla, naziv i kategorija su obavezni.'});
  const price=numeric(b.cena),stock=numeric(b.kolicina);
  if(Number.isNaN(price)||Number.isNaN(stock))return res.status(400).json({error:'Cena i količina moraju biti nenegativni brojevi.'});
  const count=await pool.query('SELECT count(*)::int n FROM business_catalog_products WHERE user_id=$1',[req.user.sub]);
  const exists=await pool.query('SELECT id FROM business_catalog_products WHERE user_id=$1 AND sifra=$2',[req.user.sub,sku]);
  if(!exists.rowCount&&count.rows[0].n>=limit)return res.status(409).json({error:`Dostigli ste kapacitet paketa od ${limit.toLocaleString('sr-RS')} artikala.`});
  const r=await pool.query(`INSERT INTO business_catalog_products(user_id,sifra,naziv,opis,kategorija,cena,valuta,kolicina,proizvodjac,jedinica_mere,aktivan)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
   ON CONFLICT(user_id,sifra) DO UPDATE SET naziv=EXCLUDED.naziv,opis=EXCLUDED.opis,kategorija=EXCLUDED.kategorija,
   cena=EXCLUDED.cena,valuta=EXCLUDED.valuta,kolicina=EXCLUDED.kolicina,proizvodjac=EXCLUDED.proizvodjac,
   jedinica_mere=EXCLUDED.jedinica_mere,aktivan=EXCLUDED.aktivan,updated_at=now() RETURNING *`,
   [req.user.sub,sku,name,clean(b.opis),category,price,clean(b.valuta,3)||'RSD',stock,clean(b.proizvodjac,160)||null,clean(b.jedinica_mere,30)||null,b.aktivan!==false]);
  res.status(exists.rowCount?200:201).json({data:r.rows[0]});
 }));
 app.patch('/api/business/catalog/products/:id',auth,wrapped(async(req,res)=>{
  const fields={naziv:'naziv',opis:'opis',kategorija:'kategorija',cena:'cena',valuta:'valuta',kolicina:'kolicina',proizvodjac:'proizvodjac',jedinica_mere:'jedinica_mere',aktivan:'aktivan'};
  const keys=Object.keys(req.body||{}).filter(k=>fields[k]);
  if(!keys.length)return res.status(400).json({error:'Nema podataka za izmenu.'});
  const values=keys.map(k=>k==='aktivan'?Boolean(req.body[k]):['cena','kolicina'].includes(k)?numeric(req.body[k]):clean(req.body[k],k==='opis'?2000:200));
  if(values.some(v=>Number.isNaN(v)))return res.status(400).json({error:'Cena i količina moraju biti nenegativni brojevi.'});
  const sets=keys.map((k,i)=>`${fields[k]}=$${i+1}`).join(',');
  const r=await pool.query(`UPDATE business_catalog_products SET ${sets},updated_at=now() WHERE id=$${keys.length+1} AND user_id=$${keys.length+2} RETURNING *`,[...values,req.params.id,req.user.sub]);
  if(!r.rowCount)return res.status(404).json({error:'Artikal nije pronađen.'});
  res.json({data:r.rows[0]});
 }));
 app.delete('/api/business/catalog/products/:id',auth,wrapped(async(req,res)=>{
  const r=await pool.query('DELETE FROM business_catalog_products WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.sub]);
  if(!r.rowCount)return res.status(404).json({error:'Artikal nije pronađen.'});
  res.json({ok:true});
 }));
 app.post('/api/business/catalog/products/:id/images',auth,memoryUpload.array('fotografije',7),wrapped(async(req,res)=>{
  const files=req.files||[];
  if(!files.length)return res.status(400).json({error:'Izaberi najmanje jednu fotografiju.'});
  const product=await pool.query('SELECT id FROM business_catalog_products WHERE id=$1 AND user_id=$2',[req.params.id,req.user.sub]);
  if(!product.rowCount)return res.status(404).json({error:'Artikal nije pronađen.'});
  const count=await pool.query('SELECT count(*)::int n FROM business_catalog_product_images WHERE product_id=$1',[req.params.id]);
  if(count.rows[0].n+files.length>7)return res.status(400).json({error:'Za jedan artikal možeš dodati najviše 7 fotografija.'});
  const saved=[];
  try{
   for(const [i,file] of files.entries()){
    const key=`${req.user.sub}/catalog/${req.params.id}/${randomUUID()}.jpg`;
    const normalized=await normalizeImage(file.buffer);await saveImage(key,normalized,'image/jpeg');saved.push(key);
    await pool.query('INSERT INTO business_catalog_product_images(product_id,storage_path,pozicija) VALUES($1,$2,$3)',[req.params.id,`/uploads/${key}`,count.rows[0].n+i]);
   }
   const r=await pool.query('SELECT id,storage_path,pozicija FROM business_catalog_product_images WHERE product_id=$1 ORDER BY pozicija',[req.params.id]);
   res.status(201).json({data:r.rows});
  }catch(error){for(const key of saved){try{await removeImage(key);}catch{}}throw error;}
 }));
 app.delete('/api/business/catalog/images/:imageId',auth,wrapped(async(req,res)=>{
  const found=await pool.query(`SELECT i.id,i.storage_path FROM business_catalog_product_images i JOIN business_catalog_products p ON p.id=i.product_id WHERE i.id=$1 AND p.user_id=$2`,[req.params.imageId,req.user.sub]);
  if(!found.rowCount)return res.status(404).json({error:'Fotografija nije pronađena.'});
  await pool.query('DELETE FROM business_catalog_product_images WHERE id=$1',[req.params.imageId]);
  const key=String(found.rows[0].storage_path).replace(/^\\/uploads\\//,'');
  try{await removeImage(key);}catch(error){console.error('Fotografija kataloga nije očišćena iz skladišta:',error);}
  res.json({ok:true});
 }));
 app.post('/api/business/catalog/import-csv',auth,wrapped(async(req,res,{limit})=>{
  const rows=csvRows(req.body?.csv);
  if(rows.length<2)return res.status(400).json({error:'CSV mora sadržati zaglavlje i najmanje jedan artikal.'});
  if(rows.length>5001)return res.status(413).json({error:'Jedan uvoz može sadržati najviše 5.000 redova artikala.'});
  const headers=rows[0].map(x=>x.trim().toLowerCase());
  const required=['sifra','naziv','kategorija'];
  if(required.some(x=>!headers.includes(x)))return res.status(400).json({error:'Nedostaju obavezne kolone: sifra, naziv, kategorija.'});
  const index=key=>headers.indexOf(key),seen=new Set(),items=[];
  for(let i=1;i<rows.length;i++){
   const row=rows[i],get=key=>index(key)<0?'':row[index(key)]||'';
   const sku=clean(get('sifra'),100),name=clean(get('naziv'),200),category=clean(get('kategorija'),120);
   if(!sku||!name||!category)return res.status(400).json({error:`Red ${i+1}: šifra, naziv i kategorija su obavezni.`});
   if(seen.has(sku))return res.status(400).json({error:`Red ${i+1}: šifra ${sku} je duplirana u fajlu.`});seen.add(sku);
   const price=numeric(get('cena')),stock=numeric(get('kolicina'));
   if(Number.isNaN(price)||Number.isNaN(stock))return res.status(400).json({error:`Red ${i+1}: cena ili količina nisu ispravne.`});
   items.push({sku,name,category,opis:clean(get('opis')),price,stock,valuta:clean(get('valuta'),3)||'RSD',proizvodjac:clean(get('proizvodjac'),160),jedinica:clean(get('jedinica_mere'),30),aktivan:!['ne','false','0'].includes(clean(get('aktivan'),10).toLowerCase())});
  }
  const current=await pool.query('SELECT count(*)::int n FROM business_catalog_products WHERE user_id=$1',[req.user.sub]);
  const existing=await pool.query('SELECT sifra FROM business_catalog_products WHERE user_id=$1 AND sifra=ANY($2::text[])',[req.user.sub,items.map(x=>x.sku)]);
  const newCount=items.filter(x=>!existing.rows.some(y=>y.sifra===x.sku)).length;
  if(current.rows[0].n+newCount>limit)return res.status(409).json({error:`Uvoz bi premašio kapacitet paketa. Trenutno ${current.rows[0].n}, novih ${newCount}, dozvoljeno ${limit}.`});
  const c=await pool.connect();let inserted=0,updated=0;
  try{await c.query('BEGIN');
   for(const x of items){const r=await c.query(`INSERT INTO business_catalog_products(user_id,sifra,naziv,opis,kategorija,cena,valuta,kolicina,proizvodjac,jedinica_mere,aktivan)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(user_id,sifra) DO UPDATE SET naziv=EXCLUDED.naziv,opis=EXCLUDED.opis,kategorija=EXCLUDED.kategorija,cena=EXCLUDED.cena,valuta=EXCLUDED.valuta,kolicina=EXCLUDED.kolicina,proizvodjac=EXCLUDED.proizvodjac,jedinica_mere=EXCLUDED.jedinica_mere,aktivan=EXCLUDED.aktivan,updated_at=now() RETURNING (xmax=0) AS is_new`,
    [req.user.sub,x.sku,x.name,x.opis,x.category,x.price,x.valuta,x.stock,x.proizvodjac||null,x.jedinica||null,x.aktivan]);
    if(r.rows[0].is_new)inserted++;else updated++;
   }await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  res.json({ok:true,ukupno:items.length,dodato:inserted,azurirano:updated});
 }));
 app.get('/api/catalog/search',auth,asyncRoute(async(req,res)=>{
  const q=clean(req.query.q,120),category=clean(req.query.kategorija,120),place=clean(req.query.mesto,100),currency=clean(req.query.valuta,3);
  const minValue=numeric(req.query.minCena),maxValue=numeric(req.query.maxCena);\n  const min=minValue===null?'':minValue,max=maxValue===null?'':maxValue;
  if(Number.isNaN(min)||Number.isNaN(max))return res.status(400).json({error:'Raspon cene nije ispravan.'});
  if(q.length<2&&!category&&!place)return res.json({data:[]});
  const sort=['najstarije','cena_rastuce','cena_opadajuce'].includes(req.query.sort)?req.query.sort:'najnovije';
  const order=sort==='najstarije'?'p.created_at ASC':sort==='cena_rastuce'?'p.cena ASC NULLS LAST,p.updated_at DESC':sort==='cena_opadajuce'?'p.cena DESC NULLS LAST,p.updated_at DESC':'p.updated_at DESC';
  const r=await pool.query(`SELECT p.id,p.sifra,p.naziv,p.opis,p.kategorija,p.cena,p.valuta,p.kolicina,p.proizvodjac,
   pr.naziv_firme,pr.grad,COALESCE((SELECT json_agg(i ORDER BY i.pozicija) FROM
   (SELECT storage_path,pozicija FROM business_catalog_product_images WHERE product_id=p.id) i),'[]') slike
   FROM business_catalog_products p JOIN profiles pr ON pr.id=p.user_id
   JOIN paketi_firmi k ON k.user_id=p.user_id AND k.status='aktivan' AND k.vazi_do >= (now() AT TIME ZONE 'Europe/Belgrade')::date
   WHERE p.aktivan AND pr.firma_verifikovana AND ($1='' OR unaccent(lower(concat_ws(' ',p.sifra,p.naziv,p.opis,p.kategorija,pr.naziv_firme))) LIKE '%'||unaccent(lower($1))||'%')
   AND ($2='' OR lower(p.kategorija)=lower($2)) AND ($3='' OR lower(coalesce(pr.grad,'')) LIKE '%'||lower($3)||'%')
   AND ($4='' OR p.cena >= $4) AND ($5='' OR p.cena <= $5) AND ($6='' OR p.valuta=$6)
   ORDER BY ${order} LIMIT 100`,[q,category,place,min,max,currency]);
  res.json({data:r.rows});
 }));
 app.get('/api/business/catalog/template.csv',auth,wrapped(async(_req,res)=>{
  res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="ponudimi-katalog-obrazac.csv"')
   .send('sifra,naziv,opis,kategorija,cena,valuta,kolicina,proizvodjac,jedinica_mere,aktivan\nART-001,Primer proizvoda,Opis proizvoda,Tehnika,1299,RSD,25,Proizvođač,kom,da\n');
 }));
}
