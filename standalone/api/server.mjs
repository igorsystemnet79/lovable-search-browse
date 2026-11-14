import express from 'express';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { registerBackupExport } from './backup-export.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
// APR provera je privremeno isključena tokom testiranja. Kada platforma bude spremna za rad, promeniti na true.
const APR_VERIFICATION_REQUIRED = false;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET mora imati najmanje 32 karaktera.');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Poslovni katalog šalje Excel/CSV sadržaj kao JSON; 2 MB nije dovoljno za veće uvoze.
app.use(express.json({ limit: '20mb' }));
app.use((req,_res,next)=>{const raw=String(req.headers.cookie||'');req.cookies=Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}));next();});
// Google OAuth ima zaseban limit, da ponovljeni pokušaji ne blokiraju običnu prijavu.
app.use('/api/auth/google', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Previše pokušaja Google prijave. Sačekaj nekoliko minuta i pokušaj ponovo.' } }));
// Login protection is scoped to failed attempts, not every authenticated-session check.
// A shared IP (mobile carrier/Wi-Fi) must not lock unrelated accounts after normal app navigation.
const loginIpLimiter = rateLimit({
 windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
 skipSuccessfulRequests: true,
 message: { error: 'Previše neuspešnih pokušaja prijave sa ove mreže. Sačekaj 15 minuta i pokušaj ponovo.' }
});
const loginAccountLimiter = rateLimit({
 windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
 keyGenerator: (req) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  return createHash('sha256').update(`${ipKeyGenerator(req.ip)}:${email}`).digest('hex');
 },
 skipSuccessfulRequests: true,
 message: { error: 'Previše neuspešnih pokušaja za ovaj nalog sa ove mreže. Sačekaj 15 minuta i pokušaj ponovo.' }
});
// Registracija ima sopstveni brojač, odvojen od prijave.
const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Previše pokušaja registracije. Sačekaj nekoliko minuta i pokušaj ponovo.' } });
app.use('/api/db/query', rateLimit({ windowMs: 60 * 1000, limit: 180 }));
app.use('/api/reports', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/storage', rateLimit({ windowMs: 60 * 1000, limit: 60 }));
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', immutable: true }));
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 7 }, fileFilter: (_req, f, cb) => imageMime.has(f.mimetype) ? cb(null, true) : cb(new Error('Dozvoljeni su samo JPG, PNG i WebP formati.')) });
async function normalizeImage(buffer) {
 const output = await sharp(buffer, { limitInputPixels: 100000000 }).rotate().resize(800, 600, { fit: 'contain', background: '#ffffff', withoutEnlargement: false }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
 return output;
}
const s3Enabled = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
const s3 = s3Enabled ? new S3Client({ region: process.env.S3_REGION || 'auto', endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } }) : null;
const filesystemStorage = !s3 && process.env.IMAGE_STORAGE_MODE === 'filesystem';
const imageMime = new Set(['image/jpeg','image/png','image/webp']);
const safeObjectKey = value => String(value || '').replace(/^\/+/, '').split('/').filter(part => part && part !== '.' && part !== '..').join('/');
async function saveImage(key, buffer, contentType) {
 if (!imageMime.has(contentType)) throw new Error('Dozvoljeni su samo JPG, PNG i WebP formati.');
 const safeKey=safeObjectKey(key);
 if(!safeKey)throw new Error('Putanja fotografije nije ispravna.');
 if (s3) {
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safeKey, Body: buffer, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
 } else if (filesystemStorage) {
  const root=path.resolve(uploadDir), target=path.resolve(root,safeKey);
  if(!target.startsWith(root+path.sep))throw new Error('Putanja fotografije nije dozvoljena.');
  await fs.promises.mkdir(path.dirname(target),{recursive:true});
  const temporary=target+'.'+randomUUID()+'.tmp';
  try { await fs.promises.writeFile(temporary,buffer,{flag:'wx'}); await fs.promises.rename(temporary,target); }
  catch(error) { try { await fs.promises.unlink(temporary); } catch {} throw error; }
 } else {
  await pool.query('INSERT INTO storage_objects(object_key,content_type,body) VALUES($1,$2,$3) ON CONFLICT(object_key) DO UPDATE SET content_type=EXCLUDED.content_type,body=EXCLUDED.body',[safeKey,contentType,buffer]);
 }
}
async function attachListingImages({ table, listingId, ownerId, files }) {
 const col=table==='ponude'?'ponuda_id':'zahtev_id';
 const c=await pool.connect();
 const savedKeys=[];
 try {
  await c.query('BEGIN');
  const listing=await c.query(`SELECT id,user_id FROM ${table} WHERE id=$1 FOR UPDATE`,[listingId]);
  if(!listing.rows[0]){await c.query('ROLLBACK');return {status:404,error:'Oglas nije pronađen.'};}
  if(ownerId && listing.rows[0].user_id!==ownerId){await c.query('ROLLBACK');return {status:404,error:'Oglas nije pronađen.'};}
  const count=await c.query(`SELECT count(*)::int n FROM slike_oglasa WHERE ${col}=$1`,[listingId]);
  if(count.rows[0].n+files.length>7){await c.query('ROLLBACK');return {status:400,error:'Najviše 7 fotografija po oglasu.'};}
  const out=[];
  for(const [i,file] of files.entries()){
   const key=`${listing.rows[0].user_id}/${randomUUID()}.jpg`;
   const normalized=await normalizeImage(file.buffer);
   await saveImage(key,normalized,'image/jpeg');
   savedKeys.push(key);
   const inserted=await c.query(`INSERT INTO slike_oglasa(${col},storage_path,pozicija) VALUES($1,$2,$3) RETURNING *`,[listingId,`/uploads/${key}`,count.rows[0].n+i]);
   out.push(inserted.rows[0]);
  }
  await c.query('COMMIT');
  return {status:201,data:out};
 } catch(error) {
  await c.query('ROLLBACK').catch(()=>{});
  for(const key of savedKeys){try{await removeImage(key);}catch(cleanupError){console.error('Image cleanup failed:',cleanupError);}}
  throw error;
 } finally {c.release();}
}
async function removeImage(key) {
 const safeKey=safeObjectKey(key);
 if(!safeKey)return;
 if (s3) await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safeKey }));
 else {
  await pool.query('DELETE FROM storage_objects WHERE object_key=$1',[safeKey]);
  const root=path.resolve(uploadDir), target=path.resolve(root,safeKey);
  if(target.startsWith(root+path.sep))await fs.promises.unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});
 }
}
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const rejectBlockedUser = async userId => { const result = await pool.query('SELECT blokiran FROM profiles WHERE id=$1', [userId]); return Boolean(result.rows[0]?.blokiran); };
const auth = asyncRoute(async (req,res,next) => {
 const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
 if (!token) return res.status(401).json({ error:'Prijava je obavezna.' });
 try { req.user = jwt.verify(token, JWT_SECRET); }
 catch { return res.status(401).json({ error:'Sesija je istekla.' }); }
 // Database outages must not be mistaken for invalid JWTs: otherwise the client
 // may erase a valid saved session during a temporary PostgreSQL interruption.
 if (await rejectBlockedUser(req.user.sub)) return res.status(403).json({ error:'Nalog je privremeno blokiran.' });
 next();
});
const optionalAuth = asyncRoute(async (req,res,next) => {
 const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
 if (token) {
  try { req.user = jwt.verify(token, JWT_SECRET); }
  catch { return res.status(401).json({ error:'Sesija je istekla.' }); }
  if (await rejectBlockedUser(req.user.sub)) return res.status(403).json({ error:'Nalog je privremeno blokiran.' });
 }
 next();
});
const isPlatformAdmin = async user => { const email=String(user?.email||'').trim().toLowerCase(); const configuredAdminEmail=String(process.env.ADMIN_EMAIL||'igorsystemnet@gmail.com').trim().toLowerCase(); if(email && email===configuredAdminEmail) return true; const r=await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role='admin'",[user.sub]); return r.rowCount>0; };
const admin = asyncRoute(async (req,res,next) => { if (!(await isPlatformAdmin(req.user))) return res.status(403).json({error:'Nemate administratorska prava.'}); next(); });
const moderatorOrAdmin = asyncRoute(async(req,res,next)=>{const r=await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role IN ('admin','moderator')",[req.user.sub]);if(!r.rowCount && !(await isPlatformAdmin(req.user)))return res.status(403).json({error:'Nemate moderatorska prava.'});next();});
const moderatorOnly = asyncRoute(async(req,res,next)=>{const r=await pool.query("SELECT 1 FROM user_roles WHERE user_id=$1 AND role='moderator'",[req.user.sub]);if(!r.rowCount)return res.status(403).json({error:'Samo moderator može poslati predlog izmene.'});next();});
const publicUser = u => ({ id:u.id, email:u.email, user_metadata:u.metadata || {}, created_at:u.created_at });
// Kontakt podaci se ne šalju anonimnim posetiocima; zamagljivanje samo u pregledaču nije zaštita.
const zastitiJavneKontakte = (rows, authenticated) => authenticated ? rows : rows.map(row => ({ ...row, kontakt_ime:null, ime_prezime:null, telefon:null, adresa:null, kontakt_zasticen:true }));
const sign = u => jwt.sign({ sub:u.id, email:u.email, role:'authenticated' }, JWT_SECRET, { expiresIn:'7d' });

app.get('/', (_req,res)=>res.json({ ok:true, service:'PonudiMi API', message:'API je aktivan.', health:'/api/health' }));
app.get('/api/health', asyncRoute(async (_req,res)=>{ const result=await pool.query('SELECT current_database() AS database, now() AS checked_at'); res.json({ ok:true, service:'PonudiMi standalone API', database:'connected', database_name:result.rows[0].database, storage_backend:s3?'r2':filesystemStorage?'filesystem':'postgres', checked_at:result.rows[0].checked_at }); }));
app.get('/api/categories',asyncRoute(async(_req,res)=>{const [r,x]=await Promise.all([pool.query('SELECT slug,naziv,slika,podkategorije,podkategorije_slike,created_at,updated_at FROM platform_categories ORDER BY created_at,slug'),pool.query('SELECT slug,subcategory FROM platform_category_exclusions')]);res.set('Cache-Control','no-store');res.json({data:r.rows,exclusions:x.rows});}));
const categorySlug=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'dj').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
const DEFAULT_CATEGORY_IMAGE='https://images.pexels.com/photos/5825398/pexels-photo-5825398.jpeg?auto=compress&cs=tinysrgb&w=900';
app.post('/api/admin/categories',auth,admin,asyncRoute(async(req,res)=>{
 const naziv=String(req.body?.naziv||'').trim().replace(/\s+/g,' ').slice(0,80),slug=categorySlug(naziv);
 if(naziv.length<2||!slug)return res.status(400).json({error:'Unesi naziv grupe od najmanje 2 karaktera.'});
 const exists=await pool.query('SELECT 1 FROM platform_categories WHERE slug=$1 OR lower(naziv)=lower($2)',[slug,naziv]);
 if(exists.rowCount)return res.status(409).json({error:'Grupa sa tim nazivom već postoji.'});
 await pool.query("DELETE FROM platform_category_exclusions WHERE slug=$1",[slug]);
 const r=await pool.query('INSERT INTO platform_categories(slug,naziv,slika,podkategorije) VALUES($1,$2,$3,ARRAY[]::text[]) RETURNING slug,naziv,slika,podkategorije',[slug,naziv,DEFAULT_CATEGORY_IMAGE]);res.status(201).json({data:r.rows[0]});
}));
app.patch('/api/admin/categories/:slug',auth,admin,asyncRoute(async(req,res)=>{
 const slug=String(req.params.slug||'').trim(),naziv=String(req.body?.naziv||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||naziv.length<2)return res.status(400).json({error:'Unesi ispravan naziv grupe od najmanje 2 karaktera.'});
 const current=await pool.query('SELECT naziv FROM platform_categories WHERE slug=$1',[slug]);
 if(!current.rows[0])return res.status(404).json({error:'Grupa nije pronađena.'});
 const duplicate=await pool.query('SELECT 1 FROM platform_categories WHERE lower(naziv)=lower($1) AND slug<>$2',[naziv,slug]);
 if(duplicate.rowCount)return res.status(409).json({error:'Grupa sa tim nazivom već postoji.'});
 const oldName=current.rows[0].naziv;
 const c=await pool.connect();
 try{await c.query('BEGIN');
  await c.query('UPDATE platform_categories SET naziv=$2,updated_at=now() WHERE slug=$1',[slug,naziv]);
  if(oldName!==naziv){
   await c.query('UPDATE ponude SET kategorija=$1 WHERE lower(kategorija)=lower($2)',[naziv,oldName]);
   await c.query('UPDATE zahtevi SET kategorija=$1 WHERE lower(kategorija)=lower($2)',[naziv,oldName]);
  }
  await c.query('COMMIT');
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
 const updated=await pool.query('SELECT slug,naziv,slika,podkategorije,podkategorije_slike FROM platform_categories WHERE slug=$1',[slug]);
 res.json({data:updated.rows[0]});
}));
app.patch('/api/admin/categories/:slug/subcategories/:name',auth,admin,asyncRoute(async(req,res)=>{
 const slug=String(req.params.slug||'').trim(),oldName=String(req.params.name||'').trim(),naziv=String(req.body?.naziv||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||oldName.length<2||naziv.length<2)return res.status(400).json({error:'Podaci o podgrupi nisu ispravni.'});
 const c=await pool.connect();
 try{await c.query('BEGIN');
  const found=await c.query('SELECT podkategorije,podkategorije_slike FROM platform_categories WHERE slug=$1 FOR UPDATE',[slug]);
  if(!found.rows[0]){await c.query('ROLLBACK');return res.status(404).json({error:'Grupa nije pronađena.'});}
  const subs=found.rows[0].podkategorije||[];
  if(!subs.includes(oldName)){await c.query('ROLLBACK');return res.status(404).json({error:'Podgrupa nije pronađena.'});}
  if(subs.some(item=>item!==oldName&&item.toLocaleLowerCase('sr')===naziv.toLocaleLowerCase('sr'))){await c.query('ROLLBACK');return res.status(409).json({error:'Podgrupa sa tim nazivom već postoji.'});}
  const next=subs.map(item=>item===oldName?naziv:item);
  const images={...(found.rows[0].podkategorije_slike||{})};
  if(Object.prototype.hasOwnProperty.call(images,oldName)){images[naziv]=images[oldName];delete images[oldName];}
  await c.query('UPDATE platform_categories SET podkategorije=$2::text[],podkategorije_slike=$3::jsonb,updated_at=now() WHERE slug=$1',[slug,next,JSON.stringify(images)]);
  await c.query("DELETE FROM platform_category_exclusions WHERE slug=$1 AND subcategory=$2",[slug,oldName]);
  await c.query('COMMIT');
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
 const updated=await pool.query('SELECT slug,naziv,slika,podkategorije,podkategorije_slike FROM platform_categories WHERE slug=$1',[slug]);
 res.json({data:updated.rows[0]});
}));
app.delete('/api/admin/categories/:slug',auth,admin,asyncRoute(async(req,res)=>{
 const slug=String(req.params.slug||'').trim(),naziv=String(req.body?.naziv||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||naziv.length<2)return res.status(400).json({error:'Podaci o grupi nisu ispravni.'});
 const used=await pool.query("SELECT EXISTS(SELECT 1 FROM ponude WHERE lower(kategorija)=lower($1)) OR EXISTS(SELECT 1 FROM zahtevi WHERE lower(kategorija)=lower($1)) AS used",[naziv]);
 if(used.rows[0]?.used)return res.status(409).json({error:'Grupa se ne može obrisati jer postoje oglasi ili zahtevi u toj kategoriji. Prvo premesti te oglase i zahteve u drugu grupu.'});
 await pool.query('DELETE FROM platform_categories WHERE slug=$1',[slug]);
 await pool.query("INSERT INTO platform_category_exclusions(slug,subcategory) VALUES($1,'') ON CONFLICT(slug,subcategory) DO NOTHING",[slug]);
 res.json({ok:true,message:'Grupa je obrisana.'});
}));
app.delete('/api/admin/categories/:slug/subcategories/:name',auth,admin,asyncRoute(async(req,res)=>{
 const slug=String(req.params.slug||'').trim(),name=String(req.params.name||'').trim();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||name.length<2)return res.status(400).json({error:'Podaci o podgrupi nisu ispravni.'});
 await pool.query("UPDATE platform_categories SET podkategorije=array_remove(podkategorije,$2),podkategorije_slike=COALESCE(podkategorije_slike,'{}'::jsonb)-$2,updated_at=now() WHERE slug=$1",[slug,name]);
 await pool.query("INSERT INTO platform_category_exclusions(slug,subcategory) VALUES($1,$2) ON CONFLICT(slug,subcategory) DO NOTHING",[slug,name]);
 res.json({ok:true,message:'Podgrupa je obrisana.'});
}));
app.post('/api/admin/categories/:slug/subcategories',auth,admin,asyncRoute(async(req,res)=>{
 const slug=String(req.params.slug||'').trim(),naziv=String(req.body?.naziv||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(naziv.length<2)return res.status(400).json({error:'Unesi naziv podgrupe od najmanje 2 karaktera.'});
 const c=await pool.connect();
 try{await c.query('BEGIN');let category=await c.query('SELECT slug,naziv FROM platform_categories WHERE slug=$1 FOR UPDATE',[slug]);
  if(!category.rows[0]){const grupa=String(req.body?.grupa||'').trim().replace(/\s+/g,' ').slice(0,80);if(!grupa||categorySlug(grupa)!==slug){await c.query('ROLLBACK');return res.status(404).json({error:'Grupa nije pronađena.'});}
   await c.query("INSERT INTO platform_categories(slug,naziv,slika,podkategorije) VALUES($1,$2,'',ARRAY[]::text[]) ON CONFLICT(slug) DO NOTHING",[slug,grupa]);category=await c.query('SELECT slug,naziv FROM platform_categories WHERE slug=$1 FOR UPDATE',[slug]);}
  const current=await c.query('SELECT podkategorije FROM platform_categories WHERE slug=$1',[slug]),existing=current.rows[0].podkategorije||[];
  if(existing.some(item=>item.toLocaleLowerCase('sr')===naziv.toLocaleLowerCase('sr'))){await c.query('ROLLBACK');return res.status(409).json({error:'Ta podgrupa već postoji u izabranoj grupi.'});}
  await c.query("DELETE FROM platform_category_exclusions WHERE slug=$1 AND subcategory=$2",[slug,naziv]);
  const updated=await c.query('UPDATE platform_categories SET podkategorije=array_append(podkategorije,$2),updated_at=now() WHERE slug=$1 RETURNING slug,naziv,slika,podkategorije',[slug,naziv]);await c.query('COMMIT');res.json({data:updated.rows[0]});
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}));
function validCategoryImageUrl(raw) {
 let parsed;
 try { parsed = new URL(String(raw || '').trim()); } catch { return null; }
 if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.href.length > 2048) return null;
 return parsed.href;
}
async function saveCategoryImage(req, slug, subcategory = null) {
 const naziv=String(req.body?.naziv||'').trim().replace(/\\s+/g,' ').slice(0,80);
 let suppliedSubs=req.body?.podkategorije||[];
 if(typeof suppliedSubs==='string'){try{suppliedSubs=JSON.parse(suppliedSubs);}catch{suppliedSubs=[];}}
 if(!Array.isArray(suppliedSubs))suppliedSubs=[];
 suppliedSubs=[...new Set(suppliedSubs.map(value=>String(value||'').trim()).filter(value=>value.length>=2&&value.length<=80))];
 const category = await pool.query('SELECT slug,naziv,podkategorije FROM platform_categories WHERE slug=$1',[slug]);
 // Podrazumevane grupe postoje i u aplikaciji, ali nisu sve nužno inicijalno upisane u bazu.
 // Prilikom prve promene slike kreiramo njihov zapis sa nazivom i poznatim podgrupama iz UI-ja.
 if(!category.rows[0]){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||naziv.length<2)return {status:404,error:'Grupa nije pronađena. Osveži stranicu i pokušaj ponovo.'};
  await pool.query('INSERT INTO platform_categories(slug,naziv,slika,podkategorije) VALUES($1,$2,$3,$4::text[]) ON CONFLICT(slug) DO NOTHING',[slug,naziv,'',suppliedSubs]);
 }
 let current=await pool.query('SELECT slug,naziv,podkategorije FROM platform_categories WHERE slug=$1',[slug]);
 if(!current.rows[0])return {status:404,error:'Grupa nije pronađena.'};
 if(naziv && current.rows[0].naziv!==naziv)await pool.query('UPDATE platform_categories SET naziv=$2,updated_at=now() WHERE slug=$1',[slug,naziv]);
 if(suppliedSubs.length){
  await pool.query('UPDATE platform_categories SET podkategorije=ARRAY(SELECT DISTINCT subcategory FROM unnest(COALESCE(podkategorije,ARRAY[]::text[])||$2::text[]) AS subs(subcategory)),updated_at=now() WHERE slug=$1',[slug,suppliedSubs]);
 }
 if (subcategory !== null) {
  const check=await pool.query('SELECT 1 FROM platform_categories WHERE slug=$1 AND $2=ANY(podkategorije)',[slug,subcategory]);
  if(!check.rowCount)return {status:404,error:'Podgrupa nije pronađena u izabranoj grupi. Osveži stranicu i pokušaj ponovo.'};
 }
 let imageUrl = '';
 if (req.file) {
  const normalized = await normalizeImage(req.file.buffer);
  const key = 'categories/' + slug + '/' + randomUUID() + '.jpg';
  await saveImage(key, normalized, 'image/jpeg');
  imageUrl = '/api/storage/public?path=' + encodeURIComponent(key);
 } else {
  imageUrl = validCategoryImageUrl(req.body?.url);
  if (!imageUrl) return { status:400, error:'Unesi ispravan HTTPS link do fotografije ili izaberi JPG, PNG ili WebP sliku.' };
 }
 let result;
 if (subcategory === null) {
  result = await pool.query('UPDATE platform_categories SET slika=$2,updated_at=now() WHERE slug=$1 RETURNING slug,naziv,slika,podkategorije,podkategorije_slike',[slug,imageUrl]);
 } else {
  result = await pool.query("UPDATE platform_categories SET podkategorije_slike=jsonb_set(COALESCE(podkategorije_slike, '{}'::jsonb),ARRAY[$2]::text[],to_jsonb($3::text),true),updated_at=now() WHERE slug=$1 RETURNING slug,naziv,slika,podkategorije,podkategorije_slike",[slug,subcategory,imageUrl]);
 }
 return { status:200, data:result.rows[0] };
}
const categoryImageHandler = subcategory => asyncRoute(async (req,res) => {
 const result = await saveCategoryImage(req,req.params.slug,subcategory ? req.params.name : null);
 res.status(result.status).json(result.error ? {error:result.error} : {data:result.data});
});
app.post('/api/admin/categories/:slug/image',auth,admin,memoryUpload.single('file'),categoryImageHandler(false));
app.put('/api/admin/categories/:slug/image',auth,admin,categoryImageHandler(false));
app.post('/api/admin/categories/:slug/subcategories/:name/image',auth,admin,memoryUpload.single('file'),categoryImageHandler(true));
app.put('/api/admin/categories/:slug/subcategories/:name/image',auth,admin,categoryImageHandler(true));
app.get('/api/platform-rules',asyncRoute(async(_req,res)=>{const r=await pool.query("SELECT sadrzaj,version,published_at FROM platform_rules WHERE singleton=true");res.set('Cache-Control','no-store');res.json({data:r.rows[0]||null});}));
app.get('/api/admin/platform-rules/history',auth,admin,asyncRoute(async(_req,res)=>{const r=await pool.query('SELECT id,sadrzaj,version,published_at,published_by FROM platform_rules_versions ORDER BY version DESC LIMIT 50');res.json({data:r.rows});}));
app.put('/api/admin/platform-rules',auth,admin,asyncRoute(async(req,res)=>{const sadrzaj=String(req.body?.sadrzaj||'').trim();if(sadrzaj.length<30||sadrzaj.length>50000)return res.status(400).json({error:'Tekst pravila mora imati između 30 i 50.000 karaktera.'});const c=await pool.connect();try{await c.query('BEGIN');const current=await c.query('SELECT COALESCE(MAX(version),0)::int AS version FROM platform_rules_versions');const version=current.rows[0].version+1;const inserted=await c.query('INSERT INTO platform_rules_versions(sadrzaj,version,published_by) VALUES($1,$2,$3) RETURNING id,sadrzaj,version,published_at,published_by',[sadrzaj,version,req.user.sub]);await c.query("INSERT INTO platform_rules(singleton,sadrzaj,version,published_by,published_at) VALUES(true,$1,$2,$3,now()) ON CONFLICT(singleton) DO UPDATE SET sadrzaj=EXCLUDED.sadrzaj,version=EXCLUDED.version,published_by=EXCLUDED.published_by,published_at=now()",[sadrzaj,version,req.user.sub]);await c.query('COMMIT');res.json({data:inserted.rows[0]});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}));
app.post('/api/admin/platform-rules/restore',auth,admin,asyncRoute(async(req,res)=>{const id=String(req.body?.id||'');const c=await pool.connect();try{await c.query('BEGIN');const found=await c.query('SELECT sadrzaj FROM platform_rules_versions WHERE id=$1',[id]);if(!found.rows[0]){await c.query('ROLLBACK');return res.status(404).json({error:'Verzija nije pronađena.'});}const current=await c.query('SELECT COALESCE(MAX(version),0)::int AS version FROM platform_rules_versions');const version=current.rows[0].version+1;const inserted=await c.query('INSERT INTO platform_rules_versions(sadrzaj,version,published_by) VALUES($1,$2,$3) RETURNING id,sadrzaj,version,published_at,published_by',[found.rows[0].sadrzaj,version,req.user.sub]);await c.query("INSERT INTO platform_rules(singleton,sadrzaj,version,published_by,published_at) VALUES(true,$1,$2,$3,now()) ON CONFLICT(singleton) DO UPDATE SET sadrzaj=EXCLUDED.sadrzaj,version=EXCLUDED.version,published_by=EXCLUDED.published_by,published_at=now()",[found.rows[0].sadrzaj,version,req.user.sub]);await c.query('COMMIT');res.json({data:inserted.rows[0]});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}));
app.get('/sitemap.xml', (_req,res)=>{ const base=String(process.env.PUBLIC_APP_URL||'http://localhost').replace(/\/$/,''); const routes=['/','/ponude','/zahtevi','/podrska','/registracija','/prijava','/kriterijumi-rangiranja']; const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(route=>`<url><loc>${base}${route}</loc></url>`).join('')+'</urlset>'; res.type('application/xml').send(xml); });
app.get('/robots.txt', (_req,res)=>{ const base=String(process.env.PUBLIC_APP_URL||'http://localhost').replace(/\/$/,''); res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`); });

const googleRedirectUri = () => { const configured=String(process.env.GOOGLE_REDIRECT_URI||'').trim(); return configured || googleFrontendUrl()+'/api/auth/google/callback'; };
const googleFrontendUrl = () => String(process.env.PUBLIC_APP_URL || 'https://ponudimi-novo.onrender.com').trim().replace(/\/+$/,'');
app.get('/api/auth/google', (req,res) => {
 const clientId=String(process.env.GOOGLE_CLIENT_ID||'').trim();
 const secret=String(process.env.GOOGLE_CLIENT_SECRET||'').trim();
 if(!clientId || !secret) return res.status(503).json({error:'Google prijava nije podešena na API servisu.'});
 const state=randomBytes(32).toString('hex');
 res.cookie('ponudimi_google_state',state,{httpOnly:true,secure:googleFrontendUrl().startsWith('https://'),sameSite:'lax',maxAge:10*60*1000,path:'/api/auth/google'});
 const params=new URLSearchParams({client_id:clientId,redirect_uri:googleRedirectUri(),response_type:'code',scope:'openid email profile',state,prompt:'select_account'});
 res.redirect(302,'https://accounts.google.com/o/oauth2/v2/auth?'+params.toString());
});
app.get('/api/auth/google/callback',asyncRoute(async(req,res)=>{
 const expected=String(req.cookies?.ponudimi_google_state||'');
 const received=String(req.query?.state||'');
 res.clearCookie('ponudimi_google_state',{httpOnly:true,secure:googleFrontendUrl().startsWith('https://'),sameSite:'lax',path:'/api/auth/google'});
 const fail=(message)=>res.redirect(302,googleFrontendUrl()+'/prijava?google_error='+encodeURIComponent(message));
 if(!expected || !received || expected.length!==received.length || !timingSafeEqual(Buffer.from(expected),Buffer.from(received))) return fail('Google prijava nije potvrđena. Pokušaj ponovo.');
 const code=String(req.query?.code||'');
 if(!code) return fail('Google nije vratio autorizacioni kod.');
 const clientId=String(process.env.GOOGLE_CLIENT_ID||'').trim();
 const clientSecret=String(process.env.GOOGLE_CLIENT_SECRET||'').trim();
 if(!clientId || !clientSecret) return fail('Google prijava nije podešena na API servisu.');
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:googleRedirectUri(),grant_type:'authorization_code'})});
 const tokenData=await tokenResponse.json().catch(()=>({}));
 if(!tokenResponse.ok || !tokenData.access_token) return fail('Google potvrda nije uspela. Proveri OAuth podešavanja.');
 const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokenData.access_token}});
 const googleUser=await profileResponse.json().catch(()=>({}));
 const email=String(googleUser.email||'').trim().toLowerCase();
 if(!profileResponse.ok || !email || googleUser.email_verified!==true) return fail('Google nalog nema potvrđenu email adresu.');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  let found=await c.query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[email]);
  let user=found.rows[0];
  if(!user){
   await c.query('ROLLBACK');
   return res.redirect(302,googleFrontendUrl()+'/registracija?google_email='+encodeURIComponent(email));
  }else{
   await c.query("UPDATE users SET email_confirmed_at=COALESCE(email_confirmed_at,now()),metadata=COALESCE(metadata,'{}'::jsonb) || $2::jsonb WHERE id=$1",[user.id,JSON.stringify({google_sub:String(googleUser.sub||''),provider:'google'})]);
   await c.query('INSERT INTO profiles(id,email) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET email=COALESCE(profiles.email,EXCLUDED.email)',[user.id,email]);
  }
  const blocked=await c.query('SELECT blokiran FROM profiles WHERE id=$1',[user.id]);
  if(blocked.rows[0]?.blokiran){await c.query('ROLLBACK');return fail('Ovaj nalog je privremeno blokiran.');}
  await c.query('UPDATE profiles SET last_active_at=now() WHERE id=$1',[user.id]);
  await c.query('COMMIT');
  const token=sign(user);
  res.redirect(302,googleFrontendUrl()+'/prijava#access_token='+encodeURIComponent(token));
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
}));

app.post('/api/auth/register', registerLimiter, asyncRoute(async(req,res)=>{
 const maintenance=await pool.query('SELECT enabled,message FROM platform_maintenance WHERE singleton=true');if(maintenance.rows[0]?.enabled)return res.status(503).json({error:maintenance.rows[0].message,code:'MAINTENANCE_MODE',maintenance:true});
 const {email,password,metadata={}}=req.body||{}; const e=String(email||'').trim().toLowerCase();
 if(!/^\S+@\S+\.\S+$/.test(e)||String(password||'').length<8) return res.status(400).json({error:'Unesi ispravnu e-mail adresu i lozinku od najmanje 8 karaktera.'});
 if(!/^[+0-9 ()-]{6,30}$/.test(String(metadata.telefon||'')) || String(metadata.telefon||'').replace(/\D/g,'').length<6) return res.status(400).json({error:'Unesi ispravan broj telefona.'});
 if(metadata.tip_lica==='pravno' && !String(metadata.naziv_firme||'').trim()) return res.status(400).json({error:'Unesi naziv firme.'});
 const korisnickoIme=String(metadata.korisnicko_ime||'').trim().toLowerCase();
 if(!korisnickoIme || [...korisnickoIme].length>20) return res.status(400).json({error:'Korisničko ime je obavezno i može imati najviše 20 karaktera.'});
 if(!['trgovac','nije_trgovac'].includes(String(metadata.status_trgovca||''))) return res.status(400).json({error:'Izaberi da li nastupaš kao trgovac ili kao privatni prodavac.'});
 if(metadata.prihvatio_uslove!==true||metadata.upoznat_sa_privatnoscu!==true||metadata.potvrdio_punoletstvo!==true) return res.status(400).json({error:'Prihvati pravila, potvrdi da si upoznat sa obaveštenjem o privatnosti i potvrdi punoletstvo.'});
 const c=await pool.connect(); try { await c.query('BEGIN');
 const zauzeto=await c.query('SELECT 1 FROM profiles WHERE lower(korisnicko_ime)=lower($1)',[korisnickoIme]);
 if(zauzeto.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'Ovo korisničko ime je već zauzeto.'});}
 const {rows}=await c.query('INSERT INTO users(email,password_hash,email_confirmed_at,metadata) VALUES($1,$2,now(),$3) RETURNING *',[e,await bcrypt.hash(password,12),JSON.stringify({...metadata,korisnicko_ime:korisnickoIme})]); const u=rows[0]; const m=metadata; const pib=m.tip_lica==='pravno'&&String(m.pib||'').trim()?String(m.pib).trim().slice(0,30):null; const verified=!!(pib&&(await c.query('SELECT 1 FROM apr_firme WHERE pib=$1',[pib])).rowCount); await c.query(`INSERT INTO profiles(id,ime,prezime,korisnicko_ime,status_trgovca,telefon,grad,adresa,tip_lica,naziv_firme,pib,email,firma_verifikovana,firma_status_verifikacije) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[u.id,m.ime||null,m.prezime||null,korisnickoIme,m.status_trgovca,m.telefon||null,m.grad||null,m.adresa||null,m.tip_lica==='pravno'?'pravno':'fizicko',m.naziv_firme||null,pib,e,verified,verified?'verifikovana':'na_cekanju']); await c.query("INSERT INTO user_roles(user_id,role) VALUES($1,'user')",[u.id]); const rulesVersion=await c.query('SELECT COALESCE(MAX(version),1)::int AS version FROM platform_rules_versions'); await c.query('INSERT INTO prihvatanja_uslova(user_id,verzija_pravila,verzija_obavestenja_privatnosti,potvrdjeno_punoletstvo,upoznat_sa_privatnoscu,ip_adresa,user_agent) VALUES($1,$2,$3,true,true,$4,$5)',[u.id,rulesVersion.rows[0].version,'nacrt-1.0',String(req.ip||'').slice(0,100)||null,String(req.headers['user-agent']||'').slice(0,500)||null]); await c.query('COMMIT'); const token=sign(u); res.status(201).json({user:publicUser(u),session:{access_token:token,token_type:'bearer',expires_in:604800,user:publicUser(u)}}); } catch(err){await c.query('ROLLBACK'); if(err.code==='23505') return res.status(409).json({error:err.constraint==='profiles_korisnicko_ime_unique'?'Ovo korisničko ime je već zauzeto.':'Nalog sa ovom e-mail adresom već postoji.'}); throw err;} finally{c.release();}
}));
app.post('/api/auth/login', loginIpLimiter, loginAccountLimiter, asyncRoute(async(req,res)=>{const e=String(req.body?.email||'').trim().toLowerCase();const {rows}=await pool.query('SELECT * FROM users WHERE email=$1',[e]);const u=rows[0];if(!u||!(await bcrypt.compare(String(req.body?.password||''),u.password_hash)))return res.status(400).json({error:'E-mail ili lozinka nisu ispravni.'});const p=await pool.query('SELECT blokiran FROM profiles WHERE id=$1',[u.id]);if(p.rows[0]?.blokiran)return res.status(403).json({error:'Nalog je privremeno blokiran.'});await pool.query('UPDATE profiles SET last_active_at=now() WHERE id=$1',[u.id]);const token=sign(u);res.json({user:publicUser(u),session:{access_token:token,token_type:'bearer',expires_in:604800,user:publicUser(u)}});}));
app.get('/api/auth/me',auth,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT * FROM users WHERE id=$1',[req.user.sub]);if(!rows[0])return res.status(401).json({error:'Nalog ne postoji.'});await pool.query("UPDATE profiles SET last_active_at=now() WHERE id=$1 AND (last_active_at IS NULL OR last_active_at<now()-interval '5 minutes')",[req.user.sub]);res.json({user:publicUser(rows[0])});}));
app.patch('/api/auth/password',auth,asyncRoute(async(req,res)=>{const password=String(req.body?.password||'');if(password.length<8)return res.status(400).json({error:'Lozinka mora imati najmanje 8 karaktera.'});await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(password,12),req.user.sub]);res.json({ok:true});}));
const resetRequestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
app.post('/api/auth/reset-request',resetRequestLimiter,asyncRoute(async(req,res)=>{
 // Configuration is checked before account lookup so the response cannot reveal whether an email is registered.
 if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS) return res.status(503).json({error:'Promena lozinke trenutno nije dostupna. Administrator mora podesiti slanje email poruka.'});
 const configuredBase=String(process.env.PUBLIC_APP_URL||'').trim();
 if(!configuredBase) return res.status(503).json({error:'Promena lozinke trenutno nije dostupna. Adresa platforme nije podešena.'});
 let resetUrl;
 try {
  const base=new URL(configuredBase);
  if(!['http:','https:'].includes(base.protocol)||(process.env.NODE_ENV==='production'&&base.protocol!=='https:')) throw new Error('Invalid public app URL');
  resetUrl=new URL('/reset-lozinke',base.origin);
 } catch { return res.status(503).json({error:'Promena lozinke trenutno nije dostupna. Proveri adresu platforme u podešavanjima servera.'}); }
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:'Unesi ispravnu email adresu.'});
 const {rows}=await pool.query('SELECT id,email FROM users WHERE email=$1',[email]);
 // Unknown addresses and successful requests receive the same public response.
 if(!rows[0]) return res.json({ok:true});
 const raw=randomBytes(32).toString('hex');const hash=createHash('sha256').update(raw).digest('hex');
 await pool.query('DELETE FROM password_resets WHERE user_id=$1',[rows[0].id]);
 await pool.query("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",[rows[0].id,hash]);
 resetUrl.searchParams.set('token',raw);
 const nodemailer=(await import('nodemailer')).default;
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
 const link=resetUrl.toString();
 try {
  await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:email,subject:'PonudiMi — promena lozinke',text:`Za promenu lozinke otvori ovaj link (važi 1 sat): ${link}`,html:`<p>Za promenu lozinke klikni na sledeći link. Važi 1 sat.</p><p><a href="${link}">Postavi novu lozinku</a></p>`});
 } catch(error) {
  console.error('Slanje linka za promenu lozinke nije uspelo:',error.message);
  await pool.query('DELETE FROM password_resets WHERE user_id=$1',[rows[0].id]);
 }
 res.json({ok:true});
}));

// Pametno povezivanje: obaveštenja se kreiraju samo za aktivne sačuvane kriterijume.
const normalizeAlertText = value => String(value||'').trim().replace(/\s+/g,' ').slice(0,160);
async function notifyMatchingSavedSearches(listingType, listing) {
 if(!listing?.id || !listing?.user_id || listing.pauziran || listing.moderacija_blokirana) return;
 const {rows}=await pool.query(`
  SELECT DISTINCT a.user_id
  FROM saved_search_alerts a
  WHERE a.active=true AND a.user_id<>$1
   AND (a.target_type=$2 OR a.target_type='oba')
   AND (NULLIF(BTRIM(a.category),'') IS NULL
     OR lower(unaccent(a.category))=lower(unaccent($3))
     OR lower(unaccent($3)) LIKE lower(unaccent(a.category))||' / %')
   AND (a.query_text='' OR pretraga_uslov(concat_ws(' ', $4, $5, $3), a.query_text))
 `,[listing.user_id,listingType,listing.kategorija,listing.naslov,listing.opis||'']);
 const alertMessage=listingType==='ponude'
  ? 'Pojavila se nova ponuda koja odgovara tvojoj sačuvanoj pretrazi.'
  : 'Pojavio se novi zahtev koji odgovara tvojoj sačuvanoj pretrazi.';
 for(const recipient of rows){
  await pool.query(`INSERT INTO ponudimi_smart_notifications(user_id,listing_type,listing_id,title,message)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,listing_type,listing_id) DO NOTHING`,
   [recipient.user_id,listingType,listing.id,listing.naslov,alertMessage]);
 }

 // Obostrano automatsko povezivanje: autor novog zahteva dobija obaveštenje
 // kada već postoji odgovarajuća ponuda, i obrnuto.
 const otherTable=listingType==='ponude'?'zahtevi':'ponude';
 const matches=await pool.query(`
  SELECT id,user_id,naslov FROM ${otherTable}
  WHERE user_id IS NOT NULL AND user_id<>$1
   AND pauziran=false AND moderacija_blokirana=false
   AND (lower(unaccent(kategorija))=lower(unaccent($2))
     OR lower(unaccent(kategorija)) LIKE lower(unaccent($2))||' / %'
     OR lower(unaccent($2)) LIKE lower(unaccent(kategorija))||' / %')
   AND (
    pretraga_uslov(concat_ws(' ', $3, $4, $2), naslov)
    OR pretraga_uslov(concat_ws(' ', naslov, opis, kategorija), $3)
   )
  ORDER BY created_at DESC LIMIT 100
 `,[listing.user_id,listing.kategorija,listing.naslov,listing.opis||'']);
 const counterpartMessage=listingType==='ponude'
  ? 'Pojavila se nova ponuda koja možda odgovara tvom objavljenom zahtevu.'
  : 'Pojavila se nova potražnja koja možda odgovara tvojoj objavljenoj ponudi.';
 for(const match of matches.rows){
  // Autor nove objave dobija link ka već postojećoj odgovarajućoj objavi.
  const ownerMessage=listingType==='zahtevi'
   ? 'Pronađena je već postojeća ponuda koja možda odgovara tvom zahtevu.'
   : 'Pronađena je već postojeća potražnja koja možda odgovara tvojoj ponudi.';
  await pool.query(`INSERT INTO ponudimi_smart_notifications(user_id,listing_type,listing_id,title,message)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,listing_type,listing_id) DO NOTHING`,
   [listing.user_id,otherTable,match.id,match.naslov,ownerMessage]);
  // Vlasnik postojeće objave dobija link ka upravo objavljenoj objavi.
  await pool.query(`INSERT INTO ponudimi_smart_notifications(user_id,listing_type,listing_id,title,message)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,listing_type,listing_id) DO NOTHING`,
   [match.user_id,listingType,listing.id,listing.naslov,counterpartMessage]);
 }
}
app.get('/api/alert-searches',auth,asyncRoute(async(req,res)=>{
 const r=await pool.query('SELECT id,query_text,category,target_type,active,created_at FROM saved_search_alerts WHERE user_id=$1 ORDER BY created_at DESC',[req.user.sub]);
 res.set('Cache-Control','private, no-store');res.json({data:r.rows});
}));
app.post('/api/alert-searches',auth,asyncRoute(async(req,res)=>{
 const queryText=normalizeAlertText(req.body?.query_text),category=normalizeAlertText(req.body?.category)||null;
 const targetType=String(req.body?.target_type||'ponude');
 if(queryText.length<2&&!category)return res.status(400).json({error:'Unesi najmanje dve reči ili izaberi kategoriju.'});
 if(!['ponude','zahtevi','oba'].includes(targetType))return res.status(400).json({error:'Izaberi ispravan tip obaveštenja.'});
 const count=await pool.query('SELECT count(*)::int n FROM saved_search_alerts WHERE user_id=$1',[req.user.sub]);
 if(count.rows[0].n>=30)return res.status(400).json({error:'Možeš sačuvati najviše 30 kriterijuma pretrage.'});
 const r=await pool.query('INSERT INTO saved_search_alerts(user_id,query_text,category,target_type) VALUES($1,$2,$3,$4) RETURNING id,query_text,category,target_type,active,created_at',[req.user.sub,queryText,category,targetType]);
 res.status(201).json({data:r.rows[0]});
}));
app.delete('/api/alert-searches/:id',auth,asyncRoute(async(req,res)=>{
 const r=await pool.query('DELETE FROM saved_search_alerts WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.sub]);
 if(!r.rowCount)return res.status(404).json({error:'Sačuvani kriterijum nije pronađen.'});
 res.json({ok:true});
}));
// Statistika pregleda oglasa i zahteva. Čuvamo samo heš posetioca, nikada sirovu IP adresu.
const ensureListingViewTable = async () => {
 await pool.query(`CREATE TABLE IF NOT EXISTS listing_view_events (
  listing_type text NOT NULL CHECK (listing_type IN ('ponude','zahtevi')),
  listing_id uuid NOT NULL,
  viewer_key text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_type, listing_id, viewer_key)
 )`);
 await pool.query('CREATE INDEX IF NOT EXISTS listing_view_events_listing_date_idx ON listing_view_events(listing_type,listing_id,viewed_at DESC)');
};
app.post('/api/listings/:type/:id/view',optionalAuth,asyncRoute(async(req,res)=>{
 const type=String(req.params.type||''),id=String(req.params.id||'');
 if(!['ponude','zahtevi'].includes(type)||! /^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Oglas nije ispravan.'});
 const found=await pool.query(`SELECT id,user_id FROM ${type} WHERE id=$1`,[id]);
 if(!found.rows[0])return res.status(404).json({error:'Oglas nije pronađen.'});
 if(req.user?.sub && found.rows[0].user_id===req.user.sub)return res.json({counted:false});
 await ensureListingViewTable();
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
 const ua=String(req.headers['user-agent']||'').slice(0,300);
 const day=new Date().toISOString().slice(0,10);
 const viewerKey=createHash('sha256').update((req.user?.sub ? 'user:'+req.user.sub : 'guest:'+ip+'|'+ua)+'|'+day).digest('hex');
 const inserted=await pool.query(`INSERT INTO listing_view_events(listing_type,listing_id,viewer_key)
  VALUES($1,$2,$3) ON CONFLICT(listing_type,listing_id,viewer_key) DO UPDATE SET viewed_at=CASE
   WHEN listing_view_events.viewed_at < now()-interval '24 hours' THEN now()
   ELSE listing_view_events.viewed_at END
  RETURNING (xmax=0) AS first_view`,[type,id,viewerKey]);
 // Poseta se broji jednom po posetiocu u periodu od 24 sata.
 const stats=await pool.query('SELECT count(*)::int AS total FROM listing_view_events WHERE listing_type=$1 AND listing_id=$2',[type,id]);
 res.set('Cache-Control','no-store');res.json({counted:Boolean(inserted.rows[0]?.first_view),total:stats.rows[0].total});
}));
app.get('/api/listings/:type/:id/stats',auth,asyncRoute(async(req,res)=>{
 const type=String(req.params.type||''),id=String(req.params.id||'');
 if(!['ponude','zahtevi'].includes(type)||! /^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Oglas nije ispravan.'});
 const found=await pool.query(`SELECT id FROM ${type} WHERE id=$1 AND user_id=$2`,[id,req.user.sub]);
 if(!found.rowCount)return res.status(404).json({error:'Statistika je dostupna samo vlasniku oglasa.'});
 await ensureListingViewTable();
 const stats=await pool.query(`SELECT count(*)::int AS ukupno,
  count(*) FILTER(WHERE viewed_at>=date_trunc('day',now()))::int AS danas,
  count(*) FILTER(WHERE viewed_at>=now()-interval '7 days')::int AS poslednjih_7_dana
  FROM listing_view_events WHERE listing_type=$1 AND listing_id=$2`,[type,id]);
 res.set('Cache-Control','private, no-store');res.json(stats.rows[0]);
}));
app.get('/api/notifications',auth,asyncRoute(async(req,res)=>{
 const r=await pool.query(`SELECT n.id,n.listing_type,n.listing_id,n.title,n.message,n.created_at,n.read_at,
  CASE WHEN n.listing_type='ponude' THEN 'ponuda' ELSE 'zahtev' END AS listing_kind
  FROM ponudimi_smart_notifications n WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 100`,[req.user.sub]);
 const unread=await pool.query('SELECT count(*)::int n FROM ponudimi_smart_notifications WHERE user_id=$1 AND read_at IS NULL',[req.user.sub]);
 res.set('Cache-Control','private, no-store');res.json({data:r.rows,unread:unread.rows[0].n});
}));
app.patch('/api/notifications/read-all',auth,asyncRoute(async(req,res)=>{
 await pool.query('UPDATE ponudimi_smart_notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL',[req.user.sub]);
 res.json({ok:true});
}));
app.patch('/api/notifications/:id/read',auth,asyncRoute(async(req,res)=>{
 const r=await pool.query('UPDATE ponudimi_smart_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.sub]);
 if(!r.rowCount)return res.status(404).json({error:'Obaveštenje nije pronađeno.'});
 res.json({ok:true});
}));

app.get('/api/maintenance-status',asyncRoute(async(req,res)=>{const result=await pool.query('SELECT enabled,message,updated_at FROM platform_maintenance WHERE singleton=true');let isAdmin=false;const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(token){try{const user=jwt.verify(token,JWT_SECRET);isAdmin=await isPlatformAdmin(user);}catch{}}res.set('Cache-Control','no-store');res.json({enabled:Boolean(result.rows[0]?.enabled),message:result.rows[0]?.message||'Platforma PonudiMi je trenutno u fazi izrade ili unapređenja. Molimo vas za strpljenje. Uskoro se vraćamo!',updated_at:result.rows[0]?.updated_at||null,isAdmin});}));
app.put('/api/admin/maintenance-mode',auth,admin,asyncRoute(async(req,res)=>{const enabled=Boolean(req.body?.enabled);const message=String(req.body?.message||'Platforma PonudiMi je trenutno u fazi izrade ili unapređenja. Molimo vas za strpljenje. Uskoro se vraćamo!').trim().slice(0,500);const result=await pool.query('INSERT INTO platform_maintenance(singleton,enabled,message,updated_by,updated_at) VALUES(true,$1,$2,$3,now()) ON CONFLICT(singleton) DO UPDATE SET enabled=EXCLUDED.enabled,message=EXCLUDED.message,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING enabled,message,updated_at',[enabled,message,req.user.sub]);res.set('Cache-Control','no-store');res.json(result.rows[0]);}));
app.post('/api/auth/reset-complete',asyncRoute(async(req,res)=>{const token=String(req.body?.token||'');const password=String(req.body?.password||'');if(password.length<8)return res.status(400).json({error:'Lozinka mora imati najmanje 8 karaktera.'});if(!/^[a-f0-9]{64}$/i.test(token))return res.status(400).json({error:'Link je istekao ili je već iskorišćen.'});const hash=createHash('sha256').update(token).digest('hex');const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query('SELECT user_id FROM password_resets WHERE token_hash=$1 AND expires_at>now() FOR UPDATE',[hash]);if(!r.rows[0]){await c.query('ROLLBACK');return res.status(400).json({error:'Link je istekao ili je već iskorišćen.'});}await c.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(password,12),r.rows[0].user_id]);await c.query('DELETE FROM password_resets WHERE user_id=$1',[r.rows[0].user_id]);const u=await c.query('SELECT * FROM users WHERE id=$1',[r.rows[0].user_id]);await c.query('COMMIT');const tokenValue=sign(u.rows[0]);const userValue=publicUser(u.rows[0]);res.json({ok:true,session:{access_token:tokenValue,token_type:'bearer',expires_in:604800,user:userValue}});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}));

app.use('/api',asyncRoute(async(req,res,next)=>{
 const p=req.path;
 if(p==='/maintenance-status'||p==='/platform-rules'||p==='/auth/login'||p==='/auth/me'||p==='/auth/reset-request'||p==='/auth/reset-complete'||p.startsWith('/admin/'))return next();
 const state=await pool.query('SELECT enabled,message FROM platform_maintenance WHERE singleton=true');
 if(!state.rows[0]?.enabled)return next();
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(token){try{const user=jwt.verify(token,JWT_SECRET);if(await isPlatformAdmin(user))return next();}catch{}}
 res.set('Cache-Control','no-store');return res.status(503).json({error:state.rows[0].message||'Platforma je privremeno na održavanju.',code:'MAINTENANCE_MODE',maintenance:true});
}));

app.use('/api/messages',rateLimit({windowMs:60*1000,limit:60,standardHeaders:true,legacyHeaders:false}));
app.use('/api/admin/messages',rateLimit({windowMs:60*1000,limit:60,standardHeaders:true,legacyHeaders:false}));
const messageName = async id => {
 const r=await pool.query("SELECT u.email,COALESCE(NULLIF(BTRIM(concat_ws(' ',p.ime,p.prezime)),''),NULLIF(p.korisnicko_ime,''),u.email) AS display_name FROM users u LEFT JOIN profiles p ON p.id=u.id WHERE u.id=$1",[id]);
 return r.rows[0]||{email:null,display_name:'Korisnik'};
};
const messageDate = value => value ? new Intl.DateTimeFormat('sr-RS',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Belgrade'}).format(new Date(value)) : 'Nije evidentirano';
const messageReason = req => String(req.body?.reason||req.query?.reason||'').trim();
const logMessageAdminAction = async (client,req,conversationId,action,reason,details={}) => {
 await client.query('INSERT INTO message_admin_audit(conversation_id,admin_id,action,reason,details) VALUES($1,$2,$3,$4,$5::jsonb)',[conversationId||null,req.user.sub,action,reason,JSON.stringify(details)]);
};
const getConversationForAdmin = async (id,client=pool) => {
 const r=await client.query("SELECT c.*,COALESCE(o.naslov,z.naslov) AS listing_title,COALESCE(o.user_id,z.user_id) AS listing_owner_id FROM message_conversations c LEFT JOIN ponude o ON c.listing_type='ponude' AND o.id=c.listing_id LEFT JOIN zahtevi z ON c.listing_type='zahtevi' AND z.id=c.listing_id WHERE c.id=$1",[id]);
 return r.rows[0]||null;
};
app.post('/api/messages/start',auth,asyncRoute(async(req,res)=>{
 const listingType=String(req.body?.listing_type||'');
 const listingId=String(req.body?.listing_id||'');
 const body=String(req.body?.message||'').trim();
 if(!['ponude','zahtevi'].includes(listingType)||! /^[0-9a-f-]{36}$/i.test(listingId)||!body||body.length>2000)return res.status(400).json({error:'Podaci poruke nisu ispravni.'});
 const listing=await pool.query('SELECT id,user_id,naslov FROM '+(listingType==='ponude'?'ponude':'zahtevi')+' WHERE id=$1 AND NOT pauziran AND NOT moderacija_blokirana',[listingId]);
 if(!listing.rows[0]||!listing.rows[0].user_id)return res.status(404).json({error:'Oglas nije pronađen ili nije dostupan.'});
 const buyerId=req.user.sub,sellerId=listing.rows[0].user_id;
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  let c=await client.query('SELECT id FROM message_conversations WHERE listing_type=$1 AND listing_id=$2 AND buyer_id=$3 AND seller_id=$4 FOR UPDATE',[listingType,listingId,buyerId,sellerId]);
  if(!c.rows[0])c=await client.query('INSERT INTO message_conversations(listing_type,listing_id,buyer_id,seller_id) VALUES($1,$2,$3,$4) ON CONFLICT(listing_type,listing_id,buyer_id,seller_id) DO UPDATE SET updated_at=now() RETURNING id',[listingType,listingId,buyerId,sellerId]);
  const conversationId=c.rows[0].id;
  await client.query('INSERT INTO message_messages(conversation_id,sender_id,body) VALUES($1,$2,$3)',[conversationId,buyerId,body]);
  await client.query('UPDATE message_conversations SET updated_at=now() WHERE id=$1',[conversationId]);
  await client.query('COMMIT');
  res.status(201).json({ok:true,conversation_id:conversationId});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.get('/api/messages',auth,asyncRoute(async(req,res)=>{
 const r=await pool.query("SELECT c.id,c.listing_type,c.listing_id,COALESCE(o.naslov,z.naslov) AS listing_title,CASE WHEN c.buyer_id=$1 THEN c.seller_id ELSE c.buyer_id END AS other_user_id,COALESCE(NULLIF(BTRIM(concat_ws(' ',op.ime,op.prezime)),''),NULLIF(op.korisnicko_ime,''),ou.email) AS other_user_name,lm.body AS last_message,lm.created_at AS last_message_at,(SELECT count(*)::int FROM message_messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.read_at IS NULL) AS unread_count FROM message_conversations c LEFT JOIN ponude o ON c.listing_type='ponude' AND o.id=c.listing_id LEFT JOIN zahtevi z ON c.listing_type='zahtevi' AND z.id=c.listing_id LEFT JOIN users ou ON ou.id=CASE WHEN c.buyer_id=$1 THEN c.seller_id ELSE c.buyer_id END LEFT JOIN profiles op ON op.id=ou.id LEFT JOIN LATERAL (SELECT body,created_at FROM message_messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) lm ON true WHERE c.buyer_id=$1 OR c.seller_id=$1 ORDER BY c.updated_at DESC LIMIT 300",[req.user.sub]);
 res.set('Cache-Control','private, no-store');res.json({data:r.rows});
}));
app.get('/api/messages/:id',auth,asyncRoute(async(req,res)=>{
 const c=await pool.query('SELECT id FROM message_conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)',[req.params.id,req.user.sub]);
 if(!c.rows[0])return res.status(404).json({error:'Razgovor nije pronađen.'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('UPDATE message_messages SET read_at=now() WHERE conversation_id=$1 AND (sender_id<>$2 OR EXISTS (SELECT 1 FROM message_conversations c WHERE c.id=$1 AND c.buyer_id=c.seller_id)) AND read_at IS NULL',[req.params.id,req.user.sub]);
  const r=await client.query('SELECT id,sender_id,body,created_at,read_at FROM message_messages WHERE conversation_id=$1 ORDER BY created_at,id',[req.params.id]);
  await client.query('COMMIT');res.set('Cache-Control','private, no-store');res.json({messages:r.rows});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.post('/api/messages/:id',auth,asyncRoute(async(req,res)=>{
 const body=String(req.body?.message||'').trim();
 if(!body||body.length>2000)return res.status(400).json({error:'Poruka mora imati između 1 i 2.000 karaktera.'});
 const c=await pool.query('SELECT id FROM message_conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)',[req.params.id,req.user.sub]);
 if(!c.rows[0])return res.status(404).json({error:'Razgovor nije pronađen.'});
 const client=await pool.connect();
 try{await client.query('BEGIN');const m=await client.query('INSERT INTO message_messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING id,sender_id,body,created_at,read_at',[req.params.id,req.user.sub,body]);await client.query('UPDATE message_conversations SET updated_at=now() WHERE id=$1',[req.params.id]);await client.query('COMMIT');res.status(201).json({data:m.rows[0]});}
 catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.get('/api/admin/messages',auth,admin,asyncRoute(async(req,res)=>{
 const q=String(req.query.q||'').trim();
 const r=await pool.query("SELECT c.id,c.listing_type,c.listing_id,c.created_at,c.updated_at,c.buyer_id,c.seller_id,COALESCE(o.naslov,z.naslov) AS listing_title,bu.email AS buyer_email,COALESCE(NULLIF(BTRIM(concat_ws(' ',bp.ime,bp.prezime)),''),NULLIF(bp.korisnicko_ime,''),bu.email) AS buyer_name,su.email AS seller_email,COALESCE(NULLIF(BTRIM(concat_ws(' ',sp.ime,sp.prezime)),''),NULLIF(sp.korisnicko_ime,''),su.email) AS seller_name,(SELECT count(*)::int FROM message_messages m WHERE m.conversation_id=c.id) AS message_count,(SELECT max(created_at) FROM message_messages m WHERE m.conversation_id=c.id) AS last_message_at FROM message_conversations c LEFT JOIN ponude o ON c.listing_type='ponude' AND o.id=c.listing_id LEFT JOIN zahtevi z ON c.listing_type='zahtevi' AND z.id=c.listing_id JOIN users bu ON bu.id=c.buyer_id LEFT JOIN profiles bp ON bp.id=bu.id JOIN users su ON su.id=c.seller_id LEFT JOIN profiles sp ON sp.id=su.id WHERE ($1='' OR concat_ws(' ',bu.email,su.email,bp.ime,bp.prezime,sp.ime,sp.prezime,o.naslov,z.naslov) ILIKE '%'||$1||'%') ORDER BY c.updated_at DESC LIMIT 500",[q]);
 res.set('Cache-Control','no-store');res.json({data:r.rows});
}));
app.post('/api/admin/messages/:id/view',auth,admin,asyncRoute(async(req,res)=>{
 const reason=messageReason(req);if(reason.length<10)return res.status(400).json({error:'Unesi opravdan razlog od najmanje 10 karaktera.'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');const c=await getConversationForAdmin(req.params.id,client);if(!c){await client.query('ROLLBACK');return res.status(404).json({error:'Razgovor nije pronađen.'});}
  await logMessageAdminAction(client,req,c.id,'view',reason);
  const m=await client.query('SELECT id,sender_id,body,created_at,read_at FROM message_messages WHERE conversation_id=$1 ORDER BY created_at,id',[c.id]);
  await client.query('COMMIT');res.set('Cache-Control','no-store');res.json({messages:m.rows});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.get('/api/admin/messages/:id/export',auth,admin,asyncRoute(async(req,res)=>{
 const reason=messageReason(req);if(reason.length<10)return res.status(400).json({error:'Unesi opravdan razlog od najmanje 10 karaktera.'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');const c=await getConversationForAdmin(req.params.id,client);if(!c){await client.query('ROLLBACK');return res.status(404).json({error:'Razgovor nije pronađen.'});}
  const m=await client.query('SELECT sender_id,body,created_at,read_at FROM message_messages WHERE conversation_id=$1 ORDER BY created_at,id',[c.id]);
  const buyer=await messageName(c.buyer_id),seller=await messageName(c.seller_id);
  const blocks=[];
  for(const row of m.rows){const sender=row.sender_id===c.buyer_id?buyer:seller;const recipient=row.sender_id===c.buyer_id?seller:buyer;blocks.push('Datum i vreme: '+messageDate(row.created_at)+'\nKo šalje: '+sender.display_name+'\n\n'+row.body+'\n\nKome se šalje: '+recipient.display_name+'\nVreme primljene poruke: '+messageDate(row.read_at));}
  const content=blocks.join('\n\n')+(blocks.length?'\n':'');
  const hash=createHash('sha256').update(content,'utf8').digest('hex');
  const fileName='ponudimi-prepiska-'+c.id+'.txt';
  const archive=await client.query("INSERT INTO message_archives(conversation_id,file_name,content,sha256,message_count,created_by,export_reason,listing_type,listing_title,buyer_name,seller_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",[c.id,fileName,content,hash,m.rows.length,req.user.sub,reason,c.listing_type,c.listing_title,buyer.display_name,seller.display_name]);
  await logMessageAdminAction(client,req,c.id,'export',reason,{archive_id:archive.rows[0].id,message_count:m.rows.length,sha256:hash});
  await client.query('COMMIT');
  res.set('Content-Type','text/plain; charset=utf-8');res.set('Content-Disposition','attachment; filename="'+fileName+'"');res.set('Cache-Control','no-store');res.send(content);
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.delete('/api/admin/messages/:conversationId/message/:messageId',auth,admin,asyncRoute(async(req,res)=>{
 const reason=messageReason(req);if(reason.length<10)return res.status(400).json({error:'Unesi razlog od najmanje 10 karaktera.'});
 const client=await pool.connect();
 try{await client.query('BEGIN');const c=await getConversationForAdmin(req.params.conversationId,client);if(!c){await client.query('ROLLBACK');return res.status(404).json({error:'Razgovor nije pronađen.'});}
 const d=await client.query('DELETE FROM message_messages WHERE id=$1 AND conversation_id=$2 RETURNING id',[req.params.messageId,c.id]);if(!d.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Poruka nije pronađena.'});}
 await logMessageAdminAction(client,req,c.id,'delete_message',reason,{message_id:req.params.messageId});await client.query('UPDATE message_conversations SET updated_at=now() WHERE id=$1',[c.id]);await client.query('COMMIT');res.json({ok:true});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.delete('/api/admin/messages/:id',auth,admin,asyncRoute(async(req,res)=>{
 const reason=messageReason(req);if(reason.length<10)return res.status(400).json({error:'Unesi razlog od najmanje 10 karaktera.'});
 const client=await pool.connect();
 try{await client.query('BEGIN');const c=await getConversationForAdmin(req.params.id,client);if(!c){await client.query('ROLLBACK');return res.status(404).json({error:'Razgovor nije pronađen.'});}
 await logMessageAdminAction(client,req,c.id,'delete_conversation',reason,{listing_id:c.listing_id,listing_type:c.listing_type});
 await client.query('DELETE FROM message_conversations WHERE id=$1',[c.id]);await client.query('COMMIT');res.json({ok:true});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.get('/api/admin/message-archives',auth,admin,asyncRoute(async(_req,res)=>{
 const r=await pool.query("SELECT a.id,a.conversation_id,a.file_name,a.sha256,a.message_count,a.export_reason,a.created_at,a.listing_type,a.listing_title,a.buyer_name,a.seller_name,u.email AS created_by_email FROM message_archives a LEFT JOIN users u ON u.id=a.created_by ORDER BY a.created_at DESC LIMIT 500");
 res.set('Cache-Control','no-store');res.json({data:r.rows});
}));
app.get('/api/admin/message-archives/:id/download',auth,admin,asyncRoute(async(req,res)=>{
 const client=await pool.connect();
 try{await client.query('BEGIN');const a=await client.query('SELECT * FROM message_archives WHERE id=$1',[req.params.id]);if(!a.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Arhiva nije pronađena.'});}
 await logMessageAdminAction(client,req,a.rows[0].conversation_id,'download_archive','Preuzimanje ranije sačuvane arhive',{archive_id:a.rows[0].id});
 await client.query('COMMIT');res.set('Content-Type','text/plain; charset=utf-8');res.set('Content-Disposition','attachment; filename="'+String(a.rows[0].file_name).replace(/[^a-zA-Z0-9._-]/g,'_')+'"');res.set('Cache-Control','no-store');res.send(a.rows[0].content);
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.delete('/api/admin/message-archives/:id',auth,admin,asyncRoute(async(req,res)=>{
 const reason=messageReason(req);if(reason.length<10)return res.status(400).json({error:'Unesi razlog od najmanje 10 karaktera.'});
 const client=await pool.connect();
 try{await client.query('BEGIN');const a=await client.query('SELECT id,conversation_id FROM message_archives WHERE id=$1',[req.params.id]);if(!a.rows[0]){await client.query('ROLLBACK');return res.status(404).json({error:'Arhiva nije pronađena.'});}
 await logMessageAdminAction(client,req,a.rows[0].conversation_id,'delete_archive',reason,{archive_id:a.rows[0].id});await client.query('DELETE FROM message_archives WHERE id=$1',[a.rows[0].id]);await client.query('COMMIT');res.json({ok:true});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));



app.get('/api/ponude',auth,asyncRoute(async(req,res)=>{res.set('Cache-Control','private, no-store');const q=String(req.query.q||'').trim();const loc=String(req.query.lokacija||'').trim();const cat=String(req.query.kategorija||'').trim();const {rows}=await pool.query(`SELECT p.*, COALESCE((SELECT json_agg(s ORDER BY s.pozicija) FROM (SELECT id,storage_path,external_url,pozicija FROM slike_oglasa WHERE ponuda_id=p.id) s),'[]') slike FROM ponude p WHERE NOT p.pauziran AND NOT p.moderacija_blokirana AND ($1='' OR unaccent(lower(concat_ws(' ',p.naslov,p.opis,p.kategorija,p.lokacija))) LIKE '%'||unaccent(lower($1))||'%') AND ($2='' OR lower(p.lokacija) LIKE '%'||lower($2)||'%') AND ($3='' OR lower(p.kategorija) LIKE '%'||lower($3)||'%') ORDER BY p.created_at DESC LIMIT 200`,[q,loc,cat]);res.json(zastitiJavneKontakte(rows,Boolean(req.user)));}));
app.get('/api/zahtevi',auth,asyncRoute(async(req,res)=>{res.set('Cache-Control','private, no-store');const q=String(req.query.q||'').trim();const loc=String(req.query.lokacija||'').trim();const {rows}=await pool.query(`SELECT * FROM zahtevi WHERE NOT pauziran AND NOT moderacija_blokirana AND ($1='' OR unaccent(lower(concat_ws(' ',naslov,opis,kategorija,lokacija))) LIKE '%'||unaccent(lower($1))||'%') AND ($2='' OR lower(lokacija) LIKE '%'||lower($2)||'%') ORDER BY created_at DESC LIMIT 200`,[q,loc]);res.json(zastitiJavneKontakte(rows,Boolean(req.user)));}));
for (const [table,amount] of [['ponude','cena'],['zahtevi','budzet']]) {
 app.post(`/api/${table}`,auth,asyncRoute(async(req,res)=>{const b=req.body||{};const required=['naslov','kategorija','lokacija'];if(required.some(k=>!String(b[k]||'').trim())||String(b.naslov).length>150||String(b.opis||'').length>3000)return res.status(400).json({error:'Proveri obavezna polja oglasa.'});const {rows}=await pool.query(`INSERT INTO ${table}(naslov,opis,kategorija,lokacija,${amount},valuta,emoji,user_id,kontakt_ime,telefon) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[b.naslov,b.opis||null,b.kategorija,b.lokacija,b[amount]??null,b.valuta||'EUR',b.emoji||null,req.user.sub,b.kontakt_ime||null,b.telefon||null]);await notifyMatchingSavedSearches(table,rows[0]);res.status(201).json(rows[0]);}));
 app.patch(`/api/${table}/:id`,auth,asyncRoute(async(req,res)=>{const allowed=['naslov','opis','kategorija','lokacija',amount,'valuta','kontakt_ime','telefon','zavrseno'];const b=req.body||{};const keys=Object.keys(b).filter(k=>allowed.includes(k));if(!keys.length)return res.status(400).json({error:'Nema izmena.'});const vals=keys.map(k=>b[k]);vals.push(req.params.id,req.user.sub);const sets=keys.map((k,i)=>`${k}=$${i+1}`).join(',');const {rows}=await pool.query(`UPDATE ${table} SET ${sets},updated_at=now() WHERE id=$${keys.length+1} AND user_id=$${keys.length+2} RETURNING *`,vals);if(!rows[0])return res.status(404).json({error:'Oglas nije pronađen ili nije vaš.'});res.json(rows[0]);}));
 app.delete(`/api/${table}/:id`,auth,asyncRoute(async(req,res)=>{const {rowCount}=await pool.query(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`,[req.params.id,req.user.sub]);if(!rowCount)return res.status(404).json({error:'Oglas nije pronađen ili nije vaš.'});res.json({ok:true});}));
}
app.put('/api/oglasi/:id/slike',auth,memoryUpload.array('fotografije',7),asyncRoute(async(req,res)=>{
 const kind=req.body?.tip==='zahtev'?'zahtev':'ponuda';
 const table=kind==='ponuda'?'ponude':'zahtevi';
 const col=kind==='ponuda'?'ponuda_id':'zahtev_id';
 const rawMeta=String(req.body?.meta||'[]');
 if(rawMeta.length>20000)return res.status(400).json({error:'Podaci o fotografijama su preveliki.'});
 let plan;
 try { plan=JSON.parse(rawMeta); } catch { return res.status(400).json({error:'Podaci o redosledu fotografija nisu ispravni.'}); }
 if(!Array.isArray(plan)||plan.length>7)return res.status(400).json({error:'Dozvoljeno je najviše 7 fotografija po oglasu.'});
 const files=req.files||[];
 const fileIndexes=new Set();
 for(const item of plan){
  if(item?.type==='existing'){
   if(typeof item.id!=='string')return res.status(400).json({error:'ID postojeće fotografije nije ispravan.'});
  } else if(item?.type==='external'){
   let url;try{url=new URL(String(item.url||''));}catch{return res.status(400).json({error:'Adresa fotografije nije ispravna.'});}
   if(!['http:','https:'].includes(url.protocol)||String(item.url).length>2048)return res.status(400).json({error:'Dozvoljene su samo ispravne HTTP/HTTPS adrese fotografija do 2.048 znakova.'});
  } else if(item?.type==='file'){
   if(!Number.isInteger(item.fileIndex)||item.fileIndex<0||item.fileIndex>=files.length||fileIndexes.has(item.fileIndex))return res.status(400).json({error:'Izabrani fajl fotografije nije ispravan.'});
   fileIndexes.add(item.fileIndex);
  } else return res.status(400).json({error:'Nepoznat tip fotografije.'});
 }
 if(fileIndexes.size!==files.length)return res.status(400).json({error:'Broj poslatih fotografija se ne poklapa sa izabranim redosledom.'});
 const c=await pool.connect(),savedKeys=[];
 try{
  await c.query('BEGIN');
  const listing=await c.query(`SELECT id,user_id FROM ${table} WHERE id=$1 AND user_id=$2 FOR UPDATE`,[req.params.id,req.user.sub]);
  if(!listing.rows[0]){await c.query('ROLLBACK');return res.status(404).json({error:'Oglas nije pronađen ili nije vaš.'});}
  const existing=await c.query(`SELECT * FROM slike_oglasa WHERE ${col}=$1 FOR UPDATE`,[req.params.id]);
  const existingById=new Map(existing.rows.map(row=>[row.id,row]));
  const keepIds=new Set();
  for(const item of plan)if(item.type==='existing'){
   if(!existingById.has(item.id)||keepIds.has(item.id)){await c.query('ROLLBACK');return res.status(400).json({error:'Fotografija više nije deo ovog oglasa ili je ponovljena.'});}
   keepIds.add(item.id);
  }
  const out=[];
  for(const [position,item] of plan.entries()){
   if(item.type==='existing'){
    const updated=await c.query('UPDATE slike_oglasa SET pozicija=$1 WHERE id=$2 RETURNING *',[position,item.id]);
    out.push(updated.rows[0]);
   } else if(item.type==='external'){
    const inserted=await c.query(`INSERT INTO slike_oglasa(${col},external_url,storage_path,pozicija) VALUES($1,$2,NULL,$3) RETURNING *`,[req.params.id,String(item.url),position]);
    out.push(inserted.rows[0]);
   } else {
    const file=files[item.fileIndex];
    const key=`${listing.rows[0].user_id}/${randomUUID()}.jpg`;
    const normalized=await normalizeImage(file.buffer);
    await saveImage(key,normalized,'image/jpeg');
    savedKeys.push(key);
    const inserted=await c.query(`INSERT INTO slike_oglasa(${col},storage_path,external_url,pozicija) VALUES($1,$2,NULL,$3) RETURNING *`,[req.params.id,`/uploads/${key}`,position]);
    out.push(inserted.rows[0]);
   }
  }
  const removed=existing.rows.filter(row=>!keepIds.has(row.id));
  if(removed.length)await c.query('DELETE FROM slike_oglasa WHERE id=ANY($1::uuid[])', [removed.map(row=>row.id)]);
  await c.query('COMMIT');
  for(const row of removed)if(row.storage_path){const parts=String(row.storage_path).split('/').filter(Boolean);if(parts[0]==='uploads')parts.shift();try{await removeImage(parts.join('/'));}catch(error){console.error('Stara fotografija nije očišćena sa skladišta:',error);}}
  res.json({data:out.sort((a,b)=>a.pozicija-b.pozicija)});
 }catch(error){
  await c.query('ROLLBACK').catch(()=>{});
  for(const key of savedKeys){try{await removeImage(key);}catch(cleanupError){console.error('Neuspelo čišćenje neuspešno sačuvane fotografije:',cleanupError);}}
  throw error;
 }finally{c.release();}
}));
app.post('/api/oglasi/:id/slike',auth,memoryUpload.array('fotografije',7),asyncRoute(async(req,res)=>{
 const kind=req.body.tip==='zahtev'?'zahtev':'ponuda';
 const table=kind==='ponuda'?'ponude':'zahtevi';
 if(!req.files?.length)return res.status(400).json({error:'Izaberite najmanje jednu fotografiju.'});
 const result=await attachListingImages({table,listingId:req.params.id,ownerId:req.user.sub,files:req.files});
 if(result.error)return res.status(result.status).json({error:result.error});
 res.status(result.status).json(result.data);
}));

app.post('/api/admin/listings/:kind/:id/images',auth,admin,memoryUpload.array('fotografije',7),asyncRoute(async(req,res)=>{
 const table=req.params.kind==='ponude'?'ponude':req.params.kind==='zahtevi'?'zahtevi':null;
 if(!table)return res.status(400).json({error:'Nepoznat tip oglasa.'});
 if(!req.files?.length)return res.status(400).json({error:'Izaberite najmanje jednu fotografiju.'});
 const result=await attachListingImages({table,listingId:req.params.id,files:req.files});
 if(result.error)return res.status(result.status).json({error:result.error});
 res.status(result.status).json(result.data);
}));
app.delete('/api/admin/images/:imageId',auth,admin,asyncRoute(async(req,res)=>{
 const found=await pool.query('SELECT * FROM slike_oglasa WHERE id=$1',[req.params.imageId]);
 if(!found.rows[0])return res.status(404).json({error:'Fotografija nije pronađena.'});
 const image=found.rows[0];
 await pool.query('DELETE FROM slike_oglasa WHERE id=$1',[req.params.imageId]);
 if(image.storage_path){
  const parts=String(image.storage_path).split('/').filter(Boolean);
  if(parts[0]==='uploads')parts.shift();
  try { await removeImage(parts.join('/')); }
  catch(error) { console.error('Fotografija je uklonjena iz oglasa, ali fajl nije očišćen:',error); }
 }
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
app.post('/api/reports',optionalAuth,asyncRoute(async(req,res)=>{
 const {tabela,oglas_id,razlog}=req.body||{};
 const allowedReasons=['sumnja_na_prevaru','netacni_podaci','neispravan_kontakt','neprimeren_sadrzaj','dupliran_oglas','ostalo'];
 if(!['ponude','zahtevi'].includes(tabela)||! /^[0-9a-f-]{36}$/i.test(String(oglas_id||''))||!allowedReasons.includes(razlog))return res.status(400).json({error:'Proveri podatke prijave.'});
 const detalji=String(req.body?.detalji||'').trim().slice(0,1000)||null;
 const listing=await pool.query(`SELECT id,user_id FROM ${tabela} WHERE id=$1`,[oglas_id]);
 if(!listing.rows[0])return res.status(404).json({error:'Oglas više ne postoji.'});
 if(req.user?.sub&&listing.rows[0].user_id===req.user.sub)return res.status(400).json({error:'Ne možeš prijaviti sopstveni oglas.'});
 try{
  const saved=await pool.query('INSERT INTO prijave_oglasa(tabela,oglas_id,prijavio_id,razlog,detalji) VALUES($1,$2,$3,$4,$5) RETURNING id,created_at',[tabela,oglas_id,req.user?.sub||null,razlog,detalji]);
  res.status(201).json({ok:true,...saved.rows[0]});
 }catch(error){if(error.code==='23505')return res.status(409).json({error:'Već postoji tvoja prijava koja čeka pregled.'});throw error;}
}));
app.get('/api/admin/reports',auth,admin,asyncRoute(async(_req,res)=>{
 const result=await pool.query(`SELECT r.*,CASE WHEN r.tabela='ponude' THEN p.naslov ELSE z.naslov END AS oglas_naslov,CASE WHEN r.tabela='ponude' THEN p.lokacija ELSE z.lokacija END AS oglas_lokacija,COALESCE(pu.email,zu.email) AS vlasnik_email,ru.email AS prijavio_email
 FROM prijave_oglasa r
 LEFT JOIN ponude p ON r.tabela='ponude' AND p.id=r.oglas_id
 LEFT JOIN zahtevi z ON r.tabela='zahtevi' AND z.id=r.oglas_id
 LEFT JOIN users pu ON pu.id=p.user_id
 LEFT JOIN users zu ON zu.id=z.user_id
 LEFT JOIN users ru ON ru.id=r.prijavio_id
 ORDER BY CASE WHEN r.status='na_cekanju' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 500`);
 res.json(result.rows);
}));
app.post('/api/admin/reports/:id/decision',auth,admin,asyncRoute(async(req,res)=>{
  const status=String(req.body?.status||'');
  if(!['pregledano','odbijeno','oglas_uklonjen','vracen_u_prikaz'].includes(status))return res.status(400).json({error:'Izaberi ispravan status prijave.'});
  const note=String(req.body?.napomena||'').trim().slice(0,1000)||null;
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const found=await c.query('SELECT * FROM prijave_oglasa WHERE id=$1 FOR UPDATE',[req.params.id]);
   const report=found.rows[0];
   if(!report){await c.query('ROLLBACK');return res.status(404).json({error:'Prijava nije pronađena.'});}
   const allowedTransition=(status==='vracen_u_prikaz'&&report.status==='oglas_uklonjen')||
     (status==='oglas_uklonjen'&&report.status==='na_cekanju')||
     (['pregledano','odbijeno'].includes(status)&&report.status==='na_cekanju');
   if(!allowedTransition){await c.query('ROLLBACK');return res.status(409).json({error:'Prijava je već obrađena ili promena statusa nije dozvoljena.'});}
   if(status==='oglas_uklonjen'||status==='vracen_u_prikaz'){
     const table=report.tabela==='ponude'?'ponude':'zahtevi';
     const updatedListing=await c.query('UPDATE '+table+' SET moderacija_blokirana=$1 WHERE id=$2 RETURNING id',[status==='oglas_uklonjen',report.oglas_id]);
     if(!updatedListing.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Oglas više ne postoji.'});}
   }
   const updated=await c.query('UPDATE prijave_oglasa SET status=$1,admin_napomena=$2,odlucio_id=$3,odluceno_at=now() WHERE id=$4 RETURNING *',[status,note,req.user.sub,req.params.id]);
   await c.query('COMMIT');
   res.json(updated.rows[0]);
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}));
app.get('/api/admin/stats',auth,admin,asyncRoute(async(_req,res)=>{
 const queries=await Promise.all([
  pool.query('SELECT count(*)::int AS total,count(*) FILTER (WHERE tip_lica=\'fizicko\')::int AS fizicka,count(*) FILTER (WHERE tip_lica=\'pravno\')::int AS pravna,count(*) FILTER (WHERE created_at>=now()-interval \'7 days\')::int AS novih_7d,count(*) FILTER (WHERE created_at>=now()-interval \'30 days\')::int AS novih_30d FROM profiles'),
  pool.query('SELECT count(*)::int AS total,count(*) FILTER (WHERE NOT pauziran AND NOT zavrseno)::int AS aktivne,count(*) FILTER (WHERE created_at>=now()-interval \'7 days\')::int AS novih_7d,count(*) FILTER (WHERE created_at>=now()-interval \'30 days\')::int AS novih_30d FROM ponude'),
  pool.query('SELECT count(*)::int AS total,count(*) FILTER (WHERE NOT pauziran AND NOT zavrseno)::int AS aktivni,count(*) FILTER (WHERE created_at>=now()-interval \'7 days\')::int AS novi_7d,count(*) FILTER (WHERE created_at>=now()-interval \'30 days\')::int AS novi_30d FROM zahtevi')
 ]);
 res.json({korisnici:queries[0].rows[0],ponude:queries[1].rows[0],zahtevi:queries[2].rows[0],azurirano_at:new Date().toISOString()});
}));
app.get('/api/admin/profiles',auth,admin,asyncRoute(async(_req,res)=>{const {rows}=await pool.query('SELECT p.*,u.email FROM profiles p JOIN users u ON u.id=p.id ORDER BY p.created_at DESC');res.json(rows);}));
app.get('/api/admin/support',auth,admin,asyncRoute(async(_req,res)=>{const {rows}=await pool.query('SELECT * FROM poruke_podrske ORDER BY created_at DESC');res.json(rows);}));

// Data API used by the existing React screens through the standalone client adapter.
const TABLE_COLUMNS = {
 ponude: ['id','naslov','opis','kategorija','lokacija','cena','valuta','emoji','istaknuto','status_trgovca','zavrseno','pauziran','user_id','kontakt_ime','telefon','created_at','updated_at'],
 zahtevi: ['id','naslov','opis','kategorija','lokacija','budzet','valuta','status_trgovca','zavrseno','pauziran','user_id','kontakt_ime','telefon','created_at','updated_at'],
 profiles: ['id','ime','prezime','korisnicko_ime','status_trgovca','telefon','grad','adresa','tip_lica','naziv_firme','pib','firma_verifikovana','firma_status_verifikacije','blokiran','email','created_at','last_active_at'],
 user_roles: ['id','user_id','role'],
 pracenja: ['id','user_id','ponuda_id','zahtev_id','pocetna_cena','pocetni_budzet','created_at'],
 slike_oglasa: ['id','ponuda_id','zahtev_id','storage_path','external_url','pozicija','created_at'],
 izmene_oglasa: ['id','oglas_id','tabela','opis','created_at'],
 poruke_podrske: ['id','ime','email','poruka','created_at'],
 apr_firme: ['pib','maticni_broj','naziv','sediste','adresa','status','synced_at'],
 apr_sinhronizacije: ['id','pokrenuo','broj_firmi','uspeh','poruka','created_at'],
};
const WRITE_COLUMNS = {
 ponude: ['naslov','opis','kategorija','lokacija','cena','valuta','emoji','kontakt_ime','telefon','zavrseno','pauziran','user_id','istaknuto'],
 zahtevi: ['naslov','opis','kategorija','lokacija','budzet','valuta','kontakt_ime','telefon','zavrseno','pauziran','user_id'],
 profiles: ['ime','prezime','korisnicko_ime','status_trgovca','telefon','grad','adresa','tip_lica','naziv_firme','pib','firma_verifikovana','blokiran','email'],
 user_roles: ['user_id','role'], pracenja: ['user_id','ponuda_id','zahtev_id','pocetna_cena','pocetni_budzet'],
 slike_oglasa: ['ponuda_id','zahtev_id','storage_path','external_url','pozicija'],
 poruke_podrske: ['ime','email','poruka'],
 apr_firme: ['pib','maticni_broj','naziv','sediste','adresa','status','synced_at'],
 apr_sinhronizacije: ['pokrenuo','broj_firmi','uspeh','poruka'],
};
const ident = value => { if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error('Neispravno ime polja.'); return `"${value}"`; };
const ownsImage = async (row,userId) => {
 if (row.ponuda_id) return (await pool.query('SELECT 1 FROM ponude WHERE id=$1 AND user_id=$2',[row.ponuda_id,userId])).rowCount>0;
 if (row.zahtev_id) return (await pool.query('SELECT 1 FROM zahtevi WHERE id=$1 AND user_id=$2',[row.zahtev_id,userId])).rowCount>0;
 return false;
};
const cleanupListingFiles = async (table, ids) => { if(!ids.length)return;const col=table==='ponude'?'ponuda_id':'zahtev_id';const {rows}=await pool.query(`SELECT storage_path FROM slike_oglasa WHERE ${col}=ANY($1::uuid[]) AND storage_path IS NOT NULL`,[ids]);for(const row of rows){const parts=String(row.storage_path).split('/').filter(Boolean);if(parts[0]==='uploads')parts.shift();await removeImage(parts.join('/'));} };
app.post('/api/db/query', optionalAuth, asyncRoute(async(req,res)=>{
 const {table,action='select',values,filters=[],orders=[],limit,offset,single,count,or}=req.body||{};
 if(!['select','insert','update','delete'].includes(action)) return res.status(400).json({error:'Nepoznata ili nedozvoljena operacija.'});
 const columns=TABLE_COLUMNS[table]; if(!columns) return res.status(400).json({error:'Nepoznata tabela.'});
 const supplied=Array.isArray(values)?values:[values||{}];
 const userId=req.user?.sub || null; const adminUser=userId ? await isPlatformAdmin(req.user) : false;
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
 for(const item of supplied) {
   if(table==='user_roles' && action==='insert' && !['admin','moderator','user'].includes(String(item?.role||''))) return res.status(400).json({error:'Nepoznata korisnička uloga.'});
   for(const key of Object.keys(item||{})) {
   if(!columns.includes(key) || ['id','created_at','updated_at'].includes(key)) return res.status(400).json({error:`Polje ${key} nije dozvoljeno za izmenu.`});
   if(action!=='select' && !(WRITE_COLUMNS[table]||[]).includes(key) && !(adminUser && (table==='ponude'||table==='zahtevi'||table==='profiles'))) return res.status(400).json({error:`Polje ${key} ne može da se menja.`});
   }
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
 if(table==='slike_oglasa' && write)return res.status(403).json({error:'Fotografije se menjaju kroz bezbednu sinhronizaciju oglasa.'});
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
     row.user_id=userId;const sellerStatus=await pool.query('SELECT status_trgovca FROM profiles WHERE id=$1',[userId]);row.status_trgovca=sellerStatus.rows[0]?.status_trgovca||'nepotvrdjeno';if(table==='ponude')row.istaknuto=false;
     if(!String(row.naslov||'').trim()||String(row.naslov).trim().length<3||String(row.naslov).length>150||!String(row.kategorija||'').trim()||String(row.kategorija).length>100||String(row.lokacija||'').trim().length<2||String(row.lokacija).length>100||String(row.kontakt_ime||'').trim().length<2||String(row.kontakt_ime).length>100||! /^[+0-9 ()-]{6,30}$/.test(String(row.telefon||''))||String(row.opis||'').length>3000|| (row[amountField]!==null&&row[amountField]!==undefined&&(!Number.isFinite(Number(row[amountField]))||Number(row[amountField])<0)) || !['EUR','RSD'].includes(row.valuta||'EUR')) return res.status(400).json({error:'Podaci oglasa nisu ispravni. Proveri naslov, kategoriju, lokaciju, kontakt i cenu/budžet.'});
   }
   if(action==='update'&&!adminUser) for(const row of supplied){delete row.user_id;delete row.istaknuto;delete row.status_trgovca;}
   if(action==='update'&&!adminUser){
     const idFilter=(filters||[]).find(f=>f.column==='id'&&f.op==='eq');if(!idFilter)return res.status(400).json({error:'Izmena oglasa zahteva ID oglasa.'});
     const current=await pool.query(`SELECT * FROM ${table} WHERE id=$1 AND user_id=$2`,[idFilter.value,userId]);if(!current.rows[0])return res.status(404).json({error:'Oglas nije pronađen ili nije vaš.'});
     const merged={...current.rows[0],...(supplied[0]||{})};
     if(String(merged.naslov||'').trim().length<3||String(merged.naslov).length>150||!String(merged.kategorija||'').trim()||String(merged.lokacija||'').trim().length<2||String(merged.lokacija).length>100||String(merged.kontakt_ime||'').trim().length<2||String(merged.kontakt_ime).length>100||! /^[+0-9 ()-]{6,30}$/.test(String(merged.telefon||''))||String(merged.opis||'').length>3000||(merged[amountField]!==null&&merged[amountField]!==undefined&&(!Number.isFinite(Number(merged[amountField]))||Number(merged[amountField])<0)))return res.status(400).json({error:'Izmenjeni podaci oglasa nisu ispravni.'});
   }
 }
 if(table==='profiles' && action==='update') for(const row of supplied){if(row.status_trgovca!==undefined&&!['trgovac','nije_trgovac','nepotvrdjeno'].includes(String(row.status_trgovca)))return res.status(400).json({error:'Status prodavca nije ispravan.'});}
  if(table==='profiles' && action==='update' && !adminUser) for(const row of supplied){if(row.status_trgovca!==undefined&&!['trgovac','nije_trgovac'].includes(String(row.status_trgovca)))return res.status(400).json({error:'Status prodavca nije ispravan.'});delete row.blokiran;delete row.firma_verifikovana;delete row.email;delete row.id;if(row.tip_lica==='pravno'&&row.naziv_firme!==undefined&&!String(row.naziv_firme||'').trim())return res.status(400).json({error:'Unesi naziv firme.'});}
 const whereSql=where.length?` WHERE ${where.join(' AND ')}`:'';
 let result;
 if(action==='select'){
   const orderSql=(orders||[]).filter(o=>columns.includes(o.column)).map(o=>`${ident(o.column)} ${o.ascending===false?'DESC':'ASC'}`).join(',');
   const publicListing=(table==='ponude'||table==='zahtevi')&&!adminUser;
   let lim=Number.isInteger(limit)?Math.max(0,Math.min(limit,500)):500; const off=Number.isInteger(offset)?Math.max(0,Math.min(offset,10000000)):0;
   if(publicListing && !userId){
     const idOnlyLookup=(filters||[]).length===1 && filters[0].column==='id' && filters[0].op==='eq' && !or;
     const homepagePreview=(filters||[]).length===0 && !or;
     if(idOnlyLookup)lim=Math.min(lim,1);
     else if(homepagePreview)lim=Math.min(lim,5);
     else return res.status(401).json({error:'Prijava je obavezna za pretragu oglasa.'});
     if(count==='exact')return res.status(401).json({error:'Prijava je obavezna za pretragu oglasa.'});
   }
   let publicListingWhere='';
   if(publicListing){
     if(userId){params.push(userId);const ownerParam='$'+params.length;publicListingWhere=whereSql?` AND ((pauziran=false AND moderacija_blokirana=false) OR user_id=${ownerParam})`:` WHERE ((pauziran=false AND moderacija_blokirana=false) OR user_id=${ownerParam})`;}
     else publicListingWhere=whereSql?' AND pauziran=false AND moderacija_blokirana=false':' WHERE pauziran=false AND moderacija_blokirana=false';
   }
   const sql=`SELECT * FROM ${ident(table)}${whereSql}${publicListingWhere}${orderSql?` ORDER BY ${orderSql}`:''} LIMIT ${lim} OFFSET ${off}`;
   const {rows}=await pool.query(sql,params); let data=(table==='ponude'||table==='zahtevi')?zastitiJavneKontakte(rows,Boolean(userId)):rows;
   if(count==='exact'){const countSql=`SELECT count(*)::int n FROM ${ident(table)}${whereSql}${publicListingWhere}`;const counted=await pool.query(countSql,params);result={data,count:counted.rows[0].n};}else result={data};
 } else if(action==='insert'||action==='upsert'){
   const inserted=[];
   for(const row of supplied){const keys=Object.keys(row||{});if(!keys.length)continue;const vals=keys.map(k=>row[k]);const sql=`INSERT INTO ${ident(table)} (${keys.map(ident).join(',')}) VALUES (${vals.map((_,i)=>"$"+(i+1)).join(',')}) RETURNING *`;const r=await pool.query(sql,vals);inserted.push(r.rows[0]);if((table==='ponude'||table==='zahtevi')&&r.rows[0])await notifyMatchingSavedSearches(table,r.rows[0]);}
   result={data:Array.isArray(values)?inserted:inserted[0]||null};
 } else if(action==='update'){
   const row=supplied[0]||{};const keys=Object.keys(row);if(!keys.length)return res.json({data:[]});const vals=keys.map(k=>row[k]);const sets=keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(',');const updateWhere=where.map(w=>w.replace(/\$(\d+)/g,(_m,n)=>`$${Number(n)+vals.length}`)).join(' AND ');const all=[...vals,...params];const r=await pool.query(`UPDATE ${ident(table)} SET ${sets}${updateWhere?` WHERE ${updateWhere}`:''} RETURNING *`,all);if(table==='profiles'&&r.rows[0]){let updated=r.rows;if(!adminUser){const v=await pool.query(`UPDATE profiles SET firma_verifikovana=(tip_lica='pravno' AND pib IS NOT NULL AND EXISTS(SELECT 1 FROM apr_firme f WHERE f.pib=profiles.pib)) WHERE id=$1 RETURNING *`,[userId]);updated=v.rows;}const profile=updated[0];if(profile?.status_trgovca){await pool.query('UPDATE ponude SET status_trgovca=$1 WHERE user_id=$2',[profile.status_trgovca,profile.id]);await pool.query('UPDATE zahtevi SET status_trgovca=$1 WHERE user_id=$2',[profile.status_trgovca,profile.id]);}result={data:updated};}else result={data:r.rows};
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
 if(fn==='has_role'){const role=String(args._role||'admin');if(!['admin','moderator','user'].includes(role))return res.json({data:false});if(role==='admin')return res.json({data:!!(userId&&await isPlatformAdmin(req.user))});const r=userId?await pool.query('SELECT 1 FROM user_roles WHERE user_id=$1 AND role=$2',[userId,role]):{rowCount:0};return res.json({data:!!r.rowCount});}
 if(fn==='pretrazi_ponude'||fn==='pretrazi_zahteve'){
  if(!userId)return res.status(401).json({error:'Prijava je obavezna za pretragu oglasa.'});
  const table=fn==='pretrazi_ponude'?'ponude':'zahtevi';
  const amount=table==='ponude'?'cena':'budzet';
  const term=String(args.q||'').trim().slice(0,200), mesto=String(args.mesto||'').trim().slice(0,100);
  const kategorija=String(args.kategorija||'').trim().slice(0,100), valuta=String(args.valuta||'').trim().toUpperCase();
  const minRaw=String(args.minCena??'').trim(), maxRaw=String(args.maxCena??'').trim();
  const minCena=minRaw===''?null:Number(minRaw), maxCena=maxRaw===''?null:Number(maxRaw), sort=String(args.sort||'najnovije');
  if(minCena!==null&&(!Number.isFinite(minCena)||minCena<0))return res.status(400).json({error:'Minimalna cena nije ispravna.'});
  if(maxCena!==null&&(!Number.isFinite(maxCena)||maxCena<0))return res.status(400).json({error:'Maksimalna cena nije ispravna.'});
  if(minCena!==null&&maxCena!==null&&minCena>maxCena)return res.status(400).json({error:'Minimalna cena ne može biti veća od maksimalne.'});
  if(valuta&&!['EUR','RSD'].includes(valuta))return res.status(400).json({error:'Izabrana valuta nije podržana.'});
  if((minCena!==null||maxCena!==null)&&!valuta)return res.status(400).json({error:'Izaberi valutu za precizno filtriranje cene.'});
  const orderBy={najnovije:'created_at DESC',najstarije:'created_at ASC',cena_rastuce:'CASE WHEN '+amount+' IS NULL THEN 1 ELSE 0 END ASC, '+amount+' ASC, created_at DESC',cena_opadajuce:'CASE WHEN '+amount+' IS NULL THEN 1 ELSE 0 END ASC, '+amount+' DESC, created_at DESC'}[sort]||'created_at DESC';
  const sql='SELECT * FROM '+table+' WHERE pauziran=false AND moderacija_blokirana=false AND pretraga_uslov(concat_ws(\' \',naslov,opis,kategorija,lokacija),$1) AND pretraga_uslov(lokacija,$2) AND ($3=\'\' OR pretraga_uslov(kategorija,$3)) AND ($4::numeric IS NULL OR '+amount+'>=$4) AND ($5::numeric IS NULL OR '+amount+'<=$5) AND ($6=\'\' OR valuta=$6) ORDER BY '+orderBy+' LIMIT 200';
  const {rows}=await pool.query(sql,[term,mesto,kategorija,minCena,maxCena,valuta]);return res.json({data:zastitiJavneKontakte(rows,Boolean(userId))});
 }
 return res.status(400).json({error:'Nepoznata funkcija.'});
}));
app.post('/api/storage/upload',auth,memoryUpload.single('file'),asyncRoute(async(req,res)=>{
 const requested=safeObjectKey(req.body.path);if(!req.file)return res.status(400).json({error:'Fotografija nije poslata.'});
 if(!requested.startsWith(`${req.user.sub}/`))return res.status(403).json({error:'Nedozvoljena putanja fotografije.'});
 const key=requested;
 const normalized=await normalizeImage(req.file.buffer);
 await saveImage(key,normalized,'image/jpeg');res.status(201).json({path:key,storage:s3?'r2':filesystemStorage?'local':'postgres',width:800,height:600,format:'jpeg'});
}));
app.post('/api/storage/remove',auth,asyncRoute(async(req,res)=>{
 const paths=Array.isArray(req.body?.paths)?req.body.paths:[];for(const item of paths){const rawKey=safeObjectKey(item);const key=rawKey.startsWith('uploads/')?rawKey.slice('uploads/'.length):rawKey;if(!key.startsWith(`${req.user.sub}/`))continue;await removeImage(key);}res.json({ok:true});
}));
app.get('/api/storage/public',asyncRoute(async(req,res)=>{
 const key=safeObjectKey(req.query.path);if(!key)return res.status(400).end();
 if(s3){const object=await s3.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));res.setHeader('Content-Type',object.ContentType||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=86400');object.Body.pipe(res);}
  else {const stored=await pool.query('SELECT content_type,body FROM storage_objects WHERE object_key=$1',[key]);if(stored.rows[0]){res.setHeader('Content-Type',stored.rows[0].content_type);res.setHeader('Cache-Control','public, max-age=31536000, immutable');return res.send(stored.rows[0].body);}const root=path.resolve(uploadDir),target=path.resolve(root,key);if(!target.startsWith(root+path.sep))return res.status(404).end();res.setHeader('Cache-Control','public, max-age=31536000, immutable');return res.type('image/jpeg').sendFile(target,error=>{if(error&&!res.headersSent)res.status(error.statusCode===404?404:500).end();});}
}));
app.get('/uploads/*filepath',asyncRoute(async(req,res)=>{const parts=req.params.filepath;const key=safeObjectKey(Array.isArray(parts)?parts.join('/'):parts);if(!key)return res.status(404).end();const stored=await pool.query('SELECT content_type,body FROM storage_objects WHERE object_key=$1',[key]);if(stored.rows[0]){res.setHeader('Content-Type',stored.rows[0].content_type);res.setHeader('Cache-Control','public, max-age=31536000, immutable');return res.send(stored.rows[0].body);}if(s3){const object=await s3.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));res.setHeader('Content-Type',object.ContentType||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=31536000, immutable');return object.Body.pipe(res);}const root=path.resolve(uploadDir),target=path.resolve(root,key);if(!target.startsWith(root+path.sep))return res.status(404).end();res.setHeader('Cache-Control','public, max-age=31536000, immutable');return res.type('image/jpeg').sendFile(target,error=>{if(error&&!res.headersSent)res.status(error.statusCode===404?404:500).end();});}));
app.put('/api/admin/users/:id/profile',(req,res,next)=>{req.adminProfileDiagnosticId=randomUUID();res.on('finish',()=>console.info('[ADMIN_PROFILE_SAVE_REQUEST]',JSON.stringify({diagnostic_id:req.adminProfileDiagnosticId,target_user_id:req.params.id||null,admin_user_id:req.user?.sub||null,status:res.statusCode,method:req.method})));next();},auth,admin,asyncRoute(async(req,res)=>{
 const diagnosticId=req.adminProfileDiagnosticId;
 const allowed=['ime','prezime','korisnicko_ime','email','telefon','grad','adresa','tip_lica','naziv_firme','pib','status_trgovca','firma_verifikovana','firma_status_verifikacije'];
 const input=req.body&&typeof req.body==='object'?req.body:{};
 const keys=Object.keys(input);
 console.info('[ADMIN_PROFILE_SAVE_BEGIN]',JSON.stringify({diagnostic_id:diagnosticId,target_user_id:req.params.id,admin_user_id:req.user?.sub||null,field_names:keys}));
 if(!keys.length||keys.some(key=>!allowed.includes(key)))return res.status(400).json({error:'Podaci profila nisu ispravni.'});
 const patch={...input};
 if(patch.email!==undefined){patch.email=String(patch.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email))return res.status(400).json({error:'Unesi ispravnu email adresu.'});}
 if(patch.korisnicko_ime!==undefined){patch.korisnicko_ime=String(patch.korisnicko_ime||'').trim().toLowerCase();if(!patch.korisnicko_ime||[...patch.korisnicko_ime].length>20)return res.status(400).json({error:'Korisničko ime može imati najviše 20 karaktera.'});}
 if(patch.tip_lica!==undefined&&!['fizicko','pravno'].includes(patch.tip_lica))return res.status(400).json({error:'Vrsta naloga nije ispravna.'});
 if(patch.status_trgovca!==undefined&&!['trgovac','nije_trgovac','nepotvrdjeno'].includes(patch.status_trgovca))return res.status(400).json({error:'Status prodavca nije ispravan.'});
 if(patch.firma_status_verifikacije!==undefined&&!['na_cekanju','verifikovana','odbijena'].includes(patch.firma_status_verifikacije))return res.status(400).json({error:'Status verifikacije firme nije ispravan.'});
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const before=await c.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE',[req.params.id]);
  if(!before.rows[0]){await c.query('ROLLBACK');return res.status(404).json({error:'Korisnički nalog nije pronađen.'});}
  if(patch.email!==undefined){
   const duplicate=await c.query('SELECT id FROM users WHERE lower(email)=lower($1) AND id<>$2',[patch.email,req.params.id]);
   if(duplicate.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'Ova email adresa je već povezana sa drugim nalogom.'});}
   await c.query('UPDATE users SET email=$1 WHERE id=$2',[patch.email,req.params.id]);
  }
  if(patch.korisnicko_ime!==undefined){
   const duplicate=await c.query('SELECT id FROM profiles WHERE lower(korisnicko_ime)=lower($1) AND id<>$2',[patch.korisnicko_ime,req.params.id]);
   if(duplicate.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'Ovo korisničko ime je već zauzeto.'});}
  }
  if(patch.firma_status_verifikacije!==undefined)patch.firma_verifikovana=patch.firma_status_verifikacije==='verifikovana';
  const sets=Object.keys(patch).map((key,index)=>'"'+key+'"=$'+(index+1)).join(',');
  const values=Object.values(patch);
  const updated=await c.query('UPDATE profiles SET '+sets+' WHERE id=$'+(values.length+1)+' RETURNING *',[...values,req.params.id]);
  if(!updated.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Korisnički nalog nije pronađen.'});}
  await c.query(`CREATE TABLE IF NOT EXISTS admin_audit_logs(id bigserial PRIMARY KEY,admin_user_id uuid NOT NULL,target_user_id uuid NOT NULL,action text NOT NULL,before_data jsonb NOT NULL,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`);
  await c.query('INSERT INTO admin_audit_logs(admin_user_id,target_user_id,action,before_data,after_data) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)',[req.user.sub,req.params.id,'izmena_profila',JSON.stringify(before.rows[0]),JSON.stringify(updated.rows[0])]);
  await c.query('COMMIT');
  res.json({data:updated.rows[0]});
 }catch(error){console.error('[ADMIN_PROFILE_SAVE_ERROR]',JSON.stringify({diagnostic_id:diagnosticId,target_user_id:req.params.id,admin_user_id:req.user?.sub||null,error_code:error?.code||null,constraint:error?.constraint||null}));await c.query('ROLLBACK');throw error;}finally{c.release();}
}));
app.delete('/api/admin/users/:id',auth,admin,asyncRoute(async(req,res)=>{if(req.params.id===req.user.sub)return res.status(400).json({error:'Ne možete obrisati sopstveni nalog.'});const c=await pool.connect();try{await c.query('BEGIN');const p=await c.query('SELECT id FROM ponude WHERE user_id=$1',[req.params.id]);const z=await c.query('SELECT id FROM zahtevi WHERE user_id=$1',[req.params.id]);await cleanupListingFiles('ponude',p.rows.map(x=>x.id));await cleanupListingFiles('zahtevi',z.rows.map(x=>x.id));await c.query('DELETE FROM izmene_oglasa WHERE oglas_id IN (SELECT id FROM ponude WHERE user_id=$1 UNION ALL SELECT id FROM zahtevi WHERE user_id=$1)',[req.params.id]);await c.query('DELETE FROM ponude WHERE user_id=$1',[req.params.id]);await c.query('DELETE FROM zahtevi WHERE user_id=$1',[req.params.id]);await c.query('DELETE FROM users WHERE id=$1',[req.params.id]);await c.query('COMMIT');res.json({ok:true});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}));

async function ucitajKatalogPaketa() {
 const result=await pool.query('SELECT slug,naziv,cena_eur,trajanje_meseci,opis,pogodnosti,objavljen,pozicija,updated_at,max_artikala FROM business_package_catalog ORDER BY pozicija,slug');
 return result.rows;
}
app.get('/api/business-packages',asyncRoute(async(_req,res)=>{
 const result=await pool.query("SELECT slug,naziv,cena_eur,trajanje_meseci,opis,pogodnosti,max_artikala FROM business_package_catalog WHERE objavljen=true ORDER BY pozicija,slug");
 res.set('Cache-Control','no-store');res.json({data:result.rows});
}));
app.get('/api/admin/business-package-catalog',auth,admin,asyncRoute(async(_req,res)=>{res.json({data:await ucitajKatalogPaketa()});}));
app.put('/api/admin/business-package-catalog',auth,admin,asyncRoute(async(req,res)=>{
 const items=Array.isArray(req.body?.packages)?req.body.packages:[];
 const allowed=['light','average','advanced','total'];
 if(items.length!==4||allowed.some(slug=>!items.some(item=>item.slug===slug)))return res.status(400).json({error:'Potrebna su sva četiri paketa: Light, Average, Advanced i Total.'});
 for(const item of items){const price=Number(item.cena_eur),months=Number(item.trajanje_meseci),name=String(item.naziv||'').trim();const capacity=Number(item.max_artikala);if(!name||!Number.isFinite(price)||price<0||price>100000||!Number.isInteger(months)||months<1||months>36||!Number.isInteger(capacity)||capacity<1||capacity>1000000)return res.status(400).json({error:'Proveri naziv, cenu, trajanje i kapacitet svakog paketa.'});}
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  for(const item of items){
   const slug=String(item.slug),naziv=String(item.naziv||'').trim().slice(0,40);
   const cena=Number(item.cena_eur),months=Number(item.trajanje_meseci);
   const opis=String(item.opis||'').trim().slice(0,2000);
   const pogodnosti=Array.isArray(item.pogodnosti)?item.pogodnosti.map(x=>String(x).trim().slice(0,180)).filter(Boolean).slice(0,12):[];
   await c.query('UPDATE business_package_catalog SET naziv=$2,cena_eur=$3,trajanje_meseci=$4,opis=$5,pogodnosti=$6,objavljen=$7,max_artikala=$8,updated_at=now() WHERE slug=$1',[slug,naziv,cena,months,opis,pogodnosti,Boolean(item.objavljen),Number(item.max_artikala)]);
  }
  await c.query('COMMIT');res.json({data:await ucitajKatalogPaketa(),poruka:'Ponuda paketa je sačuvana.'});
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}));
app.get('/api/admin/business-firms',auth,admin,asyncRoute(async(req,res)=>{
 const q=String(req.query.q||'').trim().slice(0,100).replace(/[%_\\\\]/g,'');
 const params=[];let where="p.tip_lica='pravno'"+(APR_VERIFICATION_REQUIRED?" AND p.firma_verifikovana=true":"");
 if(q){params.push('%'+q+'%');where+=" AND (p.naziv_firme ILIKE $1 OR p.pib ILIKE $1 OR p.email ILIKE $1)";}
 const r=await pool.query(`SELECT p.id AS user_id,p.naziv_firme,p.pib,p.email,p.telefon,p.firma_verifikovana FROM profiles p WHERE ${where} ORDER BY p.naziv_firme NULLS LAST LIMIT 100`,params);
 res.json({data:r.rows});
}));
app.get('/api/admin/business-packages',auth,admin,asyncRoute(async(_req,res)=>{
 await pool.query("UPDATE paketi_firmi SET status='istekao',updated_at=now() WHERE status='aktivan' AND vazi_do<=(now() AT TIME ZONE 'Europe/Belgrade')::date");
 const r=await pool.query(`SELECT k.*,p.naziv_firme,p.pib,p.email,p.telefon,p.firma_verifikovana FROM paketi_firmi k JOIN profiles p ON p.id=k.user_id ORDER BY CASE WHEN k.status='aktivan' THEN 0 ELSE 1 END,k.vazi_do ASC,k.created_at DESC LIMIT 300`);
 res.json({data:r.rows});
}));
app.post('/api/admin/business-packages',auth,admin,asyncRoute(async(req,res)=>{
 const userId=String(req.body?.user_id||'');
 const code=String(req.body?.paket||'');
 const payment=String(req.body?.status_uplate||'ceka_uplatu');
 const note=String(req.body?.napomena||'').trim().slice(0,1000);
 const reference=String(req.body?.referenca_uplate||'').trim().slice(0,120);
 const catalog=await pool.query('SELECT slug,naziv,cena_eur,trajanje_meseci FROM business_package_catalog WHERE slug=$1 AND objavljen=true',[code]);
 const selected=catalog.rows[0]||null;
 if(!userId||!selected)return res.status(400).json({error:'Izaberi firmu i objavljen paket.'});
 if(!['ceka_uplatu','placeno','oslobodjeno'].includes(payment))return res.status(400).json({error:'Status uplate nije ispravan.'});
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const firm=await c.query("SELECT id,tip_lica,firma_verifikovana FROM profiles WHERE id=$1 FOR UPDATE",[userId]);
  if(!firm.rows[0]||firm.rows[0].tip_lica!=='pravno'){await c.query('ROLLBACK');return res.status(400).json({error:'Paket mogu dobiti samo registrovana pravna lica.'});}
  if(APR_VERIFICATION_REQUIRED && !firm.rows[0].firma_verifikovana){await c.query('ROLLBACK');return res.status(400).json({error:'Firma prvo mora biti verifikovana u APR evidenciji.'});}
  // Administratorska dodela uvek odmah aktivira paket. Status uplate ostaje
  // samo evidencioni podatak i nikada ne blokira pristup korisnika.
  await c.query("UPDATE paketi_firmi SET status='otkazan',updated_at=now() WHERE user_id=$1 AND status='aktivan'",[userId]);
  const result=await c.query(`INSERT INTO paketi_firmi(user_id,paket,cena_eur,status,status_uplate,vazi_od,vazi_do,napomena,referenca_uplate,kreirao_id)
   VALUES($1,$2,$3,'aktivan',$4,(now() AT TIME ZONE 'Europe/Belgrade')::date,((now() AT TIME ZONE 'Europe/Belgrade')::date + ($5::text || ' months')::interval)::date,$6,$7,$8) RETURNING *`,
   [userId,code,selected.cena_eur,payment,selected.trajanje_meseci,note||null,reference||null,req.user.sub]);
  await c.query('COMMIT');res.status(201).json({data:result.rows[0],poruka:`Paket je odmah aktiviran. Status uplate: ${payment==='placeno'?'plaćeno':payment==='oslobodjeno'?'oslobođeno plaćanja':'čeka uplatu'}.`});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
app.post('/api/admin/business-packages/:id/cancel',auth,admin,asyncRoute(async(req,res)=>{
 const r=await pool.query("UPDATE paketi_firmi SET status='otkazan',updated_at=now() WHERE id=$1 AND status IN ('aktivan','na_cekanju') RETURNING id",[req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:'Aktivan paket nije pronađen.'});
 res.json({ok:true});
}));
app.post('/api/admin/business-packages/:id/reactivate',auth,admin,asyncRoute(async(req,res)=>{
 const durationDays=Number(req.body?.duration_days);
 if(!Number.isInteger(durationDays)||durationDays<1||durationDays>3650)return res.status(400).json({error:'Period mora biti ceo broj dana između 1 i 3650.'});
 const r=await pool.query(`UPDATE paketi_firmi SET status='aktivan',vazi_od=(now() AT TIME ZONE 'Europe/Belgrade')::date,vazi_do=((now() AT TIME ZONE 'Europe/Belgrade')::date + ($2::int * interval '1 day'))::date,email_podsetnik_poslat_at=NULL,email_podsetnik_greska=NULL,updated_at=now() WHERE id=$1 RETURNING id,vazi_od,vazi_do,status`,[req.params.id,durationDays]);
 if(!r.rowCount)return res.status(404).json({error:'Evidencija paketa nije pronađena.'});
 res.json({ok:true,data:r.rows[0],message:`Paket je aktiviran na ${durationDays} dana.`});
}));
app.delete('/api/admin/business-packages/:id',auth,admin,asyncRoute(async(req,res)=>{
 const r=await pool.query('DELETE FROM paketi_firmi WHERE id=$1 RETURNING id',[req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:'Evidencija paketa nije pronađena.'});
 res.json({ok:true,message:'Evidencija paketa je trajno obrisana.'});
}));

app.get('/api/admin/access-grants/users',auth,admin,asyncRoute(async(req,res)=>{
 const q=String(req.query.q||'').trim().slice(0,120).replace(/[%_\\\\]/g,'');
 const params=[];let where='';
 if(q){params.push('%'+q+'%');where="WHERE (u.email ILIKE $1 OR p.email ILIKE $1 OR p.ime ILIKE $1 OR p.prezime ILIKE $1 OR p.naziv_firme ILIKE $1 OR p.pib ILIKE $1 OR p.korisnicko_ime ILIKE $1)";}
 const r=await pool.query(`SELECT u.id AS user_id,coalesce(p.email,u.email) AS email,p.ime,p.prezime,p.naziv_firme,p.pib,p.tip_lica FROM users u LEFT JOIN profiles p ON p.id=u.id ${where} ORDER BY coalesce(p.naziv_firme,p.prezime,p.ime,u.email) LIMIT 100`,params);
 res.json({data:r.rows});
}));
app.get('/api/admin/access-grants',auth,admin,asyncRoute(async(_req,res)=>{
 await pool.query("UPDATE user_access_grants SET status='istekao' WHERE status='aktivan' AND vazi_do<=now()");
 const r=await pool.query(`SELECT g.*,coalesce(p.email,u.email) AS email,p.ime,p.prezime,p.naziv_firme,p.tip_lica FROM user_access_grants g JOIN users u ON u.id=g.user_id LEFT JOIN profiles p ON p.id=u.id WHERE g.status NOT IN ('otkazan','istekao') ORDER BY g.created_at DESC LIMIT 500`);
 res.json({data:r.rows});
}));
app.post('/api/admin/access-grants',auth,admin,asyncRoute(async(req,res)=>{
 const userId=String(req.body?.user_id||'');
 const packageName=String(req.body?.package_name||'').trim().slice(0,80);
 const days=Number(req.body?.duration_days);
 const gratis=Boolean(req.body?.gratis);
 const price=gratis?0:Number(req.body?.cena_eur);
 const note=String(req.body?.napomena||'').trim().slice(0,1000);
 if(!userId||packageName.length<2||!Number.isInteger(days)||days<1||days>3650||!Number.isFinite(price)||price<0||price>100000)return res.status(400).json({error:'Proveri korisnika, naziv paketa, trajanje i cenu.'});
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const user=await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  if(!user.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Korisnički nalog nije pronađen.'});}
  await c.query("UPDATE user_access_grants SET status='zamenjen' WHERE user_id=$1 AND status='aktivan'",[userId]);
  const result=await c.query(`INSERT INTO user_access_grants(user_id,package_name,duration_days,gratis,cena_eur,status,vazi_od,vazi_do,napomena,kreirao_id)
   VALUES($1,$2,$3,$4,$5,'aktivan',now(),now()+make_interval(days => $3),$6,$7) RETURNING *`,
   [userId,packageName,days,gratis,price,note||null,req.user.sub]);
  const grant=result.rows[0];
  const enriched=await c.query(`SELECT g.*,coalesce(p.email,u.email) AS email,p.ime,p.prezime,p.naziv_firme,p.tip_lica
   FROM user_access_grants g JOIN users u ON u.id=g.user_id LEFT JOIN profiles p ON p.id=u.id WHERE g.id=$1`,[grant.id]);
  await c.query('COMMIT');
  res.status(201).json({data:enriched.rows[0]||grant,poruka:gratis?'Gratis period je aktiviran i upisan u evidenciju korisnika.':'Paket je aktiviran i upisan u evidenciju korisnika.'});
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}));
app.post('/api/admin/access-grants/:id/cancel',auth,admin,asyncRoute(async(req,res)=>{
 const r=await pool.query("UPDATE user_access_grants SET status='otkazan' WHERE id=$1 AND status='aktivan' RETURNING id",[req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:'Aktivna dodela nije pronađena.'});
 res.json({ok:true});
}));

app.post('/api/admin/apr-sync',auth,admin,asyncRoute(async(req,res)=>{
 const url=process.env.APR_API_URL,key=process.env.APR_API_KEY;if(!url||!key)return res.status(503).json({error:'APR_API_URL i APR_API_KEY nisu podešeni.'});
 try{const response=await fetch(url,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});if(!response.ok)throw new Error(`APR je vratio status ${response.status}`);const body=await response.json();const list=Array.isArray(body)?body:(body.data||[]);let n=0;
  for(const f of list){const pib=String(f.pib||'').replace(/\D/g,'');const naziv=String(f.naziv||'').trim();if(!/^\d{9}$/.test(pib)||!naziv)continue;await pool.query(`INSERT INTO apr_firme(pib,maticni_broj,naziv,sediste,adresa,status,synced_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(pib) DO UPDATE SET maticni_broj=EXCLUDED.maticni_broj,naziv=EXCLUDED.naziv,sediste=EXCLUDED.sediste,adresa=EXCLUDED.adresa,status=EXCLUDED.status,synced_at=now()`,[pib,f.maticni_broj||null,naziv,f.sediste||null,f.adresa||null,f.status||null]);n++;}
  await pool.query(`UPDATE profiles SET firma_verifikovana=EXISTS(SELECT 1 FROM apr_firme f WHERE f.pib=profiles.pib), firma_status_verifikacije=CASE WHEN EXISTS(SELECT 1 FROM apr_firme f WHERE f.pib=profiles.pib) THEN 'verifikovana' WHEN firma_status_verifikacije='odbijena' THEN 'odbijena' ELSE 'na_cekanju' END WHERE tip_lica=$1`,['pravno']);await pool.query('INSERT INTO apr_sinhronizacije(pokrenuo,broj_firmi,uspeh,poruka) VALUES($1,$2,true,$3)',[req.user.sub,n,`Sinhronizovano ${n} firmi.`]);res.json({ok:true,broj:n,poruka:`Sinhronizovano ${n} firmi.`});
 }catch(e){await pool.query('INSERT INTO apr_sinhronizacije(pokrenuo,broj_firmi,uspeh,poruka) VALUES($1,0,false,$2)',[req.user.sub,e.message]);throw e;}
}));


let packageReminderRunning=false;
async function sendBusinessPackageReminders(){
 if(packageReminderRunning)return;
 packageReminderRunning=true;
 try{
  await pool.query("UPDATE paketi_firmi SET status='istekao',updated_at=now() WHERE status='aktivan' AND vazi_do<=(now() AT TIME ZONE 'Europe/Belgrade')::date");
  if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS)return;
  const due=await pool.query(`SELECT k.id,k.vazi_do,p.email,p.naziv_firme FROM paketi_firmi k JOIN profiles p ON p.id=k.user_id
   WHERE k.status='aktivan' AND k.email_podsetnik_poslat_at IS NULL
   AND k.vazi_do=(now() AT TIME ZONE 'Europe/Belgrade')::date + 10
   AND p.email IS NOT NULL AND p.email<>'' ORDER BY k.vazi_do LIMIT 100`);
  if(!due.rowCount)return;
  const nodemailer=(await import('nodemailer')).default;
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  for(const item of due.rows){
   try{
    const date=new Date(item.vazi_do).toLocaleDateString('sr-RS',{timeZone:'Europe/Belgrade'});
    await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:item.email,subject:'PonudiMi — paket ističe za 10 dana',
     text:`Poštovani, paket za firmu ${item.naziv_firme||''} ističe za 10 dana, dana ${date}. Obratite se administratoru platforme radi produženja.`,
     html:`<p>Poštovani,</p><p>Paket za firmu <strong>${String(item.naziv_firme||'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}</strong> ističe za 10 dana, dana <strong>${date}</strong>.</p><p>Obratite se administratoru platforme radi produženja.</p><p>PonudiMi</p>`});
    await pool.query('UPDATE paketi_firmi SET email_podsetnik_poslat_at=now(),email_podsetnik_greska=NULL WHERE id=$1',[item.id]);
   }catch(error){await pool.query('UPDATE paketi_firmi SET email_podsetnik_greska=$2 WHERE id=$1',[item.id,String(error?.message||error).slice(0,500)]);}
  }
  await transport.close();
 }catch(error){console.error('Podsetnici za istek paketa nisu poslati:',error);}
 finally{packageReminderRunning=false;}
}

app.use((err,_req,res,_next)=>{
 console.error(err);
 if(err instanceof multer.MulterError){
  const status=err.code==='LIMIT_FILE_SIZE'?413:400;
  return res.status(status).json({error:err.code==='LIMIT_FILE_SIZE'?'Fotografija može imati najviše 20 MB.':err.code==='LIMIT_FILE_COUNT'?'Možeš dodati najviše 7 fotografija po oglasu.':'Podaci o fotografiji nisu ispravni.'});
 }
 if(/Dozvoljeni su samo JPG, PNG i WebP formati/.test(String(err?.message||'')))return res.status(400).json({error:err.message});
 res.status(500).json({error:process.env.NODE_ENV==='production'?'Greška na serveru.':err.message});
});
const port=Number(process.env.PORT||process.env.API_PORT||4000);
async function startServer(){
 const schemaPath=path.resolve(__dirname,'../db/init.sql');
 const schema=await readFile(schemaPath,'utf8');
 await pool.query(schema);
 const { registerBusinessCatalog } = await import('./business-catalog.mjs');
 await registerBusinessCatalog({ app, pool, auth, asyncRoute, memoryUpload, normalizeImage, saveImage, removeImage });
 registerBackupExport({ app, pool, auth, admin, s3, s3Bucket: process.env.S3_BUCKET, uploadDir, repoRoot: path.resolve(__dirname, '../..'), storageBackend: s3 ? 'r2' : filesystemStorage ? 'filesystem' : 'postgres' });
 console.log('PonudiMi poslovni katalog je spreman.');
 console.log('PonudiMi PostgreSQL šema je uspešno proverena/inicijalizovana.');
  console.log('PonudiMi skladište fotografija: '+(s3?'r2':filesystemStorage?'filesystem':'postgres')+'.');
 await pool.query("UPDATE paketi_firmi SET status='istekao',updated_at=now() WHERE status='aktivan' AND vazi_do<=CURRENT_DATE");
 app.listen(port,'0.0.0.0',()=>{
  void sendBusinessPackageReminders();
  const reminderTimer=setInterval(()=>void sendBusinessPackageReminders(),6*60*60*1000);reminderTimer.unref();
  console.log(`PonudiMi API sluša na ${port}`);

 });
}
startServer().catch(err=>{console.error('Pokretanje PonudiMi API-ja nije uspelo:',err);process.exit(1);});
