(() => {
  'use strict';

  const YEAR = 2026;
  const ELECTION_ID = '20322002026';
  const PHOTO_BASE = `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${ELECTION_ID}`;

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
    printBtn: document.querySelector('#printBtn'), shareBtn: document.querySelector('#shareBtn'), clearBtn: document.querySelector('#clearBtn'), backupBtn: document.querySelector('#backupBtn'), backupFile: document.querySelector('#backupFile'),
    progressText: document.querySelector('#progressText'), progressBar: document.querySelector('#progressBar'),
    shareModal: document.querySelector('#shareModal'), shareCanvas: document.querySelector('#shareCanvas'), shareLoading: document.querySelector('#shareLoading'),
    nativeShareBtn: document.querySelector('#nativeShareBtn'), downloadCardBtn: document.querySelector('#downloadCardBtn'), copyShareBtn: document.querySelector('#copyShareBtn'), toast: document.querySelector('#toast')
  };

  // As escolhas existem apenas durante a sessão atual da página.
  // Recarregar/atualizar a página sempre inicia uma colinha vazia.
  clearLegacyStoredChoices();
  let state = {uf:'', votes:{}};
  let loadToken = 0;

  function clearLegacyStoredChoices(){
    try {
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i);
        if(key && key.startsWith('minha-colinha-eleitoral-2026')) localStorage.removeItem(key);
      }
    } catch {}
  }
  function saveState(){ /* intencionalmente não persiste escolhas entre recargas */ }
  function cargoCode(cfg, uf){ return cfg.id === 'depEstadual' && uf === 'DF' ? 8 : cfg.cargo; }
  function dataKey(cfg, uf){ return cfg.scope === 'br' ? 'BR:1' : `${uf}:${cargoCode(cfg,uf)}`; }
  function photoUf(cfg){ return cfg.scope === 'br' ? 'BR' : state.uf; }
  function localPhotoUrl(candidate, cfg){
    if(!candidate?.sq) return '';
    const uf=photoUf(cfg);
    return uf ? `./photos/${encodeURIComponent(uf)}/${encodeURIComponent(candidate.sq)}.webp` : '';
  }
  function remotePhotoUrl(candidate, cfg){
    if(!candidate?.sq) return '';
    const uf=photoUf(cfg);
    return uf ? `${PHOTO_BASE}/${encodeURIComponent(candidate.sq)}/${encodeURIComponent(uf)}` : '';
  }
  function photoUrl(candidate, cfg){ return localPhotoUrl(candidate,cfg); }
  function hasVote(v){ return !!(v && (v.number || v.candidate)); }
  function meaningfulStatus(s=''){ const t=String(s).trim(); return t && !t.startsWith('#') ? t : ''; }
  function statusWarn(s=''){ return /(INDEFER|RENÚN|FALEC|CANCEL|INAPTO|NÃO CONCORR|NAO CONCORR)/i.test(s); }
  function safeText(v=''){ return String(v); }
  function normalizeSearch(v=''){
    return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
  }
  function candidateIdentity(c){
    return String(c?.sq || `${c?.n||''}|${normalizeSearch(c?.u||'')}|${normalizeSearch(c?.p||'')}`);
  }
  function uniqueCandidates(list=[]){
    const seen=new Set(); const out=[];
    for(const c of list){
      const key=candidateIdentity(c); if(seen.has(key)) continue;
      seen.add(key); out.push(c);
    }
    return out;
  }

  function populateUf(){
    for(const [code,name] of UFS){ const o=document.createElement('option'); o.value=code; o.textContent=`${code} — ${name}`; el.uf.appendChild(o); }
    el.uf.value = state.uf || '';
  }

  function renderCards(){
    el.cards.innerHTML = CARGOS.map(cfg => {
      const vote = state.votes[cfg.id] || {};
      const candidate = vote.candidate || null;
      const img = candidate ? photoUrl(candidate,cfg) : '';
      const searchValue = candidate
        ? `${candidate.n || vote.number || ''} — ${candidate.u || ''}`
        : (vote.number || '');
      return `<article class="vote-card${candidate ? ' is-selected' : ''}" data-id="${cfg.id}">
        <div class="order">${cfg.order}</div>
        <div class="photo-frame" data-photo>
          ${img ? `<img src="${img}" data-remote-photo="${escapeAttr(remotePhotoUrl(candidate,cfg))}" alt="Foto de ${escapeAttr(candidate.u || '')}" loading="lazy" onerror="if(this.dataset.remotePhoto){const u=this.dataset.remotePhoto;this.dataset.remotePhoto='';this.src=u}else{this.parentElement.innerHTML='<span class=&quot;photo-empty&quot;>Foto indisponível</span>'}">` : '<span class="photo-empty">Foto do<br>candidato</span>'}
        </div>
        <div class="vote-main">
          <div class="vote-topline"><div class="vote-title">${cfg.label}</div><div class="digit-help">Número: ${cfg.digits} dígitos</div></div>
          <div class="lookup-fields unified-lookup">
            <div class="field-group search-field">
              <label>Pesquisar por número ou nome</label>
              <input class="search-input" data-search type="search" autocomplete="off" value="${escapeAttr(searchValue)}" placeholder="Digite ${'0'.repeat(cfg.digits)} ou o nome do candidato" aria-label="Pesquisar ${cfg.label} por número ou nome">
            </div>
          </div>
          <div class="candidate-info" data-info>${candidateInfoHtml(candidate)}</div>
          <div data-matches aria-live="polite"></div>
        </div>
      </article>`;
    }).join('');

    el.cards.querySelectorAll('.vote-card').forEach(card => {
      const cfg = CARGOS.find(x=>x.id===card.dataset.id);
      const input = card.querySelector('[data-search]');
      let searchTimer=0;
      input.addEventListener('input',()=>{
        clearTimeout(searchTimer);
        const raw=input.value.trim();
        const looksNumeric = raw !== '' && /^[\d\s.\-]+$/.test(raw);
        if(looksNumeric){
          onUnifiedSearch(cfg,card,input);
        } else {
          searchTimer=setTimeout(()=>onUnifiedSearch(cfg,card,input),180);
        }
      });
      input.addEventListener('search',()=>{
        clearTimeout(searchTimer);
        onUnifiedSearch(cfg,card,input);
      });
    });
    validateSenate();
  }

  function candidateInfoHtml(c){
    if(!c) return '<div class="lookup-message">Digite o número completo ou parte do nome para identificar a candidatura.</div>';
    const status = meaningfulStatus(c.s);
    return `<div class="candidate-name">${escapeHtml(c.u || 'Nome não informado')}</div>
      <div class="candidate-meta"><span>${escapeHtml(c.p || 'Partido não informado')}</span>${status ? `<span class="candidate-status ${statusWarn(status)?'warn':''}">${escapeHtml(status)}</span>`:''}</div>`;
  }

  function clearCurrentSelection(cfg,card,number=''){
    state.votes[cfg.id]={number,candidate:null};
    saveState();
    card.classList.remove('is-selected');
    updateCardPhoto(card,null,cfg);
    updatePreview();
    validateSenate();
  }

  async function onUnifiedSearch(cfg,card,input){
    const raw=input.value.trim();
    const box=card.querySelector('[data-matches]');
    const info=card.querySelector('[data-info]');
    box.innerHTML='';

    // Se o usuário alterar um candidato já escolhido, a seleção anterior deixa de valer.
    const selected=state.votes[cfg.id]?.candidate;
    const selectedText=selected ? `${selected.n || ''} — ${selected.u || ''}` : '';
    if(selected && raw===selectedText) return;

    if(!raw){
      clearCurrentSelection(cfg,card,'');
      info.innerHTML='<div class="lookup-message">Digite o número completo ou parte do nome para identificar a candidatura.</div>';
      return;
    }

    if(!state.uf && cfg.scope==='uf'){
      clearCurrentSelection(cfg,card,'');
      info.innerHTML='<div class="lookup-message error">Selecione sua UF antes de pesquisar.</div>';
      return;
    }

    const numericLike=/^[\d\s.\-]+$/.test(raw);
    if(numericLike){
      const number=raw.replace(/\D/g,'').slice(0,cfg.digits);
      if(input.value!==number) input.value=number;
      clearCurrentSelection(cfg,card,number);
      if(!number){
        info.innerHTML='<div class="lookup-message">Digite um número ou nome para pesquisar.</div>';
        return;
      }
      info.innerHTML=number.length<cfg.digits
        ? `<div class="lookup-message">Pesquisando pelos ${number.length} dígito(s) informados…</div>`
        : '<div class="lookup-message">Conferindo o número e procurando correspondências…</div>';
      await resolveByNumber(cfg,card,input,number);
      return;
    }

    clearCurrentSelection(cfg,card,'');
    const query=normalizeSearch(raw);
    if(query.length<2){
      info.innerHTML='<div class="lookup-message">Digite pelo menos 2 letras para pesquisar pelo nome.</div>';
      return;
    }
    info.innerHTML='<div class="lookup-message">Pesquisando candidaturas…</div>';
    await resolveByName(cfg,card,input,query);
  }

  function numericEditDistance(a='',b=''){
    a=String(a); b=String(b);
    const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
    for(let i=0;i<=a.length;i++) dp[i][0]=i;
    for(let j=0;j<=b.length;j++) dp[0][j]=j;
    for(let i=1;i<=a.length;i++){
      for(let j=1;j<=b.length;j++){
        const cost=a[i-1]===b[j-1]?0:1;
        dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
      }
    }
    return dp[a.length][b.length];
  }

  function numericCandidateScore(candidateNumber,query,totalDigits){
    const n=String(candidateNumber||'').replace(/\D/g,'');
    const q=String(query||'').replace(/\D/g,'');
    if(!n||!q) return 0;
    if(n===q) return 2000;
    if(n.startsWith(q)) return 1500 + q.length*25;
    if(n.includes(q)) return 1050 + q.length*15;

    // Quando já há pelo menos dois algarismos, tolera um erro de digitação
    // comparando a sequência informada com o início do número oficial.
    if(q.length>=2){
      const prefix=n.slice(0,Math.min(q.length,n.length));
      const d=numericEditDistance(q,prefix);
      if(d===1) return 760 + q.length*10;
    }

    // Para um número completo incorreto, sugere números oficiais muito próximos.
    if(q.length===totalDigits && n.length===totalDigits){
      const d=numericEditDistance(q,n);
      if(d===1) return 900;
      if(d===2) return 520;
      const diff=Math.abs(Number(n)-Number(q));
      if(Number.isFinite(diff) && diff<=10) return 460-diff;
    }
    return 0;
  }

  async function resolveByNumber(cfg,card,input,query){
    const box=card.querySelector('[data-matches]');
    const info=card.querySelector('[data-info]');
    const key=dataKey(cfg,state.uf);
    try{ await ensureData(key); }
    catch{
      info.innerHTML='<div class="lookup-message error">A base deste cargo ainda não está disponível. Execute a sincronização do TSE no projeto.</div>'; return;
    }
    const live=input.value.replace(/\D/g,'').slice(0,cfg.digits);
    if(live!==query) return;

    const pack=window.__TSE_DATA__?.[key];
    const candidates=uniqueCandidates(pack?.c||[]);
    const exact=candidates.filter(c=>String(c.n||'')===query);

    // Número completo e único: mantém a seleção automática já esperada.
    if(query.length===cfg.digits && exact.length===1){
      selectCandidate(cfg,card,query,exact[0],input); return;
    }
    if(query.length===cfg.digits && exact.length>1){
      info.innerHTML='<div class="lookup-message">Há mais de um registro com esse número. Selecione a candidatura correta.</div>';
      box.innerHTML=`<div class="search-summary">${exact.length} correspondência(s) exata(s)</div><div class="multi-match name-results">${exact.map((c,i)=>candidateMatchButton(c,i)).join('')}</div>`;
      box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
        const candidate=exact[Number(btn.dataset.match)];
        selectCandidate(cfg,card,String(candidate.n||''),candidate,input);
      }));
      return;
    }

    const scored=[];
    for(const c of candidates){
      const score=numericCandidateScore(c.n,query,cfg.digits);
      if(score) scored.push({c,score});
    }
    scored.sort((a,b)=>b.score-a.score || String(a.c.n||'').localeCompare(String(b.c.n||''),'pt-BR',{numeric:true}) || String(a.c.u||'').localeCompare(String(b.c.u||''),'pt-BR'));
    const matches=scored.slice(0,12).map(x=>x.c);

    if(!matches.length){
      info.innerHTML=query.length<cfg.digits
        ? `<div class="lookup-message error">Nenhuma candidatura encontrada a partir de <strong>${escapeHtml(query)}</strong>. Tente outro número ou pesquise pelo nome.</div>`
        : '<div class="lookup-message error">Número não encontrado. Tente corrigir algum dígito ou pesquise pelo nome.</div>';
      box.innerHTML=''; return;
    }

    const exactPrefix=matches.filter(c=>String(c.n||'').startsWith(query)).length;
    const remaining=Math.max(0,cfg.digits-query.length);
    info.innerHTML=query.length<cfg.digits
      ? `<div class="lookup-message ok">${exactPrefix?`Encontramos ${exactPrefix} candidatura(s) cujo número começa com <strong>${escapeHtml(query)}</strong>. `:''}${remaining?`Você pode continuar digitando os ${remaining} dígito(s) restantes ou selecionar uma sugestão abaixo.`:'Selecione uma candidatura abaixo.'}</div>`
      : '<div class="lookup-message">O número exato não foi encontrado. Estas são as correspondências numéricas mais próximas.</div>';
    box.innerHTML=`<div class="search-summary">${matches.length}${scored.length>matches.length?` de ${scored.length}`:''} sugestão(ões)</div><div class="multi-match name-results numeric-results">${matches.map((c,i)=>candidateMatchButton(c,i)).join('')}</div>`;
    box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
      const candidate=matches[Number(btn.dataset.match)];
      selectCandidate(cfg,card,String(candidate.n||''),candidate,input);
    }));
  }

  async function resolveCandidate(cfg, card, number, searchInput=null){
    if(!state.uf && cfg.scope === 'uf'){
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">Selecione sua UF primeiro.</div>'; return;
    }
    const key = dataKey(cfg,state.uf);
    try { await ensureData(key); }
    catch {
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">A base deste cargo ainda não está disponível. Execute a sincronização do TSE no projeto.</div>'; return;
    }
    if(searchInput && searchInput.value.replace(/\D/g,'').slice(0,cfg.digits)!==number) return;
    const pack = window.__TSE_DATA__?.[key];
    const matches = uniqueCandidates((pack?.c || []).filter(c => String(c.n) === number));
    if(!matches.length){
      state.votes[cfg.id] = {number,candidate:null}; saveState();
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">Número não encontrado na base sincronizada. Confira o número ou atualize os dados do TSE.</div>';
      updatePreview(); return;
    }
    if(matches.length === 1){ selectCandidate(cfg,card,number,matches[0],searchInput); return; }
    card.querySelector('[data-info]').innerHTML='<div class="lookup-message">Há mais de um registro com esse número. Selecione a candidatura correta.</div>';
    const box=card.querySelector('[data-matches]');
    box.innerHTML=`<div class="multi-match name-results">${matches.map((c,i)=>candidateMatchButton(c,i)).join('')}</div>`;
    box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>selectCandidate(cfg,card,number,matches[Number(btn.dataset.match)],searchInput)));
  }

  async function resolveByName(cfg,card,input,query){
    const box=card.querySelector('[data-matches]');
    const key=dataKey(cfg,state.uf);
    try{ await ensureData(key); }
    catch{
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">A base deste cargo ainda não está disponível. Execute a sincronização do TSE no projeto.</div>'; return;
    }
    if(normalizeSearch(input.value)!==query) return;
    const pack=window.__TSE_DATA__?.[key];
    const candidates=uniqueCandidates(pack?.c||[]);
    const scored=[];
    for(const c of candidates){
      const urna=normalizeSearch(c.u||'');
      const completo=normalizeSearch(c.f||'');
      let score=0;
      if(urna===query || completo===query) score=100;
      else if(urna.startsWith(query)) score=80;
      else if(completo.startsWith(query)) score=70;
      else if(urna.includes(query)) score=55;
      else if(completo.includes(query)) score=45;
      if(score) scored.push({c,score});
    }
    scored.sort((a,b)=>b.score-a.score || String(a.c.u||'').localeCompare(String(b.c.u||''),'pt-BR') || String(a.c.n||'').localeCompare(String(b.c.n||''),'pt-BR',{numeric:true}));
    const matches=scored.slice(0,12).map(x=>x.c);
    if(!matches.length){
      card.querySelector('[data-info]').innerHTML='<div class="lookup-message error">Nenhuma candidatura encontrada com esse nome neste cargo.</div>';
      box.innerHTML=''; return;
    }
    card.querySelector('[data-info]').innerHTML='<div class="lookup-message">Selecione uma candidatura nos resultados abaixo.</div>';
    box.innerHTML=`<div class="search-summary">${matches.length}${scored.length>matches.length?` de ${scored.length}`:''} resultado(s)</div><div class="multi-match name-results">${matches.map((c,i)=>candidateMatchButton(c,i)).join('')}</div>`;
    box.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
      const candidate=matches[Number(btn.dataset.match)];
      selectCandidate(cfg,card,String(candidate.n||''),candidate,input);
    }));
  }

  function candidateMatchButton(c,i){
    const full=c.f && normalizeSearch(c.f)!==normalizeSearch(c.u) ? `<small>${escapeHtml(c.f)}</small>`:'';
    return `<button type="button" data-match="${i}"><span><strong>${escapeHtml(c.u||'Sem nome')}</strong>${full}</span><span class="match-meta">${escapeHtml(c.n||'')} · ${escapeHtml(c.p||'')}</span></button>`;
  }

  function selectCandidate(cfg,card,number,candidate,searchInput=null){
    state.votes[cfg.id]={number,candidate}; saveState();
    card.classList.add('is-selected');
    const input=searchInput || card.querySelector('[data-search]');
    if(input) input.value=`${candidate.n || number || ''} — ${candidate.u || ''}`;
    card.querySelector('[data-info]').innerHTML=candidateInfoHtml(candidate);
    card.querySelector('[data-matches]').innerHTML='';
    updateCardPhoto(card,candidate,cfg); updatePreview(); validateSenate();
  }

  function updateCardPhoto(card,candidate,cfg){
    const frame=card.querySelector('[data-photo]');
    if(!candidate){frame.innerHTML='<span class="photo-empty">Foto do<br>candidato</span>';return;}
    const url=photoUrl(candidate,cfg), remote=remotePhotoUrl(candidate,cfg); const img=document.createElement('img');
    img.src=url; img.alt=`Foto de ${candidate.u||'candidato'}`; img.loading='lazy';
    let triedRemote=false;
    img.addEventListener('error',()=>{
      if(!triedRemote && remote){triedRemote=true;img.src=remote;return;}
      frame.innerHTML='<span class="photo-empty">Foto indisponível</span>';
    });
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
        ${p?`<img class="paper-photo" src="${p}" data-remote-photo="${escapeAttr(remotePhotoUrl(c,cfg))}" alt="" onerror="if(this.dataset.remotePhoto){const u=this.dataset.remotePhoto;this.dataset.remotePhoto='';this.src=u}else{this.outerHTML='<div class=&quot;paper-photo empty&quot;>FOTO</div>'}">`:'<div class="paper-photo empty">FOTO</div>'}
        <div><div class="paper-cargo">${escapeHtml(cfg.short)}</div><div class="paper-name">${escapeHtml(c?.u||'—')}</div><div class="paper-party">${escapeHtml(c?.p||'')}</div></div>
        <div class="digit-boxes">${digits.join('')}</div>
      </div>`;
    }).join('');
    target.innerHTML=`<div class="paper-head"><strong>MINHA COLINHA ELEITORAL — 2026</strong><small>${state.uf?`UF: ${escapeHtml(state.uf)} · `:''}Confira o nome na urna antes de confirmar</small></div>${rows}<div class="paper-footer">Projeto independente · Dados de candidaturas e fotos: TSE · Leve esta colinha em papel.</div>`;
  }
  function updatePreview(){ renderPaper(el.preview); renderPaper(el.printSheet); updateProgress(); }

  function updateProgress(){
    const complete=CARGOS.filter(cfg=>state.votes[cfg.id]?.candidate).length;
    if(el.progressText) el.progressText.textContent=`${complete} de ${CARGOS.length}`;
    if(el.progressBar) el.progressBar.style.width=`${(complete/CARGOS.length)*100}%`;
    if(el.shareBtn) el.shareBtn.disabled=complete===0;
  }

  function ensureData(key){
    if(window.__TSE_DATA__?.[key]) return Promise.resolve(window.__TSE_DATA__[key]);
    const syncVersion=window.__TSE_STATUS__?.syncedAt;
    if(!syncVersion){
      return Promise.reject(new Error('Base eleitoral ainda não foi publicada pelo workflow do GitHub Pages.'));
    }
    window.__TSE_DATA__=window.__TSE_DATA__||{};
    const [uf,cargo]=key.split(':');
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[data-tse-key="${key}"]`);
      if(existing){ existing.addEventListener('load',()=>resolve(window.__TSE_DATA__?.[key])); existing.addEventListener('error',reject); return; }
      const s=document.createElement('script');
      s.dataset.tseKey=key;
      s.src=`./data/${uf}-${cargo}.js?v=${encodeURIComponent(syncVersion)}`;
      s.onload=()=>window.__TSE_DATA__?.[key]?resolve(window.__TSE_DATA__[key]):reject(new Error('Pacote de dados inválido'));
      s.onerror=()=>reject(new Error(`Arquivo ${uf}-${cargo}.js não disponível no artefato publicado`));
      document.head.appendChild(s);
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
      setSource('bad', synced?'Arquivos eleitorais incompletos':'Base eleitoral não publicada', synced?`O artefato publicado está sem alguns pacotes da última sincronização (${formatDate(synced)}). Verifique o workflow do GitHub Pages.`:'O site está usando o status inicial do repositório. Em Settings → Pages, use GitHub Actions e execute o workflow de sincronização.');
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
    if(missing.length){alert(`Ainda faltam ${missing.length} voto(s) com candidatura identificada. Identifique todas as candidaturas antes de imprimir.`);return false;}
    const a=state.votes.senador1?.candidate,b=state.votes.senador2?.candidate;
    if(a&&b&&String(a.sq)===String(b.sq)){alert('Os dois votos para o Senado precisam ser em candidaturas diferentes.');return false;}
    return true;
  }


  function selectedVotes(){
    return CARGOS.map(cfg=>({cfg,vote:state.votes[cfg.id]||{}})).filter(x=>x.vote.candidate);
  }

  function shareText(){
    const rows=selectedVotes().map(({cfg,vote})=>`${cfg.short}: ${vote.number || vote.candidate?.n || ''} — ${vote.candidate?.u || ''}${vote.candidate?.p ? ` (${vote.candidate.p})` : ''}`);
    return [`Minha Colinha Eleitoral 2026${state.uf ? ` — ${state.uf}` : ''}`, ...rows, '', 'Confira os dados na urna antes de confirmar.'].join('\n');
  }

  function wrapCanvasText(ctx,text,maxWidth){
    const words=String(text||'').split(/\s+/).filter(Boolean); const lines=[]; let line='';
    for(const word of words){
      const test=line?`${line} ${word}`:word;
      if(ctx.measureText(test).width>maxWidth && line){lines.push(line); line=word;} else line=test;
    }
    if(line) lines.push(line); return lines;
  }

  function roundRect(ctx,x,y,w,h,r,fill,stroke){
    const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
  }

  async function blobToImage(blob){
    const objectUrl=URL.createObjectURL(blob);
    try{
      return await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=objectUrl;});
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function loadCanvasPhoto(candidate,cfg){
    const url=localPhotoUrl(candidate,cfg);
    if(!url) return null;
    try{
      const res=await fetch(url,{cache:'force-cache'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob=await res.blob();
      if(!blob || !blob.size) throw new Error('Imagem vazia');
      return await blobToImage(blob);
    }catch{return null;}
  }

  function drawCoverImage(ctx,img,x,y,w,h,r=20){
    const scale=Math.max(w/img.width,h/img.height); const sw=w/scale,sh=h/scale; const sx=(img.width-sw)/2,sy=(img.height-sh)/2;
    ctx.save(); roundRect(ctx,x,y,w,h,r); ctx.clip(); ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h); ctx.restore();
  }

  async function generateShareCard(){
    const canvas=el.shareCanvas,ctx=canvas.getContext('2d'); const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#f4f6f4';ctx.fillRect(0,0,W,H);
    const grad=ctx.createLinearGradient(0,0,W,420);grad.addColorStop(0,'#102f28');grad.addColorStop(1,'#0d624b');ctx.fillStyle=grad;ctx.fillRect(0,0,W,355);
    ctx.fillStyle='#c9e3d9';ctx.font='700 28px system-ui, sans-serif';ctx.letterSpacing='2px';ctx.fillText('ELEIÇÕES 2026',64,72);
    ctx.fillStyle='#ffffff';ctx.font='800 68px system-ui, sans-serif';ctx.fillText('Minha Colinha Eleitoral',64,154);
    ctx.fillStyle='rgba(255,255,255,.78)';ctx.font='400 28px system-ui, sans-serif';ctx.fillText(state.uf?`UF ${state.uf} · escolhas organizadas para conferência`:'Escolhas organizadas para conferência',64,205);
    roundRect(ctx,64,256,270,50,25,'rgba(255,255,255,.10)','rgba(255,255,255,.20)');ctx.fillStyle='#fff';ctx.font='700 22px system-ui, sans-serif';ctx.fillText('DADOS PÚBLICOS · TSE',88,289);

    const items=CARGOS.map(cfg=>({cfg,vote:state.votes[cfg.id]||{}}));
    const photoLoads=await Promise.all(items.map(({cfg,vote})=>vote.candidate?loadCanvasPhoto(vote.candidate,cfg):Promise.resolve(null)));
    const startY=392,rowH=137,gap=10;
    for(let i=0;i<items.length;i++){
      const {cfg,vote}=items[i],c=vote.candidate; const y=startY+i*(rowH+gap);
      roundRect(ctx,54,y,W-108,rowH,24,'#ffffff','#dce5e0');
      ctx.fillStyle='#e7f3ee';roundRect(ctx,76,y+28,54,54,16,'#e7f3ee');ctx.fillStyle='#0d624b';ctx.font='800 24px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText(String(cfg.order).padStart(2,'0'),103,y+63);ctx.textAlign='left';
      if(c){
        const img=photoLoads[i];
        if(img) drawCoverImage(ctx,img,150,y+18,78,100,18);
        else{roundRect(ctx,150,y+18,78,100,18,'#edf2ef');ctx.fillStyle='#7a8c84';ctx.font='800 30px system-ui, sans-serif';ctx.textAlign='center';ctx.fillText((c.u||'?').trim().charAt(0).toUpperCase(),189,y+78);ctx.textAlign='left';}
        ctx.fillStyle='#6d8179';ctx.font='800 19px system-ui, sans-serif';ctx.fillText(cfg.short.toUpperCase(),252,y+40);
        ctx.fillStyle='#142e28';ctx.font='800 31px system-ui, sans-serif';const nameLines=wrapCanvasText(ctx,c.u||'Nome não informado',500).slice(0,1);ctx.fillText(nameLines[0]||'',252,y+78);
        ctx.fillStyle='#667b73';ctx.font='600 21px system-ui, sans-serif';ctx.fillText(c.p||'',252,y+108);
        ctx.fillStyle='#0d624b';ctx.font='900 44px ui-monospace, SFMono-Regular, Menlo, monospace';ctx.textAlign='right';ctx.fillText(String(vote.number||c.n||''),W-82,y+82);ctx.textAlign='left';
      }else{
        ctx.fillStyle='#71847c';ctx.font='800 19px system-ui, sans-serif';ctx.fillText(cfg.short.toUpperCase(),154,y+55);ctx.fillStyle='#a0ada7';ctx.font='500 23px system-ui, sans-serif';ctx.fillText('Não preenchido',154,y+88);
      }
    }
    ctx.fillStyle='#546a62';ctx.font='500 20px system-ui, sans-serif';ctx.fillText('Confira os nomes e números na urna antes de confirmar.',64,H-70);
    ctx.fillStyle='#0d624b';ctx.font='800 19px system-ui, sans-serif';ctx.textAlign='right';ctx.fillText('Projeto independente',W-64,H-70);ctx.textAlign='left';
    return canvas;
  }

  function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao gerar imagem')),'image/png',1));}

  async function openShareModal(){
    if(!selectedVotes().length){showToast('Escolha pelo menos um candidato antes de compartilhar.');return;}
    el.shareModal.hidden=false;document.body.style.overflow='hidden';el.shareLoading.hidden=false;
    try{await generateShareCard();}finally{el.shareLoading.hidden=true;}
  }
  function closeShareModal(){el.shareModal.hidden=true;document.body.style.overflow='';}

  async function downloadShareCard(){
    try{await generateShareCard();const blob=await canvasBlob(el.shareCanvas);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`minha-colinha-eleitoral-2026-${state.uf||'BR'}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('Card PNG gerado.');}catch{showToast('Não foi possível gerar o card.');}
  }

  async function nativeShare(){
    try{
      await generateShareCard();const blob=await canvasBlob(el.shareCanvas);const file=new File([blob],`minha-colinha-eleitoral-2026-${state.uf||'BR'}.png`,{type:'image/png'});
      const data={title:'Minha Colinha Eleitoral 2026',text:shareText()};
      if(navigator.canShare?.({files:[file]})){data.files=[file];await navigator.share(data);return;}
      if(navigator.share){data.url=location.href.split('#')[0];await navigator.share(data);return;}
      await downloadShareCard();
    }catch(err){if(err?.name!=='AbortError')showToast('Compartilhamento não disponível neste navegador.');}
  }

  async function copyShareText(){
    const text=shareText();
    try{await navigator.clipboard.writeText(text);showToast('Resumo copiado.');}
    catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast('Resumo copiado.');}
  }

  function shareNetwork(network){
    const text=shareText(),url=location.href.split('#')[0];let target='';
    if(network==='whatsapp')target=`https://wa.me/?text=${encodeURIComponent(text)}`;
    if(network==='telegram')target=`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if(network==='x')target=`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    if(network==='facebook')target=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    if(target) window.open(target,'_blank','noopener,noreferrer');
  }

  let toastTimer=0;
  function showToast(message){
    clearTimeout(toastTimer);el.toast.textContent=message;el.toast.hidden=false;toastTimer=setTimeout(()=>{el.toast.hidden=true;},2600);
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
  el.shareBtn.addEventListener('click',openShareModal);
  el.clearBtn.addEventListener('click',()=>{if(confirm('Apagar todas as escolhas desta sessão?')){state={uf:state.uf,votes:{}};saveState();renderCards();updatePreview();}});
  el.backupBtn.addEventListener('click',exportBackup);
  el.nativeShareBtn.addEventListener('click',nativeShare);
  el.downloadCardBtn.addEventListener('click',downloadShareCard);
  el.copyShareBtn.addEventListener('click',copyShareText);
  el.shareModal.querySelectorAll('[data-close-share]').forEach(node=>node.addEventListener('click',closeShareModal));
  el.shareModal.querySelectorAll('[data-network]').forEach(btn=>btn.addEventListener('click',()=>shareNetwork(btn.dataset.network)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el.shareModal.hidden)closeShareModal();});
  el.backupFile.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importBackup(f);e.target.value='';});
  loadUfData(state.uf);
  if('serviceWorker' in navigator && location.protocol!=='file:') {
    navigator.serviceWorker.register('./sw.js?v=12',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      try{
        if(sessionStorage.getItem('colinha-sw-v12-reloaded')!=='1'){
          sessionStorage.setItem('colinha-sw-v12-reloaded','1');
          location.reload();
        }
      }catch{}
    });
  }
})();
