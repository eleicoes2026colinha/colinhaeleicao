import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import sharp from 'sharp';

const YEAR=2026;
const UFS=['AC','AL','AM','AP','BA','BR','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const BASE='https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos';
const UA='Mozilla/5.0 ColinhaEleitoral/3.0';
const CONCURRENCY=Math.max(1,Math.min(6,Number(process.env.PHOTO_SYNC_CONCURRENCY||4)));

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{stdio:'inherit'});
    p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} encerrou com código ${code}`)));
  });
}
async function exists(p){try{await fs.access(p);return true}catch{return false}}
async function readJson(p,fallback={}){try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return fallback}}
async function walk(dir){
  const out=[];
  async function rec(p){for(const e of await fs.readdir(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())await rec(f);else out.push(f)}}
  await rec(dir);return out;
}
async function pool(items,limit,fn){
  let i=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const n=i++;if(n>=items.length)return;await fn(items[n],n)}});await Promise.all(workers);
}
function zipUrl(uf){return `${BASE}/foto_cand${YEAR}_${uf}_div.zip`;}
async function remoteMeta(url){
  try{
    const r=await fetch(url,{method:'HEAD',headers:{'User-Agent':UA,'Accept':'application/zip,*/*'}});
    if(!r.ok) return null;
    return {etag:r.headers.get('etag')||'',modified:r.headers.get('last-modified')||'',length:r.headers.get('content-length')||''};
  }catch{return null;}
}
function sameMeta(a,b){return !!(a&&b&&(a.etag||a.modified||a.length)&&a.etag===b.etag&&a.modified===b.modified&&a.length===b.length);}
async function download(url,file){
  const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'application/zip,application/octet-stream,*/*'}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const buf=Buffer.from(await r.arrayBuffer());await fs.writeFile(file,buf);return buf.length;
}
function sqFromFilename(file,uf){
  const name=path.basename(file);
  let m=name.match(new RegExp(`^F${uf}(\\d+)_div\\.(?:jpe?g|png)$`,'i'));
  if(m)return m[1];
  m=name.match(/(\d{9,15})/);return m?m[1]:'';
}
async function syncUf({uf,wanted,root,meta}){
  const outDir=path.join(root,'photos',uf);
  const url=zipUrl(uf);const rmeta=await remoteMeta(url);const old=meta[uf]||null;
  const hasExisting=await exists(outDir);
  if(hasExisting && sameMeta(old?.source,rmeta)){
    console.log(`[fotos ${uf}] sem alteração no pacote oficial.`);return {uf,skipped:true,meta:old};
  }
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),`tse-photo-${uf}-`));
  try{
    const zip=path.join(tmp,`${uf}.zip`),extracted=path.join(tmp,'extracted'),built=path.join(tmp,'built');
    const bytes=await download(url,zip);console.log(`[fotos ${uf}] pacote ${(bytes/1024/1024).toFixed(1)} MB`);
    await fs.mkdir(extracted,{recursive:true});await run('unzip',['-oq',zip,'-d',extracted]);await fs.mkdir(built,{recursive:true});
    const files=(await walk(extracted)).filter(f=>/\.(?:jpe?g|png)$/i.test(f));
    let made=0;
    await pool(files,8,async file=>{
      const sq=sqFromFilename(file,uf);if(!sq||!wanted.has(sq))return;
      try{
        await sharp(file).rotate().resize(180,240,{fit:'cover',position:'centre',withoutEnlargement:false}).webp({quality:80,effort:4}).toFile(path.join(built,`${sq}.webp`));
        made++;
      }catch(e){console.warn(`[fotos ${uf}] falha em ${path.basename(file)}: ${e.message}`);}
    });
    if(made===0) throw new Error(`nenhuma foto relevante encontrada no pacote ${uf}`);
    await fs.rm(outDir,{recursive:true,force:true});await fs.mkdir(path.dirname(outDir),{recursive:true});await fs.rename(built,outDir);
    console.log(`[fotos ${uf}] ${made} miniaturas locais geradas.`);
    return {uf,skipped:false,meta:{source:rmeta||{},syncedAt:new Date().toISOString(),count:made,url}};
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
}

async function main(){
  const root=path.resolve(process.cwd());
  const manifest=await readJson(path.join(root,'data','photo-manifest.json'),null);
  if(!manifest?.ufs)throw new Error('data/photo-manifest.json não encontrado. Execute primeiro a sincronização de candidaturas.');
  const metaPath=path.join(root,'.cache','tse-photo-meta.json');await fs.mkdir(path.dirname(metaPath),{recursive:true});
  const meta=await readJson(metaPath,{});
  const selected=(process.env.PHOTO_UFS||'').trim()?process.env.PHOTO_UFS.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean):UFS;
  const jobs=selected.filter(uf=>manifest.ufs[uf]?.length).map(uf=>({uf,wanted:new Set(manifest.ufs[uf].map(String)),root,meta}));
  console.log(`Sincronizando fotos oficiais para ${jobs.length} unidade(s), concorrência ${CONCURRENCY}.`);
  const results=[];await pool(jobs,CONCURRENCY,async job=>{try{results.push(await syncUf(job))}catch(e){console.error(`[fotos ${job.uf}] ${e.message}`);if(!(await exists(path.join(root,'photos',job.uf))))throw e;}});
  for(const r of results)if(r?.meta)meta[r.uf]=r.meta;
  await fs.writeFile(metaPath,JSON.stringify(meta,null,2),'utf8');
}
main().catch(e=>{console.error('\nFalha ao sincronizar fotos do TSE:',e.stack||e.message||e);process.exit(1)});
