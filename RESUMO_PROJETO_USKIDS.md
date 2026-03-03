# Projeto USKids Golf — Resumo Completo

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

### Passo 1 — Lista de Torneios (`passo1_lista_torneios.js`)

**Onde correr:** Na consola do browser, em `tournaments.uskidsgolf.com`

**O que faz:** Para cada ano (2005–2026), navega às páginas de past-results e extrai a lista de torneios do dropdown + o URL do iframe associado. Gera um JSON com 177 torneios.

**Output:** Array com `{name, year, tournament_id, date, iframe_url}`

### Passo 2 — Scraping dos Resultados (`passo2_definitivo.js`)

**Onde correr:** Na consola do browser, aberto em qualquer página de `signupanytime.com`

**O que faz:** Para cada torneio, chama GetMeta para obter as categorias e depois GetPlayerTeeTimes para cada flight/categoria.

**Problema crítico — Flight IDs:**

Os flight IDs (parâmetro `f=`) identificam cada categoria num torneio. Existem dois formatos:

| Período | Formato Flight ID | Exemplo | Como obter |
|---------|-------------------|---------|------------|
| Pré-2013 | `_{t_param}_{age_group_key}` | `_11_Boys 10` | Construído a partir do GetMeta ✅ |
| 2013+ | IDs numéricos globais | `236703`, `48442` | **NÃO estão no GetMeta** ❌ |

**Para torneios pré-2013:** Os flight IDs são construídos diretamente — funciona perfeitamente.

**Para torneios 2013+:** O script usou **brute force** (±40 a partir de um seed) para adivinhar IDs. Isto causou o **bug principal**: os IDs são **globais na plataforma signupanytime.com**, não específicos do torneio. O brute force capturou flights de torneios completamente diferentes!

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

### Resultado do Diagnóstico (177 torneios)

| Estado | Quantidade | Descrição |
|--------|-----------|-----------|
| ✅ OK | 26 | Dados corretos e completos |
| ❌ CROSS_DUP | 149 | Dados de outros torneios (brute force errado) |
| ⚠️ PARTIAL | 84 | Categorias em falta (tipicamente 5 de 14) |

**Torneios OK (índices 0-28, com gaps):** 0–11, 13–24, 27–28

São os torneios mais antigos (2005–2017) onde o formato de flight ID antigo ou os seeds conhecidos funcionaram.

**A partir do índice 12 (Van Horn Cup 2015):** Os dados estão corrompidos em cascata — cada torneio tem flights que na realidade pertencem ao torneio anterior.

**A partir de ~2023:** Quase todos são PARTIAL com apenas 5 de 14 categorias, sugerindo que o brute force encontrou poucos IDs válidos.

### Dados que temos e que estão bons

O ficheiro `backup_30.json` (gerado após os primeiros 30 torneios) contém ~17MB de dados. No entanto, mesmo aí, 22 dos 23 torneios mais recentes tinham apenas 1 categoria.

O ficheiro `uskids_complete.json` contém todos os 177 torneios mas com dados maioritariamente corrompidos.

---

## Solução Descoberta para os Flight IDs

### Método correto: Interceptar AJAX no browser

Testámos manualmente no Marco Simone Invitational 2025 e descobrimos o seguinte:

1. Abrir o URL do iframe numa tab separada (em signupanytime.com)
2. Ativar um **interceptor de XMLHttpRequest** na consola
3. Clicar manualmente em cada tab de categoria (Boys 7, Boys 8, etc.)
4. Cada clique dispara um AJAX: `GetPlayerTeeTimes&f={flight_id_real}`
5. O interceptor captura o flight ID e a resposta JSON completa

**Exemplo capturado (Marco Simone 2025):**
```
f=236703 → Boys 7 & Under   (12 jogadores)
f=236704 → Boys 8            (12 jogadores)
f=236705 → Boys 9            (14 jogadores)
f=236706 → Boys 10           (15 jogadores)
f=236707 → Boys 11           (12 jogadores)
f=236708 → Boys 12           (13 jogadores)
f=236709 → Boys 13-14        (15 jogadores)
f=236710 → Boys 15-18        (8 jogadores)
f=236711 → Girls 8 & Under   (5 jogadores)
f=236712 → Girls 9            (5 jogadores)
f=236713 → Girls 10           (7 jogadores)
f=236714 → Girls 11-12        (6 jogadores)
f=236715 → Girls 13-14        (3 jogadores)
f=236716 → Girls 15-18        (6 jogadores)
```

**Nota:** Os IDs são consecutivos para o mesmo torneio (236703-236716), mas com possíveis gaps. O mapeamento para categorias segue a ordem dos tabs na página.

### Script de captura manual (consola do browser)

```javascript
// PASSO 1: Ativar interceptor (na tab do signupanytime.com)
var allResults = {};
var captureCount = 0;
var origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function() {
  this.addEventListener('load', function() {
    var url = this.responseURL || '';
    if (url.includes('GetPlayerTeeTimes')) {
      var fMatch = url.match(/f=(\d+)/);
      var fId = fMatch ? fMatch[1] : 'unknown';
      try {
        var parsed = JSON.parse(this.responseText);
        if (parsed.flight_players && Object.keys(parsed.flight_players).length > 0) {
          allResults[fId] = this.responseText;
          captureCount++;
          console.log('[' + captureCount + '] Flight ' + fId +
                      ': ' + Object.keys(parsed.flight_players).length + ' jogadores');
        }
      } catch(e) {}
    }
  });
  origSend.apply(this, arguments);
};

// PASSO 2: Clicar em CADA tab de categoria manualmente

// PASSO 3: Exportar
copy(JSON.stringify(allResults));
console.log('JSON copiado para o clipboard!');
```

**Limitações desta abordagem:**
- Requer intervenção manual (clicar em cada tab)
- Não escala para 151 torneios
- O fetch direto de dentro do browser é bloqueado por CORS

### Próximos passos para automatizar

**Opção A — Python com requests (sem CORS):** Se o endpoint aceitar pedidos sem cookies de sessão, podemos chamar GetPlayerTeeTimes diretamente de Python. Precisa de testar.

**Opção B — Parsing do HTML/JavaScript do iframe:** A página do iframe contém JavaScript que sabe todos os flight IDs (para renderizar os tabs). Precisamos de analisar o HTML da página para extrair esses IDs. O `passo_discovery.js` foi criado para isto mas ainda não foi corrido.

**Opção C — Automação com Puppeteer/Playwright:** Abrir cada torneio num browser headless, interceptar os AJAX calls automaticamente.

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

## Ficheiros Entregues

| Ficheiro | Descrição |
|----------|-----------|
| `passo1_lista_torneios.js` | Extrai lista de 177 torneios do site USKids |
| `passo2_definitivo.js` | Scraping completo com GetMeta + brute force (tem o bug dos flight IDs) |
| `passo2_individual.js` | Versão para raspar um torneio de cada vez |
| `passo2_todos.js` | Versão batch alternativa |
| `passo3_combinar.py` | Combina JSONs individuais num ficheiro único processado |
| `passo4_diagnostico.js` | Analisa `uskids_complete.json` e identifica torneios corrompidos |
| `passo_discovery.js` | Script para descobrir como o iframe armazena flight IDs |
| `USKidsApp.jsx` | Aplicação React completa para análise de torneios e jogadores |

---

## O Que Falta Fazer

### 1. Descobrir método de extração de flight IDs (prioridade máxima)

Correr o `passo_discovery.js` em signupanytime.com para analisar o HTML/JavaScript do iframe e perceber onde os flight IDs estão armazenados. Ou testar se o endpoint GetPlayerTeeTimes funciona diretamente via Python/requests sem cookies.

### 2. Re-scraping dos 151 torneios corrompidos

Criar um novo script (passo 2 v3) que use o método correto de obter flight IDs. Só precisamos de re-raspar os torneios com problemas — os 26 OK ficam como estão.

### 3. Merge dos dados corrigidos

Combinar os 26 torneios bons do ficheiro atual com os dados corrigidos dos 151 restantes.

### 4. Melhorias à App (secundário)

- Filtro por país/categoria
- Export de dados para Excel
- Gráficos de comparação entre jogadores
- Integração com dados da Federação Portuguesa de Golfe (FPG)

---

## Notas Técnicas Importantes

1. **CORS:** O browser bloqueia fetch de signupanytime.com quando a página está no domínio uskidsgolf.com. Solução: abrir o iframe URL diretamente ou usar Python.

2. **Variável `var` vs `let`:** Na consola do browser, `let` dá erro de re-declaração se corrido múltiplas vezes. Usar sempre `var` nos scripts de consola.

3. **Flight IDs são globais:** Na plataforma signupanytime.com, o ID `f=236703` identifica uma categoria de UM torneio específico em toda a plataforma. Não são relativos ao torneio.

4. **Parâmetro `t` no GetPlayerTeeTimes:** Alterna entre 0 e 1. O valor correto depende do torneio — o script tenta ambos e usa o que devolver dados.

5. **Categorias variam por torneio:** Nem todos têm 14 categorias. Van Horn Cup tem 10 (sem categorias individuais de rapazes/raparigas mais velhos). Torneios antigos têm formatos diferentes.

6. **Dados completos incluem hole-by-hole:** Cada jogador tem strokes para cada buraco, não apenas totais. Isto permite análise detalhada (ex: z-scores por buraco, padrões de ansiedade na primeira ronda).
