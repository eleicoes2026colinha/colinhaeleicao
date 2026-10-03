(() => {
  'use strict';

  const YEAR = 2026;
  const ELECTION_ID = '20322002026';
  const PHOTO_BASE = `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${ELECTION_ID}`;
  const STORAGE_KEY = 'minha-colinha-eleitoral-2026-tse-v2';

  const UFS = [
    ['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']
  ];

  const CARGOS = [
    {id:'depFederal', order:1, label:'Deputado(a) Federal', short:'Deputado Federal', digits:4, cargo:6, scope:'uf'},
    {id:'depEstadual', order:2, label:'Deputado(a) Estadual / Distrital', short:'Deputado Estadual', digits:5, cargo:7, scope:'uf'},
    {id:'senador1', order:3, label:'Senador(a) — 1ª vaga', short:'Senador 1', digits:3, cargo:5, scope:'uf'},
    {id:'senador2', order:4, label:'Senador(a) — 2ª vaga', short:'Senador 2', digits:3, cargo:5, scope:'uf'},
    {id:'governador', order:5, label:'Governador(a)', short:'Governador', digits:2, cargo:3, scope:'uf'},
    {id:'presidente', order:6, label:'Presidente da República', short:'Presidente', digits:2, cargo:1, scope:'br'}
  ];

  const el = {
    uf: document.querySelector('#uf'), cards: document.querySelector('#cards'), preview: document.querySelector('#screenPreview'),
    printSheet: document.querySelector('#printSheet'), sourceDot: document.querySelector('#sourceDot'), sourceTitle: document.querySelector('#sourceTitle'), sourceDetail: document.querySelector('#sourceDetail'),
    printBtn: document.querySelector('#printBtn'), clearBtn: document.querySelector('#clearBtn'), backupBtn: document.querySelector('#backupBtn'), backupFile: document.querySelector('#backupFile')
  };

  let state = loadState();
  let loadToken = 0;

  function loadState(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return raw && typeof raw === 'object' ? {uf:raw.uf || '', votes:raw.votes || {}} : {uf:'', votes:{}};
    } catch { return {uf:'', votes:{}}; }
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function cargoCode(cfg, uf){ return cfg.id === 'depEstadual' && uf === 'DF' ? 8 : cfg.cargo; }
  function dataKey(cfg, uf){ return cfg.scope === 'br' ? 'BR:1' : `${uf}:${cargoCode(cfg,uf)}`; }
  function photoUrl(candidate, cfg){
    if(!candidate?.sq) return '';
    const photoUf = cfg.scope === 'br' ? 'BR' : state.uf;
    return `${PHOTO_BASE}/${encodeURIComponent(candidate.sq)}/${photoUf}`;
  }
  function hasVote(v){ return !!(v && (v.number || v.candidate)); }
  function meaningfulStatus(s=''){ const t=String(s).trim(); return t && !t.startsWith('#') ? t : ''; }
  function statusWarn(s=''){ return /(INDEFER|RENÚN|FALEC|CANCEL|INAPTO|NÃO CONCORR|NAO CONCORR)/i.test(s); }
  function safeText(v=''){ return String(v); }

  function populateUf(){
    for(const [code,name] of UFS){ const o=document.createElement('option'); o.value=code; o.textContent=`${code} — ${name}`; el.uf.appendChild(o); }
    el.uf.value = state.uf || '';
  }

  function renderCards(){
    el.cards.innerHTML = CARGOS.map(cfg => {
      const vote = state.votes[cfg.id] || {};
      const candidate = vote.candidate || null;
      const img = candidate ? photoUrl(candidate,cfg) : '';
      return `<article class="vote-card" data-id="${cfg.id}">
        <div class="order">${cfg.order}</div>
        <div class="photo-frame" data-photo>
          ${img ? `<img src="${img}" alt="Foto de ${escapeAttr(candidate.u || '')}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=&quot;photo-empty&quot;>Foto indisponível</span>'">` : '<span class="photo-empty">Foto do<br>candidato</span>'}
        </div>
        <div class="vote-main">
          <div class="vote-topline"><div class="vote-title">${cfg.label}</div><div class="digit-help">${cfg.digits} dígitos</div></div>
          <div class="number-field"><input class="number-input" data-number inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="${cfg.digits}" value="${escapeAttr(vote.number || '')}" placeholder="${'•'.repeat(cfg.digits)}" aria-label="Número para ${cfg.label}"></div>
          <div class="candidate-info" data-info>${candidateInfoHtml(candidate)}</div>
          <div data-matches></div>
        </div>
      </article>`;
    }).join('');

    el.cards.querySelectorAll('.vote-card').forEach(card => {
      const cfg = CARGOS.find(x=>x.id===card.dataset.id);
      const input = card.querySelector('[data-number]');
      input.addEventListener('input', () => onNumberInput(cfg, card, input));
    });
    validateSenate();
  }

  function candidateInfoHtml(c){
    if(!c) return '<div class="lookup-message">Digite o número completo para identificar a candidatura.</div>';
    const status = meaningfulStatus(c.s);
    return `<div class="candidate-name">${escapeHtml(c.u || 'Nome não informado')}</div>
      <div class="candidate-meta"><span>${escapeHtml(c.p || 'Partido não informado')}</span>${status ? `<span class="candidate-status ${statusWarn(status)?'warn':''}">${escapeHtml(status)}</span>`:''}</div>`;
  }

  async function onNumberInput(cfg, card, input){
    const number = input.value.replace(/\D/g,'').slice(0,cfg.digits);
    input.value = number;
    state.votes[cfg.id] = {number, candidate:null};
    saveState();
    updateCardPhoto(card,null,cfg);
    card.querySelector('[data-info]').innerHTML = number.length ? `<div class="lookup-message">${number.length < cfg.digits ? `Faltam ${cfg.digits-number.length} dígito(s).` : 'Consultando os dados sincronizados do TSE…'}</div>` : '<div class="lookup-message">Digite o número completo para identificar a candidatura.</div>';
    card.querySelector('[data-matches]').innerHTML='';
    updatePreview();
    validateSenate();
    if(number.length !== cfg.digits) return;
    await resolveCandidate(cfg, card, number);
  }

  async function resolveCandidate(cfg, card, number){
    if(!state.uf && cfg.scope === 'uf'){
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">Selecione sua UF primeiro.</div>'; return;
    }
    const key = dataKey(cfg,state.uf);
    try { await ensureData(key); }
    catch {
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">A base deste cargo ainda não está disponível. Execute a sincronização do TSE no projeto.</div>'; return;
    }
    const pack = window.__TSE_DATA__?.[key];
    const matches = (pack?.c || []).filter(c => String(c.n) === number);
    if(!matches.length){
      state.votes[cfg.id] = {number,candidate:null}; saveState();
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">Número não encontrado na base sincronizada. Confira o número ou atualize os dados do TSE.</div>';
      updatePreview(); return;
    }
    if(matches.length === 1){ selectCandidate(cfg,card,number,matches[0]); return; }
    // Substituições ou registros distintos podem reutilizar o mesmo número ao longo do processo.
    card.querySelector('[data-info]').innerHTML='<div class="lookup-message">Há mais de um registro com esse número. Selecione o nome que deseja conferir.</div>';
    const box=card.querySelector('[data-matches]');
    box.innerHTML=`<div class="multi-match">${matches.map((c,i)=>`<button type="button" data-match="${i}"><strong>${escapeHtml(c.u||'Sem nome')}</strong> · ${escapeHtml(c.p||'')}</button>`).join('')}</div>`;
    box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>selectCandidate(cfg,card,number,matches[Number(btn.dataset.match)])));
  }

  function selectCandidate(cfg,card,number,candidate){
    state.votes[cfg.id]={number,candidate}; saveState();
    card.querySelector('[data-info]').innerHTML=candidateInfoHtml(candidate);
    card.querySelector('[data-matches]').innerHTML='';
    updateCardPhoto(card,candidate,cfg); updatePreview(); validateSenate();
  }

  function updateCardPhoto(card,candidate,cfg){
    const frame=card.querySelector('[data-photo]');
    if(!candidate){frame.innerHTML='<span class="photo-empty">Foto do<br>candidato</span>';return;}
    const url=photoUrl(candidate,cfg); const img=document.createElement('img');
    img.src=url; img.alt=`Foto de ${candidate.u||'candidato'}`; img.loading='lazy';
    img.addEventListener('error',()=>{frame.innerHTML='<span class="photo-empty">Foto indisponível</span>';});
    frame.innerHTML=''; frame.appendChild(img);
  }

  function validateSenate(){
    const a=state.votes.senador1?.candidate, b=state.votes.senador2?.candidate;
    const card=el.cards.querySelector('[data-id="senador2"] [data-info]');
    if(a && b && String(a.sq)===String(b.sq) && card){ card.innerHTML='<div class="lookup-message error">Os dois votos para o Senado devem ser em candidaturas diferentes.</div>'; }
  }

  function renderPaper(target){
    const rows=CARGOS.map(cfg=>{
      const vote=state.votes[cfg.id]||{}; const c=vote.candidate; const number=vote.number||''; const digits=[];
      for(let i=0;i<cfg.digits;i++) digits.push(`<span class="digit-box">${escapeHtml(number[i]||'')}</span>`);
      const p=c?photoUrl(c,cfg):'';
      return `<div class="paper-row">
        ${p?`<img class="paper-photo" src="${p}" alt="">`:'<div class="paper-photo empty">FOTO</div>'}
        <div><div class="paper-cargo">${escapeHtml(cfg.short)}</div><div class="paper-name">${escapeHtml(c?.u||'—')}</div><div class="paper-party">${escapeHtml(c?.p||'')}</div></div>
        <div class="digit-boxes">${digits.join('')}</div>
      </div>`;
    }).join('');
    target.innerHTML=`<div class="paper-head"><strong>MINHA COLINHA ELEITORAL — 2026</strong><small>${state.uf?`UF: ${escapeHtml(state.uf)} · `:''}Confira o nome na urna antes de confirmar</small></div>${rows}<div class="paper-footer">Projeto independente · Dados de candidaturas e fotos: TSE · Leve esta colinha em papel.</div>`;
  }
  function updatePreview(){ renderPaper(el.preview); renderPaper(el.printSheet); }

  function ensureData(key){
    if(window.__TSE_DATA__?.[key]) return Promise.resolve(window.__TSE_DATA__[key]);
    window.__TSE_DATA__=window.__TSE_DATA__||{};
    const [uf,cargo]=key.split(':');
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[data-tse-key="${key}"]`);
      if(existing){ existing.addEventListener('load',()=>resolve(window.__TSE_DATA__?.[key])); existing.addEventListener('error',reject); return; }
      const s=document.createElement('script'); s.dataset.tseKey=key; s.src=`./data/${uf}-${cargo}.js?v=${encodeURIComponent(window.__TSE_STATUS__?.syncedAt||'0')}`;
      s.onload=()=>window.__TSE_DATA__?.[key]?resolve(window.__TSE_DATA__[key]):reject(new Error('Pacote de dados inválido'));
      s.onerror=()=>reject(new Error(`Arquivo ${uf}-${cargo}.js não disponível`)); document.head.appendChild(s);
    });
  }

  async function loadUfData(uf){
    const token=++loadToken;
    if(!uf){setSource('idle','Aguardando estado','Os dados estaduais serão carregados após selecionar a UF.');return;}
    setSource('loading','Carregando base eleitoral…','Lendo os arquivos sincronizados do TSE para a UF selecionada.');
    const keys=[...new Set(CARGOS.map(cfg=>dataKey(cfg,uf)))];
    const results=await Promise.allSettled(keys.map(ensureData)); if(token!==loadToken)return;
    const failed=results.filter(r=>r.status==='rejected').length;
    if(failed){
      const synced=window.__TSE_STATUS__?.syncedAt;
      setSource('bad','Base do TSE ainda não sincronizada', synced?`Alguns arquivos não foram gerados na última sincronização (${formatDate(synced)}).`:'Publique o projeto e execute o workflow “Sincronizar dados do TSE”, ou rode o script local de sincronização.');
    } else {
      const sourceDate=window.__TSE_STATUS__?.generatedAt || window.__TSE_STATUS__?.syncedAt;
      setSource('ok','Dados do TSE carregados',sourceDate?`Base gerada/atualizada em ${formatDate(sourceDate)}.`:'Arquivos eleitorais disponíveis para consulta.');
      refreshExistingVotes();
    }
  }

  function refreshExistingVotes(){
    for(const cfg of CARGOS){
      const vote=state.votes[cfg.id]; if(!vote?.number || vote.number.length!==cfg.digits) continue;
      const card=el.cards.querySelector(`[data-id="${cfg.id}"]`); if(card) resolveCandidate(cfg,card,vote.number);
    }
  }

  function setSource(mode,title,detail){
    el.sourceDot.className='dot'+(mode==='ok'?' ok':mode==='bad'?' bad':mode==='loading'?' loading':'');
    el.sourceTitle.textContent=title; el.sourceDetail.textContent=detail;
  }

  function changeUf(newUf){
    const oldUf=state.uf;
    if(oldUf && oldUf!==newUf && CARGOS.some(c=>c.scope==='uf' && hasVote(state.votes[c.id]))){
      if(!confirm('Trocar de UF apagará os cinco votos estaduais já preenchidos. Deseja continuar?')){el.uf.value=oldUf;return;}
      for(const cfg of CARGOS.filter(c=>c.scope==='uf')) delete state.votes[cfg.id];
    }
    state.uf=newUf; saveState(); renderCards(); updatePreview(); loadUfData(newUf);
  }

  function allReady(){
    if(!state.uf){alert('Selecione sua UF antes de imprimir.');return false;}
    const missing=CARGOS.filter(c=>!state.votes[c.id]?.candidate);
    if(missing.length){alert(`Ainda faltam ${missing.length} voto(s) com candidatura identificada. Complete os números antes de imprimir.`);return false;}
    const a=state.votes.senador1?.candidate,b=state.votes.senador2?.candidate;
    if(a&&b&&String(a.sq)===String(b.sq)){alert('Os dois votos para o Senado precisam ser em candidaturas diferentes.');return false;}
    return true;
  }

  function exportBackup(){
    const blob=new Blob([JSON.stringify({version:2,year:YEAR,uf:state.uf,votes:state.votes},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`colinha-eleitoral-2026-${state.uf||'BR'}.json`;a.click();URL.revokeObjectURL(a.href);
  }
  async function importBackup(file){
    try{
      const obj=JSON.parse(await file.text()); if(!obj||obj.year!==YEAR) throw new Error();
      state={uf:obj.uf||'',votes:obj.votes||{}}; saveState(); el.uf.value=state.uf; renderCards(); updatePreview(); await loadUfData(state.uf);
    }catch{alert('Não foi possível importar esse backup da colinha 2026.');}
  }

  function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function escapeAttr(v=''){return escapeHtml(v);}
  function formatDate(v){try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch{return safeText(v);}}

  populateUf(); renderCards(); updatePreview();
  el.uf.addEventListener('change',()=>changeUf(el.uf.value));
  el.printBtn.addEventListener('click',()=>{if(allReady()){updatePreview();window.print();}});
  el.clearBtn.addEventListener('click',()=>{if(confirm('Apagar todas as escolhas salvas neste navegador?')){state={uf:state.uf,votes:{}};saveState();renderCards();updatePreview();}});
  el.backupBtn.addEventListener('click',exportBackup);
  el.backupFile.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importBackup(f);e.target.value='';});
  loadUfData(state.uf);
  if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
