import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip';
const RELEVANT = new Set(['1','3','5','6','7','8']);

function parseLine(line){
  const out=[]; let cur=''; let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    } else if(ch===';' && !quoted){out.push(cur);cur='';}
    else cur+=ch;
  }
  out.push(cur); return out;
}

async function csvFiles(dir){
  const found=[];
  async function walk(p){
    for(const ent of await fs.readdir(p,{withFileTypes:true})){
      const full=path.join(p,ent.name);
      if(ent.isDirectory()) await walk(full);
      else if(ent.name.toLowerCase().endsWith('.csv') && /consulta_cand_2026/i.test(ent.name)) found.push(full);
    }
  }
  await walk(dir); return found;
}

function clean(v){return String(v??'').trim();}
function recordFrom(row, idx){
  const get=(name)=>clean(row[idx.get(name)]);
  return {
    uf:get('SG_UF'), cargo:get('CD_CARGO'), n:get('NR_CANDIDATO'), u:get('NM_URNA_CANDIDATO'),
    f:get('NM_CANDIDATO'), p:get('SG_PARTIDO'), pn:get('NM_PARTIDO'), sq:get('SQ_CANDIDATO'), s:get('DS_SITUACAO_CANDIDATURA'),
    generationDate:get('DT_GERACAO'), generationTime:get('HH_GERACAO')
  };
}

export async function build(inputDir, outputDir){
  const files=await csvFiles(inputDir);
  if(!files.length) throw new Error('Nenhum consulta_cand_2026_*.csv encontrado no diretório extraído.');
  // Alguns ZIPs do TSE podem trazer o mesmo registro em mais de um CSV (por exemplo,
  // arquivo consolidado + arquivo por UF). Guardar por SQ_CANDIDATO evita sugestões duplicadas.
  const packs=new Map(); let latestGeneration='';
  const decoder=new TextDecoder('windows-1252');

  for(const file of files){
    const text=decoder.decode(await fs.readFile(file));
    const lines=text.split(/\r?\n/).filter(Boolean); if(lines.length<2) continue;
    const header=parseLine(lines[0]); const idx=new Map(header.map((h,i)=>[clean(h),i]));
    for(const required of ['ANO_ELEICAO','SG_UF','CD_CARGO','SQ_CANDIDATO','NR_CANDIDATO','NM_URNA_CANDIDATO','SG_PARTIDO']){
      if(!idx.has(required)) throw new Error(`Campo ${required} ausente em ${path.basename(file)}`);
    }
    for(let i=1;i<lines.length;i++){
      const row=parseLine(lines[i]);
      const year=clean(row[idx.get('ANO_ELEICAO')]); if(year!=='2026') continue;
      const cargo=clean(row[idx.get('CD_CARGO')]); if(!RELEVANT.has(cargo)) continue;
      const rec=recordFrom(row,idx); if(!rec.uf||!rec.n||!rec.sq) continue;
      const key=`${rec.uf}:${rec.cargo}`;
      if(!packs.has(key)) packs.set(key,new Map());
      packs.get(key).set(rec.sq,{n:rec.n,u:rec.u,f:rec.f,p:rec.p,pn:rec.pn,sq:rec.sq,s:rec.s});
      if(rec.generationDate){ latestGeneration=`${rec.generationDate}${rec.generationTime?` ${rec.generationTime}`:''}`; }
    }
  }

  await fs.mkdir(outputDir,{recursive:true});
  const generatedAt=new Date().toISOString();
  let total=0;
  for(const [key,candidateMap] of packs){
    const [uf,cargo]=key.split(':');
    const candidates=[...candidateMap.values()]; total+=candidates.length;
    candidates.sort((a,b)=>a.n.localeCompare(b.n,'pt-BR',{numeric:true}) || a.u.localeCompare(b.u,'pt-BR'));
    const payload={uf,cargo:Number(cargo),generatedAt:latestGeneration||null,c:candidates};
    const js=`window.__TSE_DATA__=window.__TSE_DATA__||{};window.__TSE_DATA__[${JSON.stringify(key)}]=${JSON.stringify(payload)};\n`;
    await fs.writeFile(path.join(outputDir,`${uf}-${cargo}.js`),js,'utf8');
  }
  const status={syncedAt:generatedAt,generatedAt:latestGeneration||null,source:'Tribunal Superior Eleitoral — Portal de Dados Abertos',sourceUrl:SOURCE_URL,totalCandidates:total,packages:packs.size};
  await fs.writeFile(path.join(outputDir,'status.js'),`window.__TSE_STATUS__=${JSON.stringify(status,null,2)};\n`,'utf8');
  console.log(`Gerados ${packs.size} pacotes com ${total} registros de candidaturas.`);
  console.log(`Geração informada no CSV: ${latestGeneration||'não informada'}`);
  return status;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const input=process.argv[2], output=process.argv[3]||path.resolve('data');
  if(!input){console.error('Uso: node scripts/build-data.mjs <pasta-com-csv> [pasta-saida]');process.exit(2);}
  build(path.resolve(input),path.resolve(output)).catch(e=>{console.error(e.stack||e.message||e);process.exit(1);});
}
