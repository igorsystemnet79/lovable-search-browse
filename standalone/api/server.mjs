import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import path from 'node:path';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET mora imati najmanje 32 karaktera.');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));
app.use('/api/db/query', rateLimit({ windowMs: 60 * 1000, limit: 180 }));
app.use('/api/storage', rateLimit({ windowMs: 60 * 1000, limit: 60 }));
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', immutable: true }));
const storage = multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`) });
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 7 }, fileFilter: (_req, f, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(f.mimetype)) });
async function normalizeImage(buffer) {
 const output = await sharp(buffer, { limitInputPixels: 100000000 }).rotate().resize(800, 600, { fit: 'contain', background: '#ffffff', withoutEnlargement: false }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
 return output;
}
const s3Enabled = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
const s3 = s3Enabled ? new S3Client({ region: process.env.S3_REGION || 'auto', endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } }) : null;
const imageMime = new Set(['image/jpeg','image/png','image/webp']);
const safeObjectKey = value => String(value || '').replace(/^\/+/, '').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
async function saveImage(key, buffer, contentType) {
 if (!imageMime.has(contentType)) throw new Error('Dozvoljeni su JPG, PNG i WebP formati.');
 if (s3) await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: buffer, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
 else { await pool.query('INSERT INTO storage_objects(object_key,content_type,body) VALUES($1,$2,$3) ON CONFLICT(object_key) DO UPDATE SET content_type=EXCLUDED.content_type,body=EXCLUDED.body,created_at=now()',[key,contentType,buffer]); }
}
async function removeImage(key) {
 if (s3) await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
 else { await pool.query('DELETE FROM storage_objects WHERE object_key=$1',[key]); const target=path.resolve(uploadDir,key); if(target.startsWith(path.resolve(uploadDir)+path.sep) && fs.existsSync(target)) fs.unlinkSync(target); }
}
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const rejectBlockedUser = async userId => { const result = await pool.query('SELECT blokiran FROM profiles WHERE id=$1', [userId]); return Boolean(result.rows[0]?.blokiran); };
const auth = asyncRoute(async (req,res,next) => { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,''); if (!token) return res.status(401).json({ error:'Prijava je obavezna.' }); try { req.user = jwt.verify(token, JWT_SECRET); if (await rejectBlockedUser(req.user.sub)) return res.status(403).json({ error:'Nalog je privremeno blokiran.' }); next(); } catch { res.status(401).json({ error:'Sesija je istekla.' }); } });
const optionalAuth = asyncRoute(async (req,res,next) => { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,''); if (token) { try { req.user = jwt.verify(token, JWT_SECRET); if (await rejectBlockedUser(req.user.sub)) return res.status(403).json({ error:'Nalog je privremeno blokiran.' }); } catch { return res.status(401).json({ error:'Sesija je istekla.' }); } } next(); });
const admin = asyncRoute(async (req,res,next) => { const { rows } = await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role='admin'",[req.user.sub]); if (!rows.length) return res.status(403).json({error:'Nemate administratorska prava.'}); next(); });
const moderatorOrAdmin = asyncRoute(async(req,res,next)=>{const r=await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN ('admin','moderator')",[req.user.sub]);if(!r.rowCount)return res.status(403).json({error:'Nemate moderatorska prava.'});next();});
const moderatorOnly = asyncRoute(async(req,res,next)=>{const r=await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role='moderator'",[req.user.sub]);if(!r.rowCount)return res.status(403).json({error:'Samo moderator može poslati predlog izmene.'});next();});
const publicUser = u => ({ id:u.id, email:u.email, user_metadata:u.metadata || {}, created_at:u.created_at });
const sign = u => jwt.sign({ sub:u.id, email:u.email, role:'authenticated' }, JWT_SECRET, { expiresIn:'7d' });
const validPib = raw => { const p=String(raw||'').replace(/\s/g,''); if(!/^\d{9}$/.test(p)) return false; let s=10; for(let i=0;i<8;i++){s=(s+Number(p[i]))%10;if(s===0)s=10;s=(s*2)%11;} return (11-s)%10===Number(p[8]); };
app.get('/', (_req,res)=>res.json({ ok:true, service:'PonudiMi API', message:'API je aktivan.', health:'/api/health' }));
app.get('/api/health', asyncRoute(async (_req,res)=>{ const result=await pool.query('SELECT current_database() AS database, now() AS checked_at'); res.json({ ok:true, service:'PonudiMi standalone API', database:'connected', database_name:result.rows[0].database, checked_at:result.rows[0].checked_at }); }));
app.get('/sitemap.xml', (_req,res)=>{ const base=String(process.env.PUBLIC_APP_URL||'http://localhost').replace(/\/$/,''); const routes=['/','/ponude','/zahtevi','/podrska','/registracija','/prijava']; const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(route=>`<url><loc>${base}${route}</loc></url>`).join('')+'</urlset>'; res.type('application/xml').send(xml); });
app.get('/robots.txt', (_req,res)=>{ const base=String(process.env.PUBLIC_APP_URL||'http://localhost').replace(/\/$/,''); res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`); });
app.post('/api/auth/register', asyncRoute(async(req,res)=>{
 const {email,password,metadata={}}=req.body||{}; const e=String(email||'').trim().toLowerCase();
 if(!/^\S+@\S+\.\S+$/.test(e)||String(password||'').length<6) return res.status(400).json({error:'Unesi ispravnu e-mail adresu i lozinku od najmanje 6 karaktera.'});
 if(!/^[+0-9 ()-]{6,30}$/.test(String(metadata.telefon||'')) || String(metadata.telefon||'').replace(/\D/g,'').length<6) return res.status(400).json({error:'Unesi ispravan broj telefona.'});
 if(metadata.tip_lica==='pravno' && (!String(metadata.naziv_firme||'').trim() || !validPib(metadata.pib))) return res.status(400).json({error:'Naziv firme ili PIB nisu ispravni.'});
 const c=await pool.connect(); try { await c.query('BEGIN'); const {rows}=await c.query('INSERT INTO users(email,password_hash,email_confirmed_at,metadata) VALUES($1,$2,now(),$3) RETURNING *',[e,await bcrypt.hash(password,12),JSON.stringify(metadata)]); const u=rows[0]; const m=metadata; const pib=m.tip_lica==='pravno'&&validPib(m.pib)?String(m.pib).replace(/\s/g,''):null; const verified=!!(pib&&(await c.query('SELECT 1 FROM apr_firme WHERE pib=$1',[pib])).rowCount); await c.query(`INSERT INTO profiles(id,ime,telefon,grad,adresa,tip_lica,naziv_firme,pib,email,firma_verifikovana) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[u.id,m.ime||m.full_name||null,m.telefon||null,m.grad||null,m.adresa||null,m.tip_lica==='pravno'?'pravno':'fizicko',m.naziv_firme||null,pib,e,verified]); await c.query("INSERT INTO user_roles(user_id,role) VALUES($1,'user')",[u.id]); if(e===String(process.env.ADMIN_EMAIL||'').toLowerCase()) await c.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",[u.id]); await c.query('COMMIT'); const token=sign(u); res.status(201).json({user:publicUser(u),session:{access_token:token,token_type:'bearer',expires_in:604800,user:publicUser(u)}}); } catch(err){await c.query('ROLLBACK'); if(err.code==='23505') return res.status(409).json({error:'Nalog sa ovom e-mail adresom već postoji.'}); throw err;} finally{c.release();}
}));
app.post('/api/auth/login', asyncRoute(async(req,res)=>{const e=String(req.body?.email||'').trim().toLowerCase();const {rows}=await pool.query('SELECT * FROM users WHERE email=$1',[e]);const u=rows[0];if(!u||!(await bcrypt.compare(String(req.body?.password||''),u.password_hash)))return res.status(400).json({error:'E-mail ili lozinka nisu ispravni.'});const p=await pool.query('SELECT blokiran FROM profiles WHERE id=$1',[u.id]);if(p.rows[0]?.blokiran)return res.status(403).json({error:'Nalog je privremeno blokiran.'});const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();if(adminEmail&&e===adminEmail)await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",[u.id]);const token=sign(u);res.json({user:publicUser(u),session:{access_token:token,token_type:'bearer',expires_in:604800,user:publicUser(u)}});}));
app.get('/api/auth/me',auth,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT * FROM users WHERE id=$1',[req.user.sub]);if(!rows[0])return res.status(401).json({error:'Nalog ne postoji.'});res.json({user:publicUser(rows[0])});}));
app.patch('/api/auth/password',auth,asyncRoute(async(req,res)=>{const password=String(req.body?.password||'');if(password.length<6)return res.status(400).json({error:'Lozinka mora imati najmanje 6 karaktera.'});await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(password,12),req.user.sub]);res.json({ok:true});}));
app.post('/api/auth/reset-request',asyncRoute(async(req,res)=>{
 const email=String(req.body?.email||'').trim().toLowerCase();const {rows}=await pool.query('SELECT id,email FROM users WHERE email=$1',[email]);
 // Avoid disclosing whether an address has an account.
 if(!rows[0])return res.json({ok:true});
 if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS)return res.status(503).json({error:'Slanje email poruka nije podešeno. Administrator mora uneti SMTP podatke u .env fajl.'});
 const raw=randomBytes(32).toString('hex');const hash=createHash('sha256').update(raw).digest('hex');
 await pool.query('DELETE FROM password_resets WHERE user_id=$1',[rows[0].id]);await pool.query('INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval \'1 hour\')',[rows[0].id,hash]);
 const nodemailer=(await import('nodemailer')).default;const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
 const configuredBase=process.env.PUBLIC_APP_URL||'http://localhost';const configuredOrigin=new URL(configuredBase).origin;const target=String(req.body?.redirectTo||`${configuredOrigin}/reset-lozinke`);const resetUrl=new URL(target,configuredOrigin);if(resetUrl.origin!==configuredOrigin) return res.status(400).json({error:'Adresa za promenu lozinke nije dozvoljena.'});resetUrl.searchParams.set('token',raw);const link=resetUrl.toString();
 await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'PonudiMi — promena lozinke',text:`Za promenu lozinke otvori ovaj link (važi 1 sat): ${link}`,html:`<p>Za promenu lozinke klikni na sledeći link. Važi 1 sat.</p><p><a href="${link}">Postavi novu lozinku</a></p>`});res.json({ok:true});
}));
app.post('/api/auth/reset-complete',asyncRoute(async(req,res)=>{const token=String(req.body?.token||'');const password=String(req.body?.password||'');if(password.length<6)return res.status(400).json({error:'Lozinka mora imati najmanje 6 karaktera.'});const hash=createHash('sha256').update(token).digest('hex');const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query('SELECT user_id FROM password_resets WHERE token_hash=$1 AND expires_at>now() FOR UPDATE',[hash]);if(!r.rows[0]){await c.query('ROLLBACK');return res.status(400).json({error:'Link je istekao ili je već iskorišćen.'});}await c.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(password,12),r.rows[0].user_id]);await c.query('DELETE FROM password_resets WHERE user_id=$1',[r.rows[0].user_id]);const u=await c.query('SELECT * FROM users WHERE id=$1',[r.rows[0].user_id]);await c.query('COMMIT');const tokenValue=sign(u.rows[0]);const userValue=publicUser(u.rows[0]);res.json({ok:true,session:{access_token:tokenValue,token_type:'bearer',expires_in:604800,user:userValue}});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}));

app.get('/api/ponude',asyncRoute(async(req,res)=>{const q=String(req.query.q||'').trim();const loc=String(req.query.lokacija||'').trim();const cat=String(req.query.kategorija||'').trim();const {rows}=await pool.query(`SELECT p.*, COALESCE((SELECT json_agg(s ORDER BY s.pozicija) FROM (SELECT id,storage_path,external_url,pozicija FROM slike_oglasa WHERE ponuda_id=p.id) s),'[]') slike FROM ponude p WHERE ($1='' OR unaccent(lower(concat_ws(' ',p.naslov,p.opis,p.kategorija,p.lokacija))) LIKE '%'||unaccent(lower($1))||'%') AND ($2='' OR lower(p.lokacija) LIKE '%'||lower($2)||'%') AND ($3='' OR lower(p.kategorija) LIKE '%'||lower($3)||'%') ORDER BY p.created_at DESC LIMIT 200`,[q,loc,cat]);res.json(rows);}));
app.get('/api/zahtevi',asyncRoute(async(req,res)=>{const q=String(req.query.q||'').trim();const loc=String(req.query.lokacija||'').trim();const {rows}=await pool.query(`SELECT * FROM zahtevi WHERE ($1='' OR unaccent(lower(concat_ws(' ',naslov,opis,kategorija,lokacija))) LIKE '%'||unaccent(lower($1))||'%') AND ($2='' OR lower(lokacija) LIKE '%'||lower($2)||'%') ORDER BY created_at DESC LIMIT 200`,[q,loc]);res.json(rows);}));
for (const [table,amount] of [['ponude','cena'],['zahtevi','budzet']]) {
 app.post(`/api/${table}`,auth,asyncRoute(async(req,res)=>{const b=req.body||{};const required=['naslov','kategorija','lokacija'];if(required.some(k=>!String(b[k]||'').trim())||String(b.naslov).length>150||String(b.opis||'').length>3000)return res.status(400).json({error:'Proveri obavezna polja oglasa.'});const {rows}=await pool.query(`INSERT INTO ${table}(naslov,opis,kategorija,lokacija,${amount},valuta,emoji,user_id,kontakt_ime,telefon) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[b.naslov,b.opis||null,b.kategorija,b.lokacija,b[amount]??null,b.valuta||'EUR',b.emoji||null,req.user.sub,b.kontakt_ime||null,b.telefon||null]);res.status(201).json(rows[0]);}));
 app.patch(`/api/${table}/:id`,auth,asyncRoute(async(req,res)=>{const allowed=['naslov','opis','kategorija','lokacija',amount,'valuta','kontakt_ime','telefon','zavrseno'];const b=req.body||{};const keys=Object.keys(b).filter(k=>allowed.includes(k));if(!keys.length)return res.status(400).json({error:'Nema izmena.'});const vals=keys.map(k=>b[k]);vals.push(req.params.id,req.user.sub);const sets=keys.map((k,i)=>`${k}=$${i+1}`).join(',');const {rows}=await pool.query(`UPDATE ${table} SET ${sets},updated_at=now() WHERE id=$${keys.length+1} AND user_id=$${keys.length+2} RETURNING *`,vals);if(!rows[0])return res.status(404).json({error:'Oglas nije pronađen ili nije vaš.'});res.json(rows[0]);}));
 app.delete(`/api/${table}/:id`,auth,asyncRoute(async(req,res)=>{const {rowCount}=await pool.query(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`,[req.params.id,req.user.sub]);if(!rowCount)return res.status(404).json({error:'Oglas nije pronađen ili nije vaš.'});res.json({ok:true});}));
}
app.post('/api/oglasi/:id/slike',auth,memoryUpload.array('fotografije',7),asyncRoute(async(req,res)=>{const kind=req.body.tip==='zahtev'?'zahtev':'ponuda';const table=kind==='ponuda'?'ponude':'zahtevi';const col=kind==='ponuda'?'ponuda_id':'zahtev_id';const own=await pool.query(`SELECT id FROM ${table} WHERE id=$1 AND user_id=$2`,[req.params.id,req.user.sub]);if(!own.rows.length)return res.status(404).json({error:'Oglas nije pronađen.'});const old=await pool.query(`SELECT count(*)::int n FROM slike_oglasa WHERE ${col}=$1`,[req.params.id]);if(old.rows[0].n+(req.files?.length||0)>7)return res.status(400).json({error:'Najviše 7 fotografija po oglasu.'});const out=[];for(const [i,f] of (req.files||[]).entries()){const filename=`${randomUUID()}.jpg`;const key=`${req.user.sub}/${filename}`;const normalized=await normalizeImage(f.buffer);await saveImage(key,normalized,'image/jpeg');const p=`/uploads/${key}`;const {rows}=await pool.query(`INSERT INTO slike_oglasa(${col},storage_path,pozicija) VALUES($1,$2,$3) RETURNING *`,[req.params.id,p,old.rows[0].n+i]);out.push(rows[0]);}res.status(201).json(out);}));

app.post('/api/admin/listings/:kind/:id/images',auth,admin,memoryUpload.array('fotografije',7),asyncRoute(async(req,res)=>{
 const table=req.params.kind==='ponude'?'ponude':req.params.kind==='zahtevi'?'zahtevi':null;
 if(!table)return res.status(400).json({error:'Nepoznat tip oglasa.'});
 if(!req.files?.length)return res.status(400).json({error:'Izaberite najmanje jednu fotografiju.'});
 const listing=await pool.query(`SELECT id,user_id FROM ${table} WHERE id=$1`,[req.params.id]);
 if(!listing.rows[0])return res.status(404).json({error:'Oglas nije pronađen.'});
 const col=table==='ponude'?'ponuda_id':'zahtev_id';
 const count=await pool.query(`SELECT count(*)::int n FROM slike_oglasa WHERE ${col}=$1`,[req.params.id]);
 if(count.rows[0].n+req.files.length>7)return res.status(400).json({error:'Najviše 7 fotografija po oglasu.'});
 const out=[];
 for(const [i,file] of req.files.entries()){
  const key=`${listing.rows[0].user_id}/${randomUUID()}.jpg`;
  const normalized=await normalizeImage(file.buffer);
  await saveImage(key,normalized,'image/jpeg');
  try{
   const inserted=await pool.query(`INSERT INTO slike_oglasa(${col},storage_path,pozicija) VALUES($1,$2,$3) RETURNING *`,[req.params.id,`/uploads/${key}`,count.rows[0].n+i]);
   out.push(inserted.rows[0]);
  }catch(error){await removeImage(key);throw error;}
 }
 res.status(201).json(out);
}));
app.delete('/api/admin/images/:imageId',auth,admin,asyncRoute(async(req,res)=>{
 const found=await pool.query('SELECT * FROM slike_oglasa WHERE id=$1',[req.params.imageId]);
 if(!found.rows[0])return res.status(404).json({error:'Fotografija nije pronađena.'});
 const image=found.rows[0];
 if(image.storage_path){
  const parts=String(image.storage_path).split('/').filter(Boolean);
  if(parts[0]==='uploads')parts.shift();
  await removeImage(parts.join('/'));
 }
 await pool.query('DELETE FROM slike_oglasa WHERE id=$1',[req.params.imageId]);
 res.json({ok:true});
}));

const proposalFields = table => table==='ponude' ? ['naslov','opis','kategorija','lokacija','cena','valuta','kontakt_ime','telefon'] : ['naslov','opis','kategorija','lokacija','budzet','valuta','kontakt_ime','telefon'];
app.post('/api/moderator/proposals',auth,moderatorOnly,asyncRoute(async(req,res)=>{
 const {tabela,oglas_id,predlozeni_podaci}=req.body||{};
 if(!['ponude','zahtevi'].includes(tabela)||!oglas_id||!predlozeni_podaci||typeof predlozeni_podaci!=='object'||Array.isArray(predlozeni_podaci))return res.status(400).json({error:'Nedostaju podaci predloga.'});
 const allowed=proposalFields(tabela),keys=Object.keys(predlozeni_podaci);if(!keys.length||keys.some(k=>!allowed.includes(k)))return res.status(400).json({error:'Predlog sadrži nedozvoljena polja.'});
 const current=await pool.query('SELECT * FROM '+tabela+' WHERE id=$1',[oglas_id]);if(!current.rows[0])return res.status(404).json({error:'Oglas nije pronađen.'});
 const old=current.rows[0],proposed={};for(const key of keys)proposed[key]=predlozeni_podaci[key];
 const title=String(proposed.naslov??old.naslov??'').trim(),category=String(proposed.kategorija??old.kategorija??'').trim(),location=String(proposed.lokacija??old.lokacija??'').trim();
 if(title.length<3||title.length>150||!category||category.length>100||location.length<2||location.length>100||String(proposed.opis??old.opis??'').length>3000)return res.status(400).json({error:'Proveri naslov, kategoriju, lokaciju i opis.'});
 const amount=tabela==='ponude'?'cena':'budzet';if(proposed[amount]!==undefined&&proposed[amount]!==null&&(!Number.isFinite(Number(proposed[amount]))||Number(proposed[amount])<0))return res.status(400).json({error:'Cena/budžet nije ispravan.'});
 if(proposed.telefon!==undefined&&!/^[+0-9 ()-]{6,30}$/.test(String(proposed.telefon||'')))return res.status(400).json({error:'Telefon nije ispravan.'});if(proposed.valuta!==undefined&&!['EUR','RSD'].includes(proposed.valuta))return res.status(400).json({error:'Valuta nije ispravna.'});
 const r=await pool.query('INSERT INTO moderator_proposals(tabela,oglas_id,moderator_id,trenutni_podaci,predlozeni_podaci) VALUES($1,$2,$3,$4,$5) RETURNING *',[tabela,oglas_id,req.user.sub,old,proposed]);res.status(201).json(r.rows[0]);
}));
app.get('/api/moderator/proposals',auth,moderatorOrAdmin,asyncRoute(async(req,res)=>{const r=await pool.query('SELECT * FROM moderator_proposals WHERE moderator_id=$1 ORDER BY created_at DESC LIMIT 200',[req.user.sub]);res.json(r.rows);}));
app.get('/api/admin/proposals',auth,admin,asyncRoute(async(req,res)=>{const r=await pool.query("SELECT mp.*,u.email AS moderator_email,p.ime AS moderator_ime FROM moderator_proposals mp JOIN users u ON u.id=mp.moderator_id LEFT JOIN profiles p ON p.id=u.id ORDER BY CASE WHEN mp.status='na_cekanju' THEN 0 ELSE 1 END,mp.created_at DESC LIMIT 300");res.json(r.rows);}));
app.post('/api/admin/proposals/:id/decision',auth,admin,asyncRoute(async(req,res)=>{
 const decision=req.body?.decision;if(!['odobreno','odbijeno'].includes(decision))return res.status(400).json({error:'Izaberite odobrenje ili odbijanje.'});
 const c=await pool.connect();try{await c.query('BEGIN');const found=await c.query('SELECT * FROM moderator_proposals WHERE id=$1 FOR UPDATE',[req.params.id]);const proposal=found.rows[0];
 if(!proposal){await c.query('ROLLBACK');return res.status(404).json({error:'Predlog nije pronađen.'});}if(proposal.status!=='na_cekanju'){await c.query('ROLLBACK');return res.status(409).json({error:'O ovom predlogu je već odlučeno.'});}
 if(decision==='odobreno'){const table=proposal.tabela,allowed=proposalFields(table),patch=proposal.predlozeni_podaci||{},keys=Object.keys(patch);if(!keys.length||keys.some(k=>!allowed.includes(k)))throw new Error('Predlog sadrži nedozvoljena polja.');
 const current=await c.query('SELECT * FROM '+table+' WHERE id=$1 FOR UPDATE',[proposal.oglas_id]);if(!current.rows[0])throw new Error('Oglas više ne postoji.');
 for(const key of keys)if(JSON.stringify(current.rows[0][key]??null)!==JSON.stringify(proposal.trenutni_podaci?.[key]??null))throw new Error('Oglas je u međuvremenu izmenjen. Predlog je potrebno ponovo proveriti.');
 const vals=keys.map(k=>patch[k]);vals.push(proposal.oglas_id);const sets=keys.map((k,i)=>'"'+k+'"=$'+(i+1)).join(',');await c.query('UPDATE '+table+' SET '+sets+',updated_at=now() WHERE id=$'+(keys.length+1),vals);}
 const updated=await c.query('UPDATE moderator_proposals SET status=$1,admin_napomena=$2,odlucio_id=$3,odluceno_at=now() WHERE id=$4 RETURNING *',[decision,String(req.body?.napomena||'').slice(0,1000)||null,req.user.sub,req.params.id]);await c.query('COMMIT');res.json(updated.rows[0]);
 }catch(error){await c.query('ROLLBACK');if(['Oglas više ne postoji.','Oglas je u međuvremenu izmenjen. Predlog je potrebno ponovo proveriti.','Predlog sadrži nedozvoljena polja.'].includes(error.message))return res.status(409).json({error:error.message});throw error;}finally{c.release();}
}));
app.post('/api/podrska',asyncRoute(async(req,res)=>{const {ime,email,poruka}=req.body||{};if(!ime||!/^\S+@\S+\.\S+$/.test(email||'')||!poruka||poruka.length>2000)return res.status(400).json({error:'Proveri podatke u poruci.'});const {rows}=await pool.query('INSERT INTO poruke_podrske(ime,email,poruka) VALUES($1,$2,$3) RETURNING id,created_at',[ime,email,poruka]);res.status(201).json(rows[0]);}));
app.get('/api/admin/profiles',auth,admin,asyncRoute(async(_req,res)=>{const {rows}=await pool.query('SELECT p.*,u.email FROM profiles p JOIN users u ON u.id=p.id ORDER BY p.created_at DESC');res.json(rows);}));
app.get('/api/admin/support',auth,admin,asyncRoute(async(_req,res)=>{const {rows}=await pool.query('SELECT * FROM poruke_podrske ORDER BY created_at DESC');res.json(rows);}));

// Data API used by the existing React screens through the standalone client adapter.
const TABLE_COLUMNS = {
 ponude: ['id','naslov','opis','kategorija','lokacija','cena','valuta','emoji','istaknuto','zavrseno','user_id','kontakt_ime','telefon','created_at','updated_at'],
 zahtevi: ['id','naslov','opis','kategorija','lokacija','budzet','valuta','zavrseno','user_id','kontakt_ime','telefon','created_at','updated_at'],
 profiles: ['id','ime','telefon','grad','adresa','tip_lica','naziv_firme','pib','firma_verifikovana','blokiran','email','created_at'],
 user_roles: ['id','user_id','role'],
 pracenja: ['id','user_id','ponuda_id','zahtev_id','pocetna_cena','pocetni_budzet','created_at'],
 slike_oglasa: ['id','ponuda_id','zahtev_id','storage_path','external_url','pozicija','created_at'],
 izmene_oglasa: ['id','oglas_id','tabela','opis','created_at'],
 poruke_podrske: ['id','ime','email','poruka','created_at'],
 apr_firme: ['pib','maticni_broj','naziv','sediste','adresa','status','synced_at'],
 apr_sinhronizacije: ['id','pokrenuo','broj_firmi','uspeh','poruka','created_at'],
};
const WRITE_COLUMNS = {
 ponude: ['naslov','opis','kategorija','lokacija','cena','valuta','emoji','kontakt_ime','telefon','zavrseno','user_id','istaknuto'],
 zahtevi: ['naslov','opis','kategorija','lokacija','budzet','valuta','kontakt_ime','telefon','zavrseno','user_id'],
 profiles: ['ime','telefon','grad','adresa','tip_lica','naziv_firme','pib','firma_verifikovana','blokiran','email'],
 user_roles: ['user_id','role'], pracenja: ['user_id','ponuda_id','zahtev_id','pocetna_cena','pocetni_budzet'],
 slike_oglasa: ['ponuda_id','zahtev_id','storage_path','external_url','pozicija'],
 poruke_podrske: ['ime','email','poruka'],
 apr_firme: ['pib','maticni_broj','naziv','sediste','adresa','status','synced_at'],
 apr_sinhronizacije: ['pokrenuo','broj_firmi','uspeh','poruka'],
};
const isAdmin = async id => { const r=await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role='admin'",[id]); return r.rowCount>0; };
const ident = value => { if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error('Neispravno ime polja.'); return `"${value}"`; };
const ownsImage = async (row,userId) => {
 if (row.ponuda_id) return (await pool.query('SELECT 1 FROM ponude WHERE id=$1 AND user_id=$2',[row.ponuda_id,userId])).rowCount>0;
 if (row.zahtev_id) return (await pool.query('SELECT 1 FROM zahtevi WHERE id=$1 AND user_id=$2',[row.zahtev_id,userId])).rowCount>0;
 return false;
};
const cleanupListingFiles = async (table, ids) => { if(!ids.length)return;const col=table==='ponude'?'ponuda_id':'zahtev_id';const {rows}=await pool.query(`SELECT storage_path FROM slike_oglasa WHERE ${col}=ANY($1::uuid[]) AND storage_path IS NOT NULL`,[ids]);for(const row of rows){const parts=String(row.storage_path).split('/').filter(Boolean);if(parts[0]==='uploads')parts.shift();await removeImage(parts.join('/'));} };
app.post('/api/db/query', optionalAuth, asyncRoute(async(req,res)=>{
 const {table,action='select',values,filters=[],orders=[],limit,single,count,or}=req.body||{};
 const columns=TABLE_COLUMNS[table]; if(!columns) return res.status(400).json({error:'Nepoznata tabela.'});
 const userId=req.user?.sub || null; const adminUser=userId ? await isAdmin(userId) : false;
 const write=action!=='select';
 if(write && !userId && !(table==='poruke_podrske' && action==='insert')) return res.status(401).json({error:'Prijava je obavezna.'});
 if(['apr_firme','apr_sinhronizacije'].includes(table) && !adminUser) return res.status(403).json({error:'Samo administrator ima pristup.'});
 if(table==='user_roles' && write && !adminUser) return res.status(403).json({error:'Samo administrator može menjati uloge.'});
 if(table==='poruke_podrske' && action!=='insert' && !adminUser) return res.status(403).json({error:'Samo administrator može pregledati poruke.'});
 if(table==='profiles' && !userId) return res.status(401).json({error:'Prijava je obavezna.'});
 if(table==='profiles' && write && !adminUser && action!=='update') return res.status(403).json({error:'Nedozvoljena izmena profila.'});
 if(table==='izmene_oglasa' && write) return res.status(403).json({error:'Istoriju izmena generiše sistem.'});
 if(table==='user_roles' && action==='update') return res.status(400).json({error:'Uloge se dodaju ili uklanjaju.'});
 if(table==='pracenja' && action==='update') return res.status(400).json({error:'Praćenje se ne menja direktno.'});
 if(table==='poruke_podrske' && action!=='insert' && !adminUser) return res.status(403).json({error:'Samo administrator može pregledati poruke.'});
 if(table==='pracenja' && !userId) return res.status(401).json({error:'Prijava je obavezna.'});
 if(table==='pracenja' && action==='insert') for(const row of supplied){
   const hasOffer=!!row.ponuda_id, hasRequest=!!row.zahtev_id;
   if(hasOffer===hasRequest) return res.status(400).json({error:'Praćenje mora pripadati tačno jednoj ponudi ili zahtevu.'});
   const listing=hasOffer?await pool.query('SELECT id FROM ponude WHERE id=$1',[row.ponuda_id]):await pool.query('SELECT id FROM zahtevi WHERE id=$1',[row.zahtev_id]);
   if(!listing.rowCount) return res.status(404).json({error:'Oglas koji želiš da pratiš ne postoji.'});
 }
 const supplied=Array.isArray(values)?values:[values||{}];
 for(const item of supplied) for(const key of Object.keys(item||{})) {
   if(!columns.includes(key) || ['id','created_at','updated_at'].includes(key)) return res.status(400).json({error:`Polje ${key} nije dozvoljeno za izmenu.`});
   if(action!=='select' && !(WRITE_COLUMNS[table]||[]).includes(key) && !(adminUser && (table==='ponude'||table==='zahtevi'||table==='profiles'))) return res.status(400).json({error:`Polje ${key} ne može da se menja.`});
 }
 const where=[]; const params=[];
 const addWhere=(sql,val)=>{params.push(val);where.push(sql.replace('?',`$${params.length}`));};
 for(const f of filters||[]){ if(!columns.includes(f.column)) return res.status(400).json({error:'Neispravan filter.'}); if(f.op==='eq') addWhere(`${ident(f.column)} = ?`,f.value); else if(f.op==='ilike') addWhere(`${ident(f.column)} ILIKE ?`,f.value); }
 if(or){
   const alternatives=[];
   for(const part of String(or).split(',')){ const m=part.match(/^([a-z_][a-z0-9_]*)\.ilike\.(.*)$/i); if(m&&columns.includes(m[1])){params.push(m[2]);alternatives.push(`${ident(m[1])} ILIKE $${params.length}`);} }
   if(alternatives.length) where.push(`(${alternatives.join(' OR ')})`);
 }
 if((action==='update'||action==='delete') && where.length===0) return res.status(400).json({error:'Izmena ili brisanje zahteva ispravan filter.'});
 if(table==='ponude'||table==='zahtevi') { if(write && !adminUser && action!=='insert') addWhere('user_id = ?',userId); }
 if(table==='profiles' && !adminUser) addWhere('id = ?',userId);
 if(table==='pracenja' && !adminUser) { if(action==='insert'){ for(const row of supplied) row.user_id=userId; } else addWhere('user_id = ?',userId); }
 if(table==='user_roles' && !adminUser) addWhere('user_id = ?',userId);
 if(table==='slike_oglasa' && write && action!=='insert' && !adminUser){
   // Require a concrete image ID and verify its parent listing belongs to the caller.
   const idFilter=(filters||[]).find(f=>f.column==='id'&&f.op==='eq');
   if(!idFilter)return res.status(400).json({error:'Izmena fotografije zahteva ID fotografije.'});
   const r=await pool.query('SELECT * FROM slike_oglasa WHERE id=$1',[idFilter.value]);
   if(!r.rows[0]||!(await ownsImage(r.rows[0],userId)))return res.status(403).json({error:'Nemate pravo izmene fotografije.'});
 }
 if(table==='slike_oglasa' && action==='insert' && !adminUser){
   for(const row of supplied){
     if(!(await ownsImage(row,userId))) return res.status(403).json({error:'Fotografija mora pripadati vašem oglasu.'});
     if(row.storage_path && (!String(row.storage_path).startsWith(`${userId}/`) || String(row.storage_path).includes('..'))) return res.status(403).json({error:'Neispravna putanja fotografije.'});
     if(row.external_url){let u;try{u=new URL(row.external_url);}catch{return res.status(400).json({error:'Adresa fotografije nije ispravna.'});}if(!['http:','https:'].includes(u.protocol))return res.status(400).json({error:'Dozvoljene su samo HTTP/HTTPS adrese fotografija.'});}
   }
 }
 if(table==='slike_oglasa' && action==='update' && !adminUser){
   for(const row of supplied){if(row.storage_path && (!String(row.storage_path).startsWith(`${userId}/`) || String(row.storage_path).includes('..')))return res.status(403).json({error:'Neispravna putanja fotografije.'});if(row.external_url){let u;try{u=new URL(row.external_url);}catch{return res.status(400).json({error:'Adresa fotografije nije ispravna.'});}if(!['http:','https:'].includes(u.protocol))return res.status(400).json({error:'Dozvoljene su samo HTTP/HTTPS adrese fotografija.'});}}
 }
 if(table==='ponude'||table==='zahtevi') {
   const amountField=table==='ponude'?'cena':'budzet';
   if(action==='insert') for(const row of supplied){
     row.user_id=userId;if(table==='ponude')row.istaknuto=false;
     if(!String(row.naslov||'').trim()||String(row.naslov).trim().length<3||String(row.naslov).length>150||!String(row.kategorija||'').trim()||String(row.kategorija).length>100||String(row.lokacija||'').trim().length<2||String(row.lokacija).length>100||String(row.kontakt_ime||'').trim().length<2||String(row.kontakt_ime).length>100||! /^[+0-9 ()-]{6,30}$/.test(String(row.telefon||''))||String(row.opis||'').length>3000|| (row[amountField]!==null&&row[amountField]!==undefined&&(!Number.isFinite(Number(row[amountField]))||Number(row[amountField])<0)) || !['EUR','RSD'].includes(row.valuta||'EUR')) return res.status(400).json({error:'Podaci oglasa nisu ispravni. Proveri naslov, kategoriju, lokaciju, kontakt i cenu/budžet.'});
   }
   if(action==='update'&&!adminUser) for(const row of supplied){delete row.user_id;delete row.istaknuto;}
   if(action==='update'&&!adminUser){
     const idFilter=(filters||[]).find(f=>f.column==='id'&&f.op==='eq');if(!idFilter)return res.status(400).json({error:'Izmena oglasa zahteva ID oglasa.'});
     const current=await pool.query(`SELECT * FROM ${table} WHERE id=$1 AND user_id=$2`,[idFilter.value,userId]);if(!current.rows[0])return res.status(404).json({error:'Oglas nije pronađen ili nije vaš.'});
     const merged={...current.rows[0],...(supplied[0]||{})};
     if(String(merged.naslov||'').trim().length<3||String(merged.naslov).length>150||!String(merged.kategorija||'').trim()||String(merged.lokacija||'').trim().length<2||String(merged.lokacija).length>100||String(merged.kontakt_ime||'').trim().length<2||String(merged.kontakt_ime).length>100||! /^[+0-9 ()-]{6,30}$/.test(String(merged.telefon||''))||String(merged.opis||'').length>3000||(merged[amountField]!==null&&merged[amountField]!==undefined&&(!Number.isFinite(Number(merged[amountField]))||Number(merged[amountField])<0)))return res.status(400).json({error:'Izmenjeni podaci oglasa nisu ispravni.'});
   }
 }
 if(table==='profiles' && action==='update' && !adminUser) for(const row of supplied){delete row.blokiran;delete row.firma_verifikovana;delete row.email;delete row.id;if(row.pib!==undefined&&row.pib!==null&&row.pib!==''&&!validPib(row.pib))return res.status(400).json({error:'PIB nije ispravan.'});if(row.tip_lica==='pravno'&&row.naziv_firme!==undefined&&!String(row.naziv_firme||'').trim())return res.status(400).json({error:'Unesi naziv firme.'});}
 const whereSql=where.length?` WHERE ${where.join(' AND ')}`:'';
 let result;
 if(action==='select'){
   const orderSql=(orders||[]).filter(o=>columns.includes(o.column)).map(o=>`${ident(o.column)} ${o.ascending===false?'DESC':'ASC'}`).join(',');
   const lim=Number.isInteger(limit)?Math.max(0,Math.min(limit,500)):500;
   const sql=`SELECT * FROM ${ident(table)}${whereSql}${orderSql?` ORDER BY ${orderSql}`:''} LIMIT ${lim}`;
   const {rows}=await pool.query(sql,params); let data=rows;
   if(count==='exact'){const c=await pool.query(`SELECT count(*)::int n FROM ${ident(table)}${whereSql}`,params);result={data,count:c.rows[0].n};}else result={data};
 } else if(action==='insert'||action==='upsert'){
   const inserted=[];
   for(const row of supplied){const keys=Object.keys(row||{});if(!keys.length)continue;const vals=keys.map(k=>row[k]);const sql=`INSERT INTO ${ident(table)} (${keys.map(ident).join(',')}) VALUES (${vals.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`;const r=await pool.query(sql,vals);inserted.push(r.rows[0]);}
   result={data:Array.isArray(values)?inserted:inserted[0]||null};
 } else if(action==='update'){
   const row=supplied[0]||{};const keys=Object.keys(row);if(!keys.length)return res.json({data:[]});const vals=keys.map(k=>row[k]);const sets=keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(',');const updateWhere=where.map(w=>w.replace(/\$(\d+)/g,(_m,n)=>`$${Number(n)+vals.length}`)).join(' AND ');const all=[...vals,...params];const r=await pool.query(`UPDATE ${ident(table)} SET ${sets}${updateWhere?` WHERE ${updateWhere}`:''} RETURNING *`,all);if(table==='profiles'&&!adminUser&&r.rows[0]){const v=await pool.query(`UPDATE profiles SET firma_verifikovana=(tip_lica='pravno' AND pib IS NOT NULL AND EXISTS(SELECT 1 FROM apr_firme f WHERE f.pib=profiles.pib)) WHERE id=$1 RETURNING *`,[userId]);result={data:v.rows};}else result={data:r.rows};
 } else if(action==='delete'){
   const deleteWhere=whereSql||'';if(!deleteWhere)return res.status(400).json({error:'Brisanje bez filtera nije dozvoljeno.'});
   if(table==='ponude'||table==='zahtevi'){const matches=await pool.query(`SELECT id FROM ${ident(table)}${deleteWhere}`,params);await cleanupListingFiles(table,matches.rows.map(x=>x.id));}
   const r=await pool.query(`DELETE FROM ${ident(table)}${deleteWhere} RETURNING *`,params);result={data:r.rows};
 } else return res.status(400).json({error:'Nepoznata operacija.'});
 let data=result.data;
 if(single){if(Array.isArray(data)){if(data.length!==1)return res.status(406).json({error:'Očekivan je jedan rezultat.'});data=data[0];}}
 res.json({...result,data});
}));
app.post('/api/db/rpc', optionalAuth, asyncRoute(async(req,res)=>{
 const {fn,args={}}=req.body||{}; const userId=req.user?.sub||null;
 if(fn==='has_role'){const role=String(args._role||'admin');if(!['admin','moderator','user'].includes(role))return res.json({data:false});const r=userId?await pool.query('SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2',[userId,role]):{rowCount:0};return res.json({data:!!r.rowCount});}
 if(fn==='pretrazi_ponude'||fn==='pretrazi_zahteve'){
  const table=fn==='pretrazi_ponude'?'ponude':'zahtevi';const term=String(args.q||'').trim();const mesto=String(args.mesto||'').trim();
  const {rows}=await pool.query(`SELECT * FROM ${table} WHERE pretraga_uslov(concat_ws(' ',naslov,opis,kategorija,lokacija),$1) AND pretraga_uslov(lokacija,$2) ORDER BY created_at DESC LIMIT 200`,[term,mesto]);return res.json({data:rows});
 }
 return res.status(400).json({error:'Nepoznata funkcija.'});
}));
app.post('/api/storage/upload',auth,memoryUpload.single('file'),asyncRoute(async(req,res)=>{
 const requested=safeObjectKey(req.body.path);if(!req.file)return res.status(400).json({error:'Fotografija nije poslata.'});
 if(!requested.startsWith(`${req.user.sub}/`))return res.status(403).json({error:'Nedozvoljena putanja fotografije.'});
 const key=requested;
 const normalized=await normalizeImage(req.file.buffer);
 await saveImage(key,normalized,'image/jpeg');res.status(201).json({path:key,storage:s3?'r2':'local',width:800,height:600,format:'jpeg'});
}));
app.post('/api/storage/remove',auth,asyncRoute(async(req,res)=>{
 const paths=Array.isArray(req.body?.paths)?req.body.paths:[];for(const item of paths){const key=safeObjectKey(item);if(!key.startsWith(`${req.user.sub}/`))continue;await removeImage(key);}res.json({ok:true});
}));
app.get('/api/storage/public',asyncRoute(async(req,res)=>{
 const key=safeObjectKey(req.query.path);if(!key)return res.status(400).end();
 if(s3){const object=await s3.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));res.setHeader('Content-Type',object.ContentType||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=86400');object.Body.pipe(res);}
 else {const stored=await pool.query('SELECT content_type,body FROM storage_objects WHERE object_key=$1',[key]);if(stored.rows[0]){res.setHeader('Content-Type',stored.rows[0].content_type);res.setHeader('Cache-Control','public, max-age=86400');return res.send(stored.rows[0].body);}const target=path.resolve(uploadDir,key);if(!target.startsWith(path.resolve(uploadDir)+path.sep))return res.status(404).end();res.type('image/jpeg').sendFile(target);}
}));
app.get('/uploads/*filepath',asyncRoute(async(req,res)=>{const parts=req.params.filepath;const key=safeObjectKey(Array.isArray(parts)?parts.join('/'):parts);if(!key)return res.status(404).end();const stored=await pool.query('SELECT content_type,body FROM storage_objects WHERE object_key=$1',[key]);if(!stored.rows[0])return res.status(404).end();res.setHeader('Content-Type',stored.rows[0].content_type);res.setHeader('Cache-Control','public, max-age=86400');res.send(stored.rows[0].body);}));
app.delete('/api/admin/users/:id',auth,admin,asyncRoute(async(req,res)=>{if(req.params.id===req.user.sub)return res.status(400).json({error:'Ne možete obrisati sopstveni nalog.'});const c=await pool.connect();try{await c.query('BEGIN');const p=await c.query('SELECT id FROM ponude WHERE user_id=$1',[req.params.id]);const z=await c.query('SELECT id FROM zahtevi WHERE user_id=$1',[req.params.id]);await cleanupListingFiles('ponude',p.rows.map(x=>x.id));await cleanupListingFiles('zahtevi',z.rows.map(x=>x.id));await c.query('DELETE FROM izmene_oglasa WHERE oglas_id IN (SELECT id FROM ponude WHERE user_id=$1 UNION ALL SELECT id FROM zahtevi WHERE user_id=$1)',[req.params.id]);await c.query('DELETE FROM ponude WHERE user_id=$1',[req.params.id]);await c.query('DELETE FROM zahtevi WHERE user_id=$1',[req.params.id]);await c.query('DELETE FROM users WHERE id=$1',[req.params.id]);await c.query('COMMIT');res.json({ok:true});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}));
// PRIVREMENA funkcija za brisanje SAMO administratorskog naloga; ukloniti nakon upotrebe.
app.delete('/api/admin/account/self',asyncRoute(async(req,res)=>{
 const configuredEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
 const configuredKey=String(process.env.ADMIN_ACCOUNT_DELETE_KEY||'');
 const suppliedKey=String(req.headers['x-account-delete-key']||'');
 const confirmedEmail=String(req.body?.confirmEmail||'').trim().toLowerCase();
 if(!configuredEmail||configuredKey.length<32) return res.status(503).json({error:'Privremeno brisanje nije aktivirano.'});
 const a=Buffer.from(configuredKey); const b=Buffer.from(suppliedKey);
 if(a.length!==b.length||!timingSafeEqual(a,b)) return res.status(403).json({error:'Neispravan sigurnosni ključ.'});
 if(confirmedEmail!==configuredEmail) return res.status(400).json({error:'Potvrda email adrese nije ispravna.'});
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT id,email FROM users WHERE lower(email)=lower($1) FOR UPDATE',[configuredEmail]);
  if(!found.rows[0]){await c.query('ROLLBACK');return res.status(404).json({error:'Administratorski nalog nije pronađen.'});}
  await c.query('DELETE FROM users WHERE id=$1',[found.rows[0].id]);
  await c.query('COMMIT');
  res.json({ok:true,message:'Administratorski nalog je obrisan. Oglasi i fotografije su sačuvani.'});
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}));
app.post('/api/admin/apr-sync',auth,admin,asyncRoute(async(req,res)=>{
 const url=process.env.APR_API_URL,key=process.env.APR_API_KEY;if(!url||!key)return res.status(503).json({error:'APR_API_URL i APR_API_KEY nisu podešeni.'});
 try{const response=await fetch(url,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});if(!response.ok)throw new Error(`APR je vratio status ${response.status}`);const body=await response.json();const list=Array.isArray(body)?body:(body.data||[]);let n=0;
  for(const f of list){const pib=String(f.pib||'').replace(/\D/g,'');const naziv=String(f.naziv||'').trim();if(!/^\d{9}$/.test(pib)||!naziv)continue;await pool.query(`INSERT INTO apr_firme(pib,maticni_broj,naziv,sediste,adresa,status,synced_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(pib) DO UPDATE SET maticni_broj=EXCLUDED.maticni_broj,naziv=EXCLUDED.naziv,sediste=EXCLUDED.sediste,adresa=EXCLUDED.adresa,status=EXCLUDED.status,synced_at=now()`,[pib,f.maticni_broj||null,naziv,f.sediste||null,f.adresa||null,f.status||null]);n++;}
  await pool.query('UPDATE profiles SET firma_verifikovana=EXISTS(SELECT 1 FROM apr_firme f WHERE f.pib=profiles.pib) WHERE tip_lica=$1',['pravno']);await pool.query('INSERT INTO apr_sinhronizacije(pokrenuo,broj_firmi,uspeh,poruka) VALUES($1,$2,true,$3)',[req.user.sub,n,`Sinhronizovano ${n} firmi.`]);res.json({ok:true,broj:n,poruka:`Sinhronizovano ${n} firmi.`});
 }catch(e){await pool.query('INSERT INTO apr_sinhronizacije(pokrenuo,broj_firmi,uspeh,poruka) VALUES($1,0,false,$2)',[req.user.sub,e.message]);throw e;}
}));

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:process.env.NODE_ENV==='production'?'Greška na serveru.':err.message});});
const port=Number(process.env.PORT||process.env.API_PORT||4000);
async function startServer(){
 const schemaPath=path.resolve(__dirname,'../db/init.sql');
 const schema=await readFile(schemaPath,'utf8');
 await pool.query(schema);
 console.log('PonudiMi PostgreSQL šema je uspešno proverena/inicijalizovana.');
 app.listen(port,'0.0.0.0',()=>{
  console.log(`PonudiMi API sluša na ${port}`);
  const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  if(email)pool.query("INSERT INTO user_roles(user_id,role) SELECT id,'admin' FROM users WHERE email=$1 ON CONFLICT DO NOTHING",[email]).then(()=>console.log('Provera početnog administratora završena.')).catch(err=>console.error('Admin bootstrap:',err.message));
 });
}
startServer().catch(err=>{console.error('Pokretanje PonudiMi API-ja nije uspelo:',err);process.exit(1);});
