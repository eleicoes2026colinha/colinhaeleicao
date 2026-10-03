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
- As escolhas ficam somente na sessão atual: **ao atualizar/recarregar a página, tudo é descartado**.
- Backup manual em JSON continua disponível para quem quiser exportar e reimportar depois.
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

Esta versão **não grava mais a pasta `data/` na branch `main`**. O workflow baixa os dados do TSE em uma execução temporária e publica o resultado diretamente no GitHub Pages. Assim, a sincronização automática não cria commits nem disputa alterações com os seus arquivos.

1. Crie um repositório no GitHub e envie **todo o conteúdo desta pasta**, inclusive `.github/`.
2. Vá em **Settings → Pages** e, em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Na aba **Actions**, execute `Sincronizar dados do TSE e publicar site` uma vez com **Run workflow**.
4. Depois disso, o workflow também será executado em pushes para `main` e automaticamente a cada 6 horas.
5. A pasta `data/` é gerada apenas durante o build publicado no Pages; ela não precisa ser commitada.

> Se o CDN do TSE estiver temporariamente indisponível, o workflow falhará sem modificar a sua branch. Basta executá-lo novamente mais tarde.

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

As escolhas do eleitor permanecem apenas na memória da página durante a sessão atual. **Recarregar a página apaga UF, números, candidatos selecionados e resultados preenchidos.** O site não envia a colinha para servidor. Se o usuário quiser guardar uma colinha, precisa usar explicitamente a função de exportar backup.

## Licença e atribuição dos dados

Os dados eleitorais e fotografias pertencem às fontes públicas do TSE e seguem a licença indicada pelo Portal de Dados Abertos. Este projeto deve manter a atribuição ao Tribunal Superior Eleitoral ao redistribuir material derivado dessas fontes.
