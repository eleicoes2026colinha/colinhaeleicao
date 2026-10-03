# Minha Colinha Eleitoral 2026 — dados automáticos do TSE

Site estático, responsivo e neutro para montar uma colinha eleitoral pessoal. O eleitor pode digitar o **número** ou **pesquisar pelo nome** e o site preenche **número, nome de urna, partido e foto** usando dados públicos do Tribunal Superior Eleitoral (TSE).

## O que esta versão faz

- Seleção da UF.
- Ordem da votação de 2026: deputado federal, deputado estadual/distrital, senador 1, senador 2, governador e presidente.
- Quantidade correta de dígitos por cargo.
- Nome e partido preenchidos automaticamente após o número completo.
- Pesquisa por nome de urna ou nome completo, ignorando diferenças de acentuação e maiúsculas/minúsculas.
- Selecionar um resultado da pesquisa pelo nome preenche automaticamente o número da candidatura.
- Deduplicação por `SQ_CANDIDATO` tanto na sincronização quanto na interface, evitando o mesmo candidato repetido na lista.
- Foto oficial carregada pelo identificador `SQ_CANDIDATO` no serviço de imagens do DivulgaCandContas.
- Aviso para não repetir a mesma candidatura nas duas vagas do Senado.
- Prévia permanente da colinha.
- Impressão em **A6**, compacta e pensada para levar em papel.
- Salvamento local no navegador e backup em JSON.
- PWA / Service Worker para a interface.
- Projeto independente e sem recomendação de candidatura.

## Fonte oficial

A sincronização usa o arquivo público do TSE:

`https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip`

O script lê os campos oficiais como `SG_UF`, `CD_CARGO`, `SQ_CANDIDATO`, `NR_CANDIDATO`, `NM_URNA_CANDIDATO`, `NM_CANDIDATO`, `SG_PARTIDO` e `DS_SITUACAO_CANDIDATURA` e gera arquivos pequenos por UF e cargo em `data/`.

As fotos são exibidas pelo serviço oficial do DivulgaCandContas usando o identificador da candidatura. O projeto não copia nem mantém um banco próprio de fotografias.

## Por que existe sincronização em vez de chamar a API direto do navegador?

A API do DivulgaCandContas não oferece CORS para páginas de outros domínios. Por isso, um site puramente estático no GitHub Pages não consegue fazer `fetch()` direto para a API. Esta versão evita esse problema usando o **Portal de Dados Abertos do TSE** para gerar arquivos locais e deixa apenas a imagem como recurso externo.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie **todo o conteúdo desta pasta**, inclusive `.github/`.
2. Na aba **Actions**, abra `Sincronizar dados do TSE` e execute **Run workflow**. O workflow também tenta rodar automaticamente no primeiro push e a cada 6 horas.
3. Quando o job terminar, a pasta `data/` terá arquivos como `BA-6.js`, `BA-7.js`, `BA-5.js`, `BA-3.js` e `BR-1.js`.
4. Vá em **Settings → Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**.
6. Selecione `main` e `/(root)`.

> Se o ambiente do GitHub não conseguir baixar o CDN do TSE em algum momento, rode a sincronização localmente e envie a pasta `data/` atualizada ao repositório.

## Sincronizar localmente

Requer Node.js 22+.

```bash
node scripts/sync-tse.mjs
```

No Linux/macOS o script utiliza `unzip`; no Windows utiliza PowerShell `Expand-Archive`.

Também é possível baixar manualmente o ZIP oficial do TSE, extrair em uma pasta e gerar os arquivos locais:

```bash
node scripts/build-data.mjs caminho/para/pasta-extraida data
```

## Abrir localmente

Depois de sincronizar, o `index.html` pode ser aberto diretamente. Para testar PWA/Service Worker, use um servidor HTTP local, por exemplo:

```bash
python -m http.server 8080
```

E abra `http://localhost:8080`.

## Formato da colinha

A impressão usa página A6 e mantém os cargos na ordem da urna. É um **modelo independente**, não uma reprodução oficial da identidade visual do TSE. O nome e a foto aparecem para facilitar a conferência antes da votação.

## Privacidade

As escolhas do eleitor permanecem no `localStorage` do navegador. O site não envia a colinha para servidor.

## Licença e atribuição dos dados

Os dados eleitorais e fotografias pertencem às fontes públicas do TSE e seguem a licença indicada pelo Portal de Dados Abertos. Este projeto deve manter a atribuição ao Tribunal Superior Eleitoral ao redistribuir material derivado dessas fontes.
