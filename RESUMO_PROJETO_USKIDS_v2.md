# Projeto USKids Golf — Resumo Completo (v2)

## Objetivo

Extrair todos os resultados históricos de torneios internacionais USKids Golf (2005–2026) a partir do site oficial, processar os dados e construir uma aplicação React para análise de jogadores e torneios. O foco principal é acompanhar a evolução de jogadores juniores ao longo dos anos, com especial atenção ao Manuel (11 anos).

---

## Arquitetura do Sistema

### Fonte de Dados

Os resultados estão alojados em **signupanytime.com** e são mostrados no site USKids via iframe cross-origin.

**URL base do site USKids:**
```
https://tournaments.uskidsgolf.com/tournaments/international/past-results?date[value][year]=YYYY&tournament_id=XXXXX
```

**URL base do iframe (signupanytime.com):**
```
https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=XXXX&t=YYYYY
```

### Endpoints da API signupanytime.com

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `LinksAJAX.aspx?op=GetMeta&t={t_param}` | POST | Metadados do torneio: nome, categorias (age_groups), nº rondas, nomes dos buracos |
| `LinksAJAX.aspx?op=GetPlayerTeeTimes&f={flight_id}&r={rounds}&p=1&t={0ou1}` | POST | Dados completos de uma categoria (flight): jogadores, scores hole-by-hole, país, localidade |

### Estrutura do JSON de resposta (GetPlayerTeeTimes)

```json
{
  "flight_players": {
    "player_id": {
      "first": "Pietro",
      "last": "Salvati",
      "place": "Bologna, BO",
      "country": "it",
      "status": 1,
      "score": 69,
      "teeMarkerName": "Tee 1",
      "teeMarkerColor": "Blue",
      "rounds": {
        "1": {
          "strokes": [3,4,4,3,4,3,3,4,4,0,0,0,0,0,0,0,0,0],
          "num_strokes": 32,
          "num_holes": 9,
          "start_hole": 10,
          "start_time": "09:09",
          "flight_round": "250692"
        }
      }
    }
  },
  "flight_teams": {}
}
```

**Notas sobre os dados:**
- O array `strokes` tem sempre 18 posições; os zeros indicam buracos não jogados
- `start_hole` indica de onde o jogador começou (ex: 10 = back nine)
- `status`: 1 = ativo, outro = WD/DNS
- O campo `flight_name` NÃO existe no JSON — o nome da categoria vem do GetMeta ou dos tabs da página

---

## Pipeline de Dados — 4 Passos

### Passo 1 — Lista de Torneios

**Onde correr:** Na consola do browser, em `tournaments.uskidsgolf.com`

**O que faz:** Para cada ano (2005–2026), navega às páginas de past-results e extrai a lista de torneios do dropdown `edit-jump` + o URL do iframe associado.

**Como funciona:**
1. Iterar anos 2005–2026, fazendo fetch de cada página `/tournaments/international/past-results?date[value][year]=YYYY`
2. Em cada página, ler o `<select id="edit-jump">` que contém os torneios desse ano
3. Cada `<option>` tem formato: `value="HASH::/tournaments/international/past-results?tournament_id=XXXXXX"` e `text="Nome do Torneio (data)"`
4. Para obter o iframe URL, fazer fetch da página de cada torneio e procurar `signupanytime.com` no HTML

**Output:** 178 torneios com `{name, year, tournament_id, iframe_url}`

### Passo 2 — Scraping dos Resultados

**Onde correr:** Na consola do browser, aberto em qualquer página de `signupanytime.com`

**O que faz:** Para cada torneio, obtém os flight IDs e depois chama GetPlayerTeeTimes para cada flight/categoria.

#### ✅ DESCOBERTA CRÍTICA: Como obter os Flight IDs

**Os flight IDs estão num `<select>` com id `view_flight_age_group` na página do iframe!**

Ao fazer fetch da página do iframe (`linksviews.aspx?v=results&fmt=nohead&ax=XXXX&t=YYYY`), o HTML contém:

```html
<select id="view_flight_age_group">
  <option value="13517" selected="">Boys 7 &amp; Under</option>
  <option value="13518">Boys 8</option>
  <option value="13519">Boys 9</option>
  <option value="13520">Boys 10</option>
  ...
</select>
```

**O `value` de cada `<option>` é o flight ID real!** Exemplo do British Championship 2015:

| Flight ID | Categoria |
|-----------|-----------|
| 13517 | Boys 7 & Under |
| 13518 | Boys 8 |
| 13519 | Boys 9 |
| 13520 | Boys 10 |
| 13521 | Boys 11 |
| 13522 | Boys 12 |
| 13526 | Girls 8 & Under |
| 13527 | Girls 9 |
| 13528 | Girls 10 |
| 13529 | Girls 11 |
| 13530 | Girls 12 |

**Confirmado:** O endpoint `GetPlayerTeeTimes` funciona com estes IDs. Teste com `f=13517` devolveu **22 jogadores** (Boys 7 & Under).

**Nota:** Os IDs são maioritariamente consecutivos para o mesmo torneio, mas podem ter gaps (ex: 13522 → 13526).

#### Bug do método anterior (brute force)

O passo 2 original usava brute force (±40 a partir de um seed) para adivinhar IDs. Isto capturou flights de torneios completamente diferentes porque os IDs são **globais na plataforma signupanytime.com**.

#### Método correto (novo)

1. Fazer fetch da página iframe do torneio
2. Parsear o HTML para extrair o `<select id="view_flight_age_group">`
3. Ler o `value` e `text` de cada `<option>`
4. Chamar `GetPlayerTeeTimes&f={value}&r=2&p=1&t=0` para cada um
5. Se `t=0` não devolver dados, tentar `t=1`

**Este método funciona via fetch dentro do browser no domínio signupanytime.com (sem problemas de CORS).**

### Passo 3 — Combinação (`passo3_combinar.py`)

**Onde correr:** Localmente com Python

**O que faz:** Lê todos os JSONs individuais dos torneios, mapeia flight IDs para categorias (pela ordem dos tabs do GetMeta), extrai jogadores com scores detalhados, e combina tudo num `uskids_complete.json`.

### Passo 4 — Diagnóstico (`passo4_diagnostico.js`)

**Onde correr:** Na consola do browser, em qualquer página

**O que faz:** Analisa o `uskids_complete.json` e identifica torneios com dados corrompidos. Deteta:
- CROSS_DUP: flights com jogadores de outro torneio (fingerprint por primeiros 8 nomes)
- PARTIAL: menos categorias do que esperado
- INCOMPLETE: apenas 1 categoria quando deviam ser 15+
- EMPTY: sem dados
- DUP_INTERNAL: flights duplicados dentro do mesmo torneio

---

## Estado Atual dos Dados

### Resultado do Diagnóstico Original (177 torneios)

| Estado | Quantidade | Descrição |
|--------|-----------|-----------|
| ✅ OK | 26 | Dados corretos e completos |
| ❌ CROSS_DUP | 149 | Dados de outros torneios (brute force errado) |
| ⚠️ PARTIAL | 84 | Categorias em falta (tipicamente 5 de 14) |

### O que temos agora

- **178 torneios** identificados (2005–2026) via scraping do site USKids
- **Método de extração de flight IDs descoberto e confirmado** (select `view_flight_age_group`)
- **Pipeline de scraping pronto para ser executado** — falta correr o script final nos 178 torneios
- **26 torneios** com dados corretos do scraping anterior (podem ser mantidos ou re-extraídos)

---

## Extração dos Iframe URLs

### Como encontrar torneios no site USKids

1. Página base: `https://tournaments.uskidsgolf.com/tournaments/international/past-results`
2. Dropdown de anos: `<select id="edit-date-value-year">` com opções 2002–2026
3. Dropdown de torneios: `<select id="edit-jump">` com opções por ano
4. Cada opção tem `tournament_id` no value
5. Para obter o iframe URL, carregar a página do torneio e procurar `signupanytime.com` no HTML

### Processo de extração automático (consola do browser)

**Fase 1 — Listar torneios:** Iterar anos, extrair de `edit-jump` → 178 torneios
**Fase 2 — Obter iframe URLs:** Fetch de cada página de torneio, extrair URL do signupanytime.com
**Fase 3 — Scraping:** Em signupanytime.com, para cada iframe URL:
  1. Fetch do HTML → extrair `<select id="view_flight_age_group">`
  2. Para cada option → `GetPlayerTeeTimes&f={value}`
  3. Guardar dados

---

## Aplicação React (`USKidsApp.jsx`)

### Funcionalidades

**Vista de Torneios:**
- Lista de todos os torneios com filtro por nome
- Detalhe do torneio: leaderboard por categoria, scorecards hole-by-hole
- Links para os resultados originais (iframe_url e uskidsgolf.com)

**Vista de Jogadores:**
- Pesquisa por nome
- Histórico de participações com posição, score, categoria
- Gráfico de evolução (total strokes ao longo do tempo)
- Scorecards hole-by-hole de cada participação
- Links para cada torneio na vista de jogador

### Agregação Inteligente de Jogadores

O mesmo jogador pode aparecer em múltiplos torneios ao longo dos anos, mudando de categoria. A agregação usa:

- **Mesmo nome + mesmo país** como candidatos a merge
- **Validação de género:** M ≠ F nunca se juntam
- **Consistência temporal de idades:** A idade não pode diminuir ao longo do tempo (tolerância ±1 ano para edge cases de aniversário)
- **Estimativa de ano de nascimento:** Calculada a partir da categoria e do ano do torneio, com desvio máximo de ±2 anos
- **Não pode jogar duas categorias no mesmo torneio**

### Extração de Idades das Categorias

A função `extractAgeRange()` lida com todos os formatos:
- `"Boys 10"` → {min: 10, max: 10}
- `"Boys 13-14"` → {min: 13, max: 14}
- `"Boys 7 & Under"` → {min: 5, max: 7}
- `"Girls 8 Under"` → {min: 5, max: 8}

### Carregamento de Dados

A app recebe um ficheiro JSON (`uskids_complete.json`) via upload. O JSON é processado no browser — não há backend.

---

## Notas Técnicas Importantes

1. **CORS:** O browser bloqueia fetch de signupanytime.com quando a página está no domínio uskidsgolf.com. Solução: abrir o iframe URL diretamente ou fazer o scraping na tab de signupanytime.com.

2. **Variável `var` vs `let`:** Na consola do browser, `let` dá erro de re-declaração se corrido múltiplas vezes. Usar sempre `var` nos scripts de consola.

3. **Flight IDs são globais:** Na plataforma signupanytime.com, o ID `f=236703` identifica uma categoria de UM torneio específico em toda a plataforma. Não são relativos ao torneio.

4. **Parâmetro `t` no GetPlayerTeeTimes:** Alterna entre 0 e 1. O valor correto depende do torneio — o script deve tentar ambos e usar o que devolver dados.

5. **Categorias variam por torneio:** Nem todos têm 14 categorias. Van Horn Cup tem 10 (sem categorias individuais de rapazes/raparigas mais velhos). Torneios antigos têm formatos diferentes.

6. **Dados completos incluem hole-by-hole:** Cada jogador tem strokes para cada buraco, não apenas totais. Isto permite análise detalhada (ex: z-scores por buraco, padrões de ansiedade na primeira ronda).

7. **Variáveis na consola perdem-se:** Se mudares de tab ou a consola for limpa, as variáveis desaparecem. Scripts longos devem ser auto-contidos (redeclarar tudo).

8. **Rate limiting:** Ao fazer muitos requests seguidos, usar `setTimeout` com delays (ex: 500ms entre requests) para não sobrecarregar o servidor.

---

## O Que Falta Fazer

### 1. ✅ Descobrir método de extração de flight IDs — FEITO!

Flight IDs estão no `<select id="view_flight_age_group">` da página iframe.

### 2. Obter lista completa de torneios com iframe URLs (em curso)

Já temos os 178 torneios listados. Falta extrair os iframe URLs de cada um.

### 3. Scraping completo dos 178 torneios

Criar script auto-contido que:
1. Percorra a lista de torneios com iframe URLs
2. Para cada um, faça fetch do iframe → extraia flight IDs do select
3. Para cada flight, chame GetPlayerTeeTimes
4. Guarde tudo num JSON final

### 4. Melhorias à App (secundário)

- Filtro por país/categoria
- Export de dados para Excel
- Gráficos de comparação entre jogadores
- Integração com dados da Federação Portuguesa de Golfe (FPG)
