# Diagnostico Cloudflare — AutoViral Meta API

O erro observado foi `Failed: root directory not found`.

## Evidencias

Na branch `feat/autoviral-data-core`, o repositorio contem `workers/meta-api/package.json`, `workers/meta-api/wrangler.toml`, `workers/meta-api/tsconfig.json` e `workers/meta-api/src/index.ts`. A consulta equivalente na branch `main` retornou 404 para `workers`, indicando que essa pasta nao existe nessa branch.

O registro de build enviado pelo usuario identificou `main`, embora a configuracao de producao depois tenha sido alterada para `feat/autoviral-data-core`. A hipotese principal e que o build que falhou clonou `main`, sem a pasta configurada como diretorio raiz.

## Configuracao esperada

- Repositorio: `teachermarcelo/auto-viral`
- Branch de producao: `feat/autoviral-data-core`
- Diretorio raiz: `workers/meta-api` (sem barra inicial)
- Comando de build: vazio
- Comando de implantacao: `npx wrangler deploy`
- Secrets: `META_APP_SECRET` e `TOKEN_ENCRYPTION_KEY` (nao registrar seus valores)

## Proximo teste

1. Confirmar e salvar a branch `feat/autoviral-data-core` nas configuracoes de compilacao da Cloudflare.
2. Gerar um novo build pelo repositorio conectado, sem selecionar `main` manualmente.
3. Abrir o build e confirmar que o registro identifica `feat/autoviral-data-core`.
4. Se ainda falhar, coletar o log completo desde a clonagem ate a primeira linha de erro.

## Criterios de conclusao

- [ ] Build usa a branch correta.
- [ ] Cloudflare encontra `workers/meta-api`.
- [ ] Wrangler executa `npx wrangler deploy` com sucesso.
- [ ] Endpoint `/health` responde.
- [ ] OAuth da Meta e testado separadamente.

Este documento registra evidencias e uma hipotese; nao afirma que o Worker ja foi implantado ou que o OAuth funciona.