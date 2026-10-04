# Minha Colinha Eleitoral 2026 — edição profissional + exportação social

Site estático, responsivo e neutro para montar uma colinha eleitoral pessoal com **busca unificada por nome ou número**, dados públicos sincronizados do TSE, impressão A6 e exportação para redes sociais.

## Principais recursos

- Seleção da UF.
- Ordem da votação de 2026: deputado federal, deputado estadual/distrital, senador 1, senador 2, governador e presidente.
- Um único campo por cargo aceita **número ou nome**.
- Busca por nome de urna ou nome completo, ignorando acentos e diferenças de maiúsculas/minúsculas.
- Preenchimento automático de número, nome de urna, partido, situação e foto.
- Deduplicação por `SQ_CANDIDATO` na sincronização e na interface.
- Validação para impedir a mesma candidatura nas duas vagas do Senado.
- Prévia permanente e impressão em **A6**.
- As escolhas existem apenas na sessão atual e são **apagadas ao recarregar a página**.
- Backup JSON manual, opcional.
- PWA / Service Worker.

## Novo layout

A interface foi reorganizada em uma jornada de uso:

1. Definir a UF.
2. Pesquisar as candidaturas.
3. Acompanhar o progresso dos seis votos.
4. Revisar a colinha.
5. Imprimir, gerar backup ou compartilhar.

O layout usa uma hierarquia visual mais profissional, cartões de candidatura, prévia fixa em desktop, painel de ações e informações claras sobre fonte e privacidade.

## Exportação para redes sociais

O botão **Compartilhar** é habilitado assim que pelo menos uma candidatura é escolhida.

Ele abre uma área própria de exportação com:

- card PNG vertical em **1080 × 1350 px (4:5)**;
- compartilhamento nativo pelo dispositivo via Web Share API quando suportado;
- download do card em PNG;
- cópia de um resumo textual;
- atalhos para WhatsApp, Telegram, X e Facebook.

No celular, o compartilhamento nativo permite escolher aplicativos instalados, incluindo redes sociais compatíveis com o sistema. No desktop, o download do PNG permite publicar manualmente em serviços que não oferecem uma API de compartilhamento direto pelo navegador.

As fotos dos candidatos são tentadas no card social por CORS. Se o serviço oficial de imagens não permitir a leitura da fotografia pelo Canvas, o card usa automaticamente uma identificação visual com a inicial do nome, sem impedir a exportação.

Nada é compartilhado automaticamente: a ação só é iniciada depois do clique do usuário.

## Fonte oficial

A sincronização usa o arquivo público do TSE:

`https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip`

O script lê campos oficiais como `SG_UF`, `CD_CARGO`, `SQ_CANDIDATO`, `NR_CANDIDATO`, `NM_URNA_CANDIDATO`, `NM_CANDIDATO`, `SG_PARTIDO` e `DS_SITUACAO_CANDIDATURA` e gera arquivos pequenos por UF e cargo em `data/`.

As fotografias são exibidas pelo serviço oficial do DivulgaCandContas usando o identificador da candidatura.

## GitHub Pages

A sincronização **não escreve na branch `main`**. O workflow gera os dados durante o build e publica diretamente no GitHub Pages.

1. Envie todo o conteúdo da pasta para o repositório, inclusive `.github/`.
2. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
3. Na aba **Actions**, execute `Sincronizar dados do TSE e publicar site` uma vez com **Run workflow**.
4. O workflow também executa em pushes para `main` e automaticamente a cada 6 horas.

## Sincronizar localmente

Requer Node.js 22+.

```bash
node scripts/sync-tse.mjs
```

Para testar PWA / Service Worker:

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`.

## Privacidade

As escolhas permanecem apenas na memória da página. **Atualizar ou recarregar apaga UF, números e candidatos selecionados.** O site não envia a colinha para um servidor. O compartilhamento só ocorre depois de uma ação explícita do usuário.

## Observação institucional

Este é um projeto independente. Não recomenda candidaturas e não possui vínculo institucional com a Justiça Eleitoral. Os dados e fotografias são atribuídos às fontes públicas do Tribunal Superior Eleitoral.

## Fotos oficiais e exportação social

A versão atual não depende de proxy de imagens. Durante o workflow, o GitHub Actions baixa os pacotes oficiais de fotos de candidatos publicados pelo TSE por UF, gera miniaturas WebP e as inclui no artefato do GitHub Pages em `photos/<UF>/<SQ_CANDIDATO>.webp`.

A tela de preenchimento tenta primeiro a miniatura local e, caso ela ainda não exista, volta automaticamente para a foto direta do DivulgaCand. Já o card de redes sociais usa exclusivamente a miniatura local, evitando CORS e permitindo a exportação do Canvas em PNG.

Na primeira execução, o workflow pode levar mais tempo porque precisa montar o cache inicial de fotografias. As execuções seguintes restauram o cache do GitHub Actions e consultam os metadados dos pacotes para reprocesar apenas UFs alteradas.


## Busca numérica inteligente

O campo unificado também faz pesquisa progressiva por número. A cada algarismo digitado, o site sugere candidaturas do cargo atual, priorizando números que começam com a sequência informada. Com um número completo, uma correspondência única é selecionada automaticamente. Se o número completo não existir, são sugeridos números próximos, inclusive com tolerância limitada a erros de digitação.


## Logo

Esta versão inclui um novo logo de urna eletrônica aplicado ao cabeçalho do site e aos ícones do PWA (favicon, atalho e instalação).


## Atualização v12 — busca numérica e cache

A busca por número é progressiva: ao digitar `13` em um cargo de quatro dígitos, a interface já lista candidaturas cujo número começa com `13`, sem exigir o número completo. A versão v12 também altera o PWA para usar estratégia network-first nos arquivos da aplicação e registra o Service Worker com `updateViaCache: none`, reduzindo o risco de o GitHub Pages continuar exibindo JavaScript antigo após um novo commit.

## Correção dos erros 404 em `data/*.js`

A versão v13 publica o site a partir de um diretório de build (`_site`) criado pelo workflow. Antes do deploy, o workflow valida a existência dos pacotes eleitorais, incluindo `BR-1.js`, `BA-3.js`, `BA-5.js`, `BA-6.js` e `BA-7.js`. Se a sincronização falhar, o deploy é interrompido em vez de publicar um site aparentemente funcional sem a base eleitoral.

**Configuração obrigatória uma única vez no GitHub:** abra **Settings → Pages → Build and deployment → Source** e escolha **GitHub Actions**. Não use “Deploy from a branch” para esta arquitetura, pois a branch `main` contém apenas o `data/status.js` inicial; os arquivos `data/UF-CARGO.js` são gerados durante o workflow e existem no artefato do Pages, não na `main`.

Depois, abra **Actions → Sincronizar TSE e publicar GitHub Pages → Run workflow**. No log, devem aparecer as etapas **Validar arquivos eleitorais gerados**, **Validar artefato final do Pages** e **Publicar no GitHub Pages** em verde.

A sincronização de fotos agora é complementar: se o CDN das fotos falhar temporariamente, o site ainda publica os dados de candidatos e a pesquisa continua funcionando.

## Pacote completo — deploy pelo GitHub Actions

A versão deste pacote deve ser publicada com **Settings → Pages → Source: GitHub Actions**. O workflow ativo é `.github/workflows/deploy-pages.yml`. Remova workflows antigos de sincronização/publicação para evitar concorrência. Consulte `DEPLOY.md` para o passo a passo.
