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

async function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

async function download(url,file){
  console.log(`Baixando base oficial do TSE:\n${url}`);
  let lastError=null;
  for(let attempt=1; attempt<=5; attempt++){
    try{
      const res=await fetch(url,{
        redirect:'follow',
        headers:{
          'User-Agent':'Mozilla/5.0 ColinhaEleitoral/4.0',
          'Accept':'application/zip,application/octet-stream,*/*',
          'Cache-Control':'no-cache'
        }
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf=Buffer.from(await res.arrayBuffer());
      if(buf.length<4 || buf[0]!==0x50 || buf[1]!==0x4b) throw new Error('resposta recebida não parece ser um ZIP');
      await fs.writeFile(file,buf);
      console.log(`Download concluído: ${(buf.length/1024/1024).toFixed(1)} MB`);
      return;
    }catch(e){
      lastError=e;
      console.warn(`Tentativa ${attempt}/5 falhou: ${e.message||e}`);
      if(attempt<5) await sleep(attempt*3000);
    }
  }
  throw new Error(`Não foi possível baixar a base do TSE após 5 tentativas: ${lastError?.message||lastError}`);
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
