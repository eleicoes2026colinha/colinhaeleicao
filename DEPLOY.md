# Publicação no GitHub Pages

Este projeto usa um workflow próprio para gerar os dados do TSE antes de publicar o site.

## 1. Envie o pacote completo ao repositório

Os arquivos `index.html`, `app.js`, `styles.css`, `scripts/` e `.github/workflows/deploy-pages.yml` devem ficar na raiz do repositório exatamente como estão neste pacote.

Se existir um workflow antigo como `.github/workflows/sync-tse.yml`, remova-o para evitar dois processos de publicação concorrentes.

## 2. Configure o Pages

No GitHub, abra:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Não use **Deploy from a branch** para esta versão.

## 3. Execute o workflow

Abra **Actions → Sincronizar TSE e publicar GitHub Pages → Run workflow**.

O workflow:

1. baixa a base oficial de candidaturas de 2026 do TSE;
2. cria os arquivos `data/UF-CARGO.js`;
3. valida os pacotes eleitorais;
4. tenta gerar miniaturas locais das fotos oficiais;
5. monta `_site/`;
6. envia o artefato ao GitHub Pages;
7. publica o site.

A etapa de fotos é complementar e não bloqueia a publicação dos dados eleitorais.

## 4. Teste rápido

Depois do workflow terminar em verde, abra no navegador, ajustando o domínio/nome do repositório:

`https://SEU-USUARIO.github.io/SEU-REPOSITORIO/data/BR-1.js`

Também teste uma UF, por exemplo:

`https://SEU-USUARIO.github.io/SEU-REPOSITORIO/data/BA-6.js`

Esses endereços devem retornar JavaScript com candidaturas, e não erro 404.

## 5. Cache/PWA

Depois da primeira publicação desta versão, faça uma atualização forçada (`Ctrl + F5`) uma vez. O projeto já usa política de atualização para evitar que versões antigas de `app.js` fiquem presas no PWA.
