import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from './build-data.mjs';

const URL='https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip';

function run(cmd,args){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{stdio:'inherit'});
    p.on('error',reject); p.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} encerrou com código ${code}`)));
  });
}

async function download(url,file){
  console.log(`Baixando base oficial do TSE:\n${url}`);
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 ColinhaEleitoral/2.0','Accept':'application/zip,application/octet-stream,*/*'}});
  if(!res.ok) throw new Error(`TSE respondeu HTTP ${res.status} ao baixar a base.`);
  const buf=Buffer.from(await res.arrayBuffer()); await fs.writeFile(file,buf); console.log(`Download concluído: ${(buf.length/1024/1024).toFixed(1)} MB`);
}

async function extract(zip,dest){
  await fs.mkdir(dest,{recursive:true});
  if(process.platform==='win32'){
    const escaped=s=>s.replace(/'/g,"''");
    await run('powershell',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${escaped(zip)}' -DestinationPath '${escaped(dest)}' -Force`]);
  } else {
    await run('unzip',['-oq',zip,'-d',dest]);
  }
}

async function main(){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'colinha-tse-'));
  const zip=path.join(tmp,'consulta_cand_2026.zip'); const extracted=path.join(tmp,'csv');
  try{ await download(URL,zip); await extract(zip,extracted); await build(extracted,path.join(root,'data')); }
  finally{ await fs.rm(tmp,{recursive:true,force:true}); }
}
main().catch(e=>{console.error('\nFalha ao sincronizar dados do TSE:',e.message||e);process.exit(1);});
