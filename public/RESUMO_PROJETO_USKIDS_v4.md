# Projeto USKids Golf — Resumo Completo (v4 — Março 2026)

## Objetivo

Construir uma plataforma completa de dados USKids Golf com dois eixos: (1) um pipeline de scraping para extrair resultados históricos de torneios (2002–2026) em todas as categorias, e (2) uma aplicação React para visualizar e analisar dados de jogadores, rankings e torneios. O foco é acompanhar a evolução de jogadores juniores ao longo dos anos, com especial atenção ao Manuel (11 anos).

---

## ESTADO ATUAL (Março 2026)

### Mapeamento de Torneios — CONCLUÍDO

**1145 torneios** mapeados em 8 categorias, dos quais **613 com acesso API** (parâmetro `signupanytime_t`).

| Categoria | Total | Com t= | Cobertura | Estado |
|-----------|------:|-------:|----------:|--------|
| State | 702 | 213 | 30% | ✅ Completo (maioria pré-2013) |
| Teen Series | 189 | 189 | 100% | ✅ Completo |
| Regional | 161 | 133 | 83% | ✅ Completo |
| World | 44 | 33 | 75% | ✅ Completo |
| Teen World | 23 | 19 | 83% | ✅ Completo |
| International Local | 15 | 15 | 100% | ⚠️ Parcial (só torneios actuais) |
| Girls Invitationals | 11 | 11 | 100% | ✅ Completo |
| Local Tours (US) | 0 | 0 | — | ❌ Vazio |

Os **532 torneios sem t=** são quase todos anteriores a 2013, quando o signupanytime não era usado.

### Scraping de Scorecards (Fase 3) — EM CURSO

**Dataset anterior (Internacional apenas):** `uskids_complete_v2.json` (~22MB) — 178 torneios, 2488 categorias, 28.001 jogadores com scorecards hole-by-hole. Taxa de sucesso: 177/178 (99.4%).

**Dataset multi-categoria (novo):** ~60 ficheiros batch (`scorecards_v2_batch_XXX.json`), ~3–5MB cada, ~200MB total. Cada batch cobre 10 torneios com meta + flights + scorecards por jogador (hole-by-hole).

**Próximo passo:** Consolidar os ~60 batches num dataset único sem duplicados.

### Aplicação React — FUNCIONAL

`USKidsApp.jsx` (~846 linhas) com design visual completo. Quatro vistas: Dashboard, Rankings (4 modos), Torneios, Jogadores.

---

## Arquitetura do Sistema

### Cadeia de Dados

```
uskidsgolf.com (dropdowns de anos/torneios por categoria)
  → iframe → signupanytime.com (resultados reais)
    → API: GetMeta (metadados), GetPlayerTeeTimes (scorecards hole-by-hole)
```

### Dois Identificadores-Chave

| ID | Onde vive | Para que serve |
|----|-----------|---------------|
| `tournament_id` | URL do uskidsgolf.com | Identificar o torneio no site USKids |
| `t` (signupanytime) | URL do iframe / API | Aceder aos resultados na API signupanytime |

### URLs Base

**Site USKids (por categoria):**
```
https://tournaments.uskidsgolf.com/tournaments/{slug}/past-results?date[value][year]=YYYY&tournament_id=XXXXX
```

Slugs disponíveis: `world`, `regional`, `teen-world`, `state`, `girls-invitationals`, `teen-series`, `local-tours`

**Iframe signupanytime:**
```
https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=YYYYY
```

`ax=1129` é o ID da aplicação USKids na plataforma signupanytime (constante).

### Endpoints da API signupanytime.com

| Endpoint | Descrição |
|----------|-----------|
| `LinksAJAX.aspx?op=GetMeta&t={t}` | Metadados: nome, age_groups, courses, **flights** (IDs reais), nº rondas |
| `LinksAJAX.aspx?op=GetPlayerTeeTimes&f={flight_id}&r=2&p=1&t=0` | Scorecards completos de uma categoria/flight |

### Estrutura do JSON de resposta (GetPlayerTeeTimes)

```json
{
  "flight_players": {
    "player_id": {
      "first": "Manuel",
      "last": "Silva",
      "place": "Lisboa, PT",
      "country": "pt",
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
  }
}
```

**Notas sobre os dados:**
- Array `strokes` tem sempre 18 posições; zeros = buracos não jogados
- `start_hole` indica buraco de partida (ex: 10 = back nine)
- `status`: 1 = activo, outro = WD/DNS
- `flight_name` NÃO existe no GetPlayerTeeTimes — o nome vem do GetMeta (age_groups)
- Sem informação de par por buraco na API (apenas estimativa: 3 para 9 buracos, 4 para 18)

---

## Pipeline de Dados — 3 Fases

### FASE 1: Listar Torneios (por categoria)

**Onde correr:** Consola do browser em `tournaments.uskidsgolf.com`

Iterar anos (2002–2026) via `fetch()` e extrair `tournament_id` do dropdown `edit-jump`. Usar `fetch()` em vez de mudar o dropdown (a página faz reload completo e mata o script).

```javascript
(async function(){
  var baseUrl = 'https://tournaments.uskidsgolf.com/tournaments/{SLUG}/past-results?date%5Bvalue%5D%5Byear%5D=';
  var years = [];
  for(var y=2002; y<=2026; y++) years.push(y);
  var all = [];
  for(var i=0; i<years.length; i++){
    var year = years[i];
    document.title = (i+1) + '/' + years.length + ' - ' + year;
    try {
      var resp = await fetch(baseUrl + year, {credentials:'include'});
      var html = await resp.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var jumpSel = doc.getElementById('edit-jump');
      if(jumpSel){
        for(var j=0; j<jumpSel.options.length; j++){
          var o = jumpSel.options[j];
          if(o.value && o.value !== ''){
            var match = o.value.match(/tournament_id=(\d+)/);
            if(match) all.push({year: year, tournament_id: match[1], name: o.text.trim()});
          }
        }
      }
    } catch(e){ console.error('Erro no ano ' + year, e); }
  }
  document.title = 'DONE: ' + all.length + ' torneios';
  window._TOURNAMENTS = all;
  var blob = new Blob([JSON.stringify(all, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '{SLUG}_tournament_ids.json';
  a.click();
})();
```

Substituir `{SLUG}` pelo slug da categoria.

### FASE 2: Mapear tournament_id → signupanytime t=

Para cada torneio, fazer fetch da página individual e extrair o parâmetro `t=` do iframe signupanytime:

```javascript
(async function(){
  var data = window._TOURNAMENTS;
  var slug = '{SLUG}';
  var results = [];
  for(var i=0; i<data.length; i++){
    var t = data[i];
    var url = 'https://tournaments.uskidsgolf.com/tournaments/' + slug +
              '/past-results?date%5Bvalue%5D%5Byear%5D=' + t.year +
              '&tournament_id=' + t.tournament_id;
    document.title = (i+1) + '/' + data.length + ' - ' + t.name;
    try {
      var resp = await fetch(url, {credentials:'include'});
      var html = await resp.text();
      var signupMatch = html.match(/signupanytime\.com[^"']*[?&]t=(\d+)/);
      results.push({year:t.year, tournament_id:t.tournament_id, name:t.name, signupanytime_t:signupMatch?signupMatch[1]:null});
    } catch(e){
      results.push({year:t.year, tournament_id:t.tournament_id, name:t.name, signupanytime_t:null});
    }
    await new Promise(r => setTimeout(r, 300));
  }
  document.title = 'DONE: ' + results.filter(r=>r.signupanytime_t).length + '/' + results.length;
  window._MAPPED = results;
  var blob = new Blob([JSON.stringify(results, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = slug + '_tournaments_mapped.json';
  a.click();
})();
```

### FASE 3: Extrair Scorecards (API signupanytime)

#### Descoberta de Flight IDs — Método Dual

Existem **dois métodos** para obter os flight IDs reais, dependendo da idade do torneio:

**Método A — HTML iframe select (torneios mais antigos ~2013–2018):**
O `<select id="view_flight_age_group">` está pré-populado no HTML da página iframe. Funciona via fetch directo.

**Método B — GetMeta API → `meta.flights` (torneios mais recentes ~2019+):**
O select está vazio no HTML (preenchido por JavaScript). Os flight IDs reais estão em `meta.flights`:

```json
{
  "flights": {
    "216325": { "age_group": "83", "teeMarker": "33", "active": 3, "round_count": 2 },
    "216326": { "age_group": "84", "teeMarker": "33", "active": 3, "round_count": 2 }
  },
  "age_groups": {
    "83": { "name": "Boys 7 & Under", "gender": "Boys", "min_age": 5 },
    "84": { "name": "Boys 8", "gender": "Boys", "min_age": 8 }
  }
}
```

**CRÍTICO:** Nunca usar os IDs de `age_groups` (82, 83...) como flight IDs — causam erros. Usar sempre os IDs de `meta.flights` (216325, 216326...).

#### Script PowerShell (uskids_scrape.ps1)

O script PowerShell implementa ambos os métodos com fallback automático:

1. Tenta **GetMeta** primeiro (`meta.flights`)
2. Se não encontrar flights, faz fallback para **HTML iframe** (regex do select)
3. Para cada flight, chama `GetPlayerTeeTimes` com `t=0`, e se devolver 0 jogadores tenta `t=1`
4. Grava batches de 10 torneios em `Downloads\uskids_batches\`
5. Rate limiting: 500ms entre flights, 1000ms entre torneios

```
Configuração:
  $startFrom = 0    # índice de início
  $endAt = 179      # índice de fim (ajustar conforme necessário)
  $batchSize = 10   # torneios por batch
```

**Correr:**
```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\uskids_scrape.ps1"
```

**Input:** `tournaments_compact.json` na pasta Downloads. O script aceita dois formatos de campos: compacto (`n`, `t`, `c`) ou completo (`name`, `signupanytime_t`, `category`) — detecta automaticamente qual está presente.

**Output:** `Downloads\uskids_batches\scorecards_v2_batch_001.json`, `...002.json`, etc.

#### Gotchas do PowerShell (problemas encontrados)

1. **`ConvertFrom-Json` tem limite de ~2MB no PS5:** Ficheiros JSON grandes dão erro "Primitivo JSON inválido". Solução: usar o formato compacto (`n`, `t`, `c` em vez de `name`, `signupanytime_t`, `category`) para reduzir o tamanho do ficheiro de input.

2. **`ConvertTo-Json -Depth 20` é OBRIGATÓRIO:** O default do PowerShell é Depth 2, que trunca dados aninhados (os scorecards ficam cortados). Sem `-Depth 20`, os ficheiros de output ficam com dados incompletos (objectos substituídos por strings tipo `System.Collections.Hashtable`).

3. **`-Compress`** reduz o tamanho dos ficheiros de output (sem indentação).

4. **`-UseBasicParsing`** no `Invoke-WebRequest`: Evita dependência do Internet Explorer em versões mais antigas do PowerShell.

5. **`PSObject.Properties`** para iterar objectos dinâmicos: Em PowerShell, objectos JSON com chaves dinâmicas (como `meta.flights`) não funcionam com `foreach($key in $object.Keys)`. Tem de se usar `$object.PSObject.Properties.Name` para obter as chaves e `($object.PSObject.Properties | Measure-Object).Count` para contar.

6. **`.ToString()` no age_group:** `$meta.flights.$fId.age_group.ToString()` é necessário para indexar correctamente em `$meta.age_groups`.

7. **PowerShell não tem CORS:** Ao contrário dos scripts de consola do browser, o PowerShell pode chamar a API signupanytime.com directamente sem restrições de domínio. Isto é a grande vantagem sobre o método da consola.

8. **Numeração de batches ao retomar:** `$batchNum = [math]::Floor($startFrom / $batchSize)` garante que a numeração continua correcta se alterar `$startFrom` (ex: de 180 em diante, batches começam em 019).

9. **`Invoke-RestMethod` vs `Invoke-WebRequest`:** O script usa `Invoke-RestMethod` para chamadas API (auto-parseia JSON) e `Invoke-WebRequest` para o HTML do iframe (devolve texto raw). São cmdlets diferentes com comportamentos diferentes.

10. **`-Encoding UTF8` no `Set-Content`:** Obrigatório para evitar que caracteres especiais (acentos em nomes de jogadores) fiquem corrompidos nos ficheiros de output.

11. **Meta guardado SEM `flights`:** O `tournamentData.meta` guarda `tournament`, `courses` e `age_groups`, mas **não** guarda `flights` — porque os flight IDs já estão no array `tournamentData.flights`. Isto evita duplicação de dados e reduz o tamanho dos batches.

12. **Regex do HTML fallback:** O padrão exacto para extrair flight IDs do HTML do iframe é: `'<option\s+value="(\d+)"[^>]*>([^<]+)</option>'`. Testar com regex online se precisar de ajustar.

#### Estrutura dos Ficheiros Batch

Cada batch é um array de objetos torneio:

```json
[
  {
    "category": "World",
    "name": "World Championship 2025 (Jul 31)",
    "signupanytime_t": "18124",
    "method": "meta",
    "meta": { "tournament": {...}, "courses": {...}, "age_groups": {...} },
    "flights": [
      {
        "flight_id": "236703",
        "flight_name": "Boys 7 & Under",
        "age_group_id": "83",
        "player_count": 45,
        "data": {
          "flight_players": { ... },
          "flight_teams": {}
        }
      }
    ],
    "error": null
  }
]
```

#### Script de Consolidação de Batches

```javascript
(async function(){
  var input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.accept = '.json';
  input.onchange = async function(){
    var all = [];
    var seen = new Set();
    for(var f of this.files){
      var text = await f.text();
      var batch = JSON.parse(text);
      for(var t of batch){
        var key = t.signupanytime_t || t.name;
        if(!seen.has(key)){ seen.add(key); all.push(t); }
      }
    }
    var blob = new Blob([JSON.stringify(all)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'uskids_all_scorecards.json';
    a.click();
    document.title = 'Consolidado: ' + all.length + ' torneios';
  };
  input.click();
})();
```

#### Script de Consola v3 — Dual Method com Resume (alternativa ao PowerShell)

Correr em `signupanytime.com`. Suporta os dois métodos (GetMeta + HTML fallback) e permite retomar se parar.

**Passo 1 — Carregar torneios:**

```javascript
var btn = document.createElement('button');
btn.textContent = 'CARREGAR TORNEIOS';
btn.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;padding:20px;font-size:20px;background:lime;cursor:pointer;border:none;border-radius:8px';
document.body.appendChild(btn);
btn.onclick = function(){
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = function(e){
    var reader = new FileReader();
    reader.onload = function(ev){
      var data = JSON.parse(ev.target.result);
      window._TORNEIOS = data.map(function(x){
        return {category: x.c || x.category, name: x.n || x.name, t: x.t || x.signupanytime_t};
      }).filter(function(x){ return x.t; });
      window._RESUME_FROM = 0;
      btn.textContent = window._TORNEIOS.length + ' CARREGADOS';
      btn.style.background = 'gold';
    };
    reader.readAsText(e.target.files[0]);
  };
  input.click();
};
```

**Passo 2 — Scraping dual method:**

```javascript
(async function(){
  if(!window._TORNEIOS || !window._TORNEIOS.length){ alert('Carrega os torneios primeiro!'); return; }
  var torneios = window._TORNEIOS;
  var BASE = '/plugins/links/admin/LinksAJAX.aspx';
  var IFRAME_BASE = '/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=';
  var BATCH_SIZE = 10;
  var startFrom = window._RESUME_FROM || 0;
  if(startFrom > 0) console.log('A retomar a partir do #' + startFrom);
  var batch = [];
  var batchNum = Math.floor(startFrom / BATCH_SIZE);
  var totalWithData = 0;
  var totalFlights = 0;
  var errors = [];
  var methodStats = {metaOnly: 0, htmlOnly: 0, none: 0};

  function saveBatch(batchData, num){
    var blob = new Blob([JSON.stringify(batchData, null, 2)], {type:'application/json'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'scorecards_v2_batch_' + String(num).padStart(3,'0') + '.json';
    a.click();
  }

  async function getFlightsFromMeta(t){
    try {
      var resp = await fetch(BASE + '?op=GetMeta&t=' + t, {credentials:'include'});
      var meta = JSON.parse(await resp.text());
      if(!meta || !meta.flights || Object.keys(meta.flights).length === 0) return {flights: [], meta: null};
      var flights = [];
      var flightIds = Object.keys(meta.flights);
      for(var f=0; f<flightIds.length; f++){
        var fId = flightIds[f];
        var agId = meta.flights[fId].age_group;
        var agName = (meta.age_groups && meta.age_groups[agId]) ? meta.age_groups[agId].name : 'Unknown';
        flights.push({id: fId, name: agName, age_group_id: agId});
      }
      return {flights: flights, meta: {tournament: meta.tournament, courses: meta.courses, age_groups: meta.age_groups}};
    } catch(e){ return {flights: [], meta: null}; }
  }

  async function getFlightsFromHTML(t){
    try {
      var resp = await fetch(IFRAME_BASE + t, {credentials:'include'});
      var html = await resp.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var sel = doc.getElementById('view_flight_age_group');
      if(!sel) return [];
      var flights = [];
      for(var j=0; j<sel.options.length; j++){
        var opt = sel.options[j];
        if(opt.value && opt.value !== '') flights.push({id: opt.value, name: opt.text.trim(), age_group_id: null});
      }
      return flights;
    } catch(e){ return []; }
  }

  for(var i = startFrom; i < torneios.length; i++){
    var t = torneios[i];
    document.title = (i+1) + '/' + torneios.length + ' ' + t.name;
    var tournamentData = {category: t.category, name: t.name, signupanytime_t: t.t, flights: [], meta: null, error: null, method: null};
    try {
      var metaResult = await getFlightsFromMeta(t.t);
      var flightList = metaResult.flights;
      var usedMethod = 'meta';
      tournamentData.meta = metaResult.meta;
      if(flightList.length === 0){
        await new Promise(function(r){ setTimeout(r, 300); });
        flightList = await getFlightsFromHTML(t.t);
        usedMethod = flightList.length > 0 ? 'html' : 'none';
      }
      if(flightList.length === 0){
        tournamentData.error = 'no_flights_both_methods';
        tournamentData.method = 'none'; methodStats.none++;
      } else {
        tournamentData.method = usedMethod;
        if(usedMethod === 'meta') methodStats.metaOnly++; else methodStats.htmlOnly++;
        for(var f = 0; f < flightList.length; f++){
          var flight = flightList[f];
          try {
            var url = BASE + '?op=GetPlayerTeeTimes&f=' + flight.id + '&r=2&p=1&t=0';
            var fResp = await fetch(url, {credentials:'include'});
            var fData; try { fData = JSON.parse(await fResp.text()); } catch(e){ fData = null; }
            var playerCount = fData && fData.flight_players ? Object.keys(fData.flight_players).length : 0;
            if(playerCount === 0){
              url = BASE + '?op=GetPlayerTeeTimes&f=' + flight.id + '&r=2&p=1&t=1';
              fResp = await fetch(url, {credentials:'include'});
              try { fData = JSON.parse(await fResp.text()); } catch(e){ fData = null; }
              playerCount = fData && fData.flight_players ? Object.keys(fData.flight_players).length : 0;
            }
            tournamentData.flights.push({flight_id: flight.id, flight_name: flight.name, age_group_id: flight.age_group_id, player_count: playerCount, data: fData});
            totalFlights++;
          } catch(fe){
            tournamentData.flights.push({flight_id: flight.id, flight_name: flight.name, player_count: 0, data: null, error: fe.message});
          }
          await new Promise(function(r){ setTimeout(r, 500); });
        }
        if(tournamentData.flights.some(function(fl){ return fl.player_count > 0; })) totalWithData++;
      }
    } catch(e){
      tournamentData.error = e.message;
      errors.push({index: i, name: t.name, error: e.message});
    }
    batch.push(tournamentData);
    if(batch.length >= BATCH_SIZE){ batchNum++; saveBatch(batch, batchNum); batch = []; }
    window._RESUME_FROM = i + 1;
    await new Promise(function(r){ setTimeout(r, 1000); });
  }
  if(batch.length > 0){ batchNum++; saveBatch(batch, batchNum); }
  document.title = 'FEITO! ' + totalWithData + '/' + torneios.length;
  console.log('COMPLETO: ' + totalWithData + '/' + torneios.length + ' | GetMeta=' + methodStats.metaOnly + ' | HTML=' + methodStats.htmlOnly + ' | Nenhum=' + methodStats.none);
  if(errors.length > 0){
    var eb = new Blob([JSON.stringify(errors, null, 2)], {type:'application/json'});
    var ea = document.createElement('a'); ea.href = URL.createObjectURL(eb); ea.download = 'scorecards_v2_errors.json'; ea.click();
  }
})();
```

**Para retomar se parar a meio:**
1. Verificar `window._RESUME_FROM` (onde parou)
2. Re-carregar torneios (botão)
3. Fazer `window._RESUME_FROM = X;` (X = onde parou)
4. Colar o script de scraping outra vez

---

## International Local Tours — Estrutura Diferente

As International Local Tours têm uma estrutura de página diferente (por região, não dropdown central):

```
https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/{id}/{slug-região}/results
```

**125 regiões** em 40+ países. Script especial para:
1. Descobrir todas as regiões (links na página de international-local-tours)
2. Para cada região, iterar anos e extrair torneios
3. Mapear `t=` de cada torneio

Actualmente: **15 torneios** mapeados (só os actuais). Falta expandir para torneios históricos.

---

## Aplicação React (`USKidsApp.jsx`)

### Design Visual

- Sidebar escura de 64px com ícones
- Tipografia: Outfit (títulos) + DM Sans (corpo)
- Paleta de cores: verde-golfe como cor de acento
- Pills de categoria com gradientes baseados em género (azul para Boys, rosa para Girls, tons mais escuros com idade crescente)

### Quatro Vistas

**1. Dashboard:**
- Estatísticas gerais (total torneios, jogadores, países)
- Gráficos de distribuição
- Últimos torneios
- Clicar num jogador abre o seu perfil

**2. Rankings (4 modos):**
- **Por país:** Ranking por número de jogadores/participações
- **Veteranos:** Jogadores com mais participações ao longo dos anos
- **Scores:** Melhores scores absolutos
- **Por torneio:** Ranking dentro de cada torneio
- Clicar num jogador abre o seu perfil

**3. Torneios:**
- Lista de todos os torneios com filtro por nome
- Detalhe: leaderboard por categoria, scorecards hole-by-hole
- Navegação clicável (torneio → jogador → torneio)

**4. Jogadores:**
- Pesquisa por nome
- Perfil: histórico de participações com posição, score, categoria
- Medalhas: 🥇🥈🥉 para top 3, ou formato `x/y` para restantes
- Gráfico de evolução (strokes ao longo do tempo)
- Scorecards hole-by-hole de cada participação
- Células de scorecard: cores para birdie/bogey/double/triple com cantos rectos (`borderRadius: 0`)

### Agregação Inteligente de Jogadores (`canMerge`)

O mesmo jogador aparece em múltiplos torneios mudando de categoria. Regras de merge:

- **Mesmo nome + mesmo país** como candidatos
- **Validação de género:** M ≠ F nunca se juntam
- **Tolerância de ano de nascimento:** ±1 ano (apertado para evitar falsos positivos)
- **Verificação de progressão temporal:** `appRange.min > prevRange.max + yearDiff + 1` rejeita saltos de idade impossíveis
- **Não pode jogar duas categorias no mesmo torneio**

**Edge case importante:** A elegibilidade USKids é determinada pela idade do jogador no dia *anterior* ao torneio. Isto significa que o mesmo jogador pode aparecer em categorias diferentes dentro do mesmo ano (ex: Boys 10 em Maio e Boys 11 em Setembro, se faz anos no verão).

### Cálculos na App

- **Par estimado:** `hpr × 4 × rounds` (hpr = hits per round; par 3 para 9 buracos, par 4 para 18)
- **Country names:** Objecto `CC` com mapeamento completo de códigos ISO para nomes de países
- **Dropdown de países:** Alfabético, com todos os países presentes nos dados

### Carregamento de Dados

A app carrega `uskids_backup_30.json` (ou equivalente) via upload. Processamento 100% no browser — sem backend.

### Limitações Conhecidas dos Dados

- `uskids_backup_30.json` não tem `flight_categories` → todas as categorias aparecem como "Unknown"
- Sem par por buraco nos dados → coloração do scorecard usa par estimado
- Falta integrar os dados multi-categoria do novo scraping (batches)

---

## Notas Técnicas Importantes

### API e Dados

1. **CORS (browser) vs PowerShell:** No browser, scripts de fetch só funcionam no domínio correcto (`uskidsgolf.com` para listar torneios; `signupanytime.com` para API). **PowerShell não tem esta restrição** — faz requests directos a qualquer domínio, o que o torna a ferramenta preferida para scraping em massa.

2. **Flight IDs são globais:** Na plataforma signupanytime, `f=236703` refere-se a UMA categoria de UM torneio em toda a plataforma.

3. **`age_groups` IDs ≠ flight IDs — ARMADILHA CRÍTICA:** Nunca usar IDs de `age_groups` (82, 83...) como flight IDs. Causam erro `"Object reference not set"`. Usar **sempre** os IDs de `meta.flights` (216325, 216326...). Cada flight aponta para um age_group via `flights[id].age_group`.

4. **Dois métodos de flight IDs:** (A) HTML iframe select (torneios ~2013–2018: select preenchido); (B) GetMeta → `meta.flights` (torneios ~2019+: select vazio, carregado por `LinksViews.js` via `JSON_DATA`). O script v3 / PowerShell tenta GetMeta primeiro, faz fallback para HTML. **Nunca assumir que um método funciona para todos os torneios.**

5. **GetMeta response — campos úteis:** Além de `flights` e `age_groups`, o GetMeta devolve `tournament` (nome, rounds, start_date), `courses`, `teeMarkers`, `flight_courses`, `flight_rounds`. Os `age_groups` contêm `name`, `gender` e `min_age` — úteis para categorização.

6. **Parâmetro `t` no GetPlayerTeeTimes:** Alterna entre 0 e 1. Tentar `t=0` primeiro; se devolver 0 jogadores, tentar `t=1`.

7. **Parâmetro `r`:** Número de rondas. `r=2` é seguro para a maioria; `r=4` para garantir tudo.

8. **Parâmetro `p` — Paginação NÃO necessária:** Confirmámos que `p=1` devolve todos os jogadores de uma vez (testado com 1461 jogadores no World Championship 2025, 13 flights). Não há paginação.

9. **`ax=1129`:** ID constante da aplicação USKids na plataforma signupanytime.

10. **Categorias variam por torneio:** Van Horn Cup tem ~7–10 (equipas). European Championship tem 16–17. Torneios antigos têm formatos diferentes. Nem todos os torneios têm 14 categorias.

11. **Rate limiting:** Activa-se após ~170 requests consecutivos. Usar 1s entre torneios, 500ms entre flights. Os primeiros ~160 torneios correram sem problemas com o método HTML (batches 001-016), depois parou.

12. **Torneios pré-2013:** Não têm iframe signupanytime. Sistema mais antigo, dados não acessíveis via API.

13. **Dados hole-by-hole:** Array `strokes` com 18 posições, zeros = buracos não jogados. `start_hole` indica buraco de partida. `num_holes` diz quantos buracos foram jogados (9 ou 18). `status`: 1 = activo, outro = WD/DNS.

### PowerShell — Gotchas Específicos

14. **`ConvertFrom-Json` limite de tamanho:** Ficheiros JSON grandes (>10MB) podem dar erro "Primitivo JSON inválido". Solução: partir em ficheiros menores ou usar `-AsHashtable` no PowerShell 7+.

15. **`ConvertTo-Json -Depth 20`:** Obrigatório! Sem `-Depth 20`, objectos aninhados são truncados para `"System.Collections.Hashtable"`. O `-Compress` reduz o tamanho dos ficheiros significativamente.

16. **`-UseBasicParsing`:** Obrigatório no `Invoke-WebRequest` para parsear HTML sem depender do Internet Explorer.

17. **Execution Policy:** Correr scripts `.ps1` requer: `powershell -ExecutionPolicy Bypass -File "caminho\uskids_scrape.ps1"`

18. **`tournaments_compact.json` formato dual:** Usa chaves curtas `{c, n, t}` para reduzir tamanho, mas o script aceita ambos os formatos: `$t.t || $t.signupanytime_t`, `$t.n || $t.name`, `$t.c || $t.category`.

19. **PSObject.Properties para iterar objectos:** No PowerShell, objectos JSON são `PSCustomObject`. Para contar propriedades: `($obj.PSObject.Properties | Measure-Object).Count`. Para iterar chaves: `$obj.PSObject.Properties.Name`.

### Browser Console — Gotchas Específicos

20. **`var` em vez de `let`:** Na consola do browser, `let` dá erro de re-declaração se o script for corrido várias vezes. Usar sempre `var`.

21. **Variáveis na consola perdem-se:** Se mudar de tab ou fechar a consola, os dados desaparecem. Scripts devem ser auto-contidos e fazer download automático.

22. **`window._RESUME_FROM` para retomar:** O script v3 de consola guarda o progresso em `window._RESUME_FROM`. Se parar, basta re-carregar torneios e definir `window._RESUME_FROM = X` antes de re-colar o script.

23. **Artifacts do Claude:** Não suportam downloads de ficheiros (limitação do sandbox). Exports devem ser feitos via scripts de consola do browser ou PowerShell.

---

## Ficheiros de Dados

### Ficheiros de Mapeamento (Fase 1+2)

| Ficheiro | Descrição | Estado |
|----------|-----------|--------|
| `all_tournaments_consolidated.json` | 1145 torneios, todas as categorias, campo `category` | ✅ Actual |
| `tournaments_ready_for_scraping.json` | 613 torneios com `signupanytime_t`, prontos para Fase 3 | ✅ Actual |
| `tournaments_compact.json` | Versão compacta para input do PowerShell (`n`, `t`, `c`) | ✅ Actual |

### Ficheiros de Scorecards (Fase 3)

| Ficheiro | Descrição | Estado |
|----------|-----------|--------|
| `scorecards_v2_batch_001.json` a `~060.json` | ~60 batches de 10 torneios cada (~200MB total) | ✅ Gerados |
| `uskids_complete_v2.json` | Dataset Internacional: 178 torneios, 28.001 jogadores (~22MB) | ✅ Actual |
| `uskids_all_scorecards.json` | Dataset consolidado multi-categoria | ⏳ Por gerar |

### Ficheiros por Categoria (Fase 1)

| Ficheiro | Torneios |
|----------|------:|
| `world_tournaments_mapped.json` | 44 (33 com t=) |
| `regional_tournaments_mapped.json` | 161 (133 com t=) |
| `teen-world_tournaments_mapped.json` | 23 (19 com t=) |
| `state_tournaments_mapped.json` | 702 (213 com t=) |
| `girls-invitationals_tournaments_mapped.json` | 11 (11 com t=) |
| `teen-series_tournaments_mapped.json` | 189 (189 com t=) |
| `international_local_tours_mapped.json` | 15 (15 com t=) |

### Ficheiros da Aplicação

| Ficheiro | Descrição |
|----------|-----------|
| `USKidsApp.jsx` | Aplicação React (~846 linhas) |
| `uskids_backup_30.json` | Dados carregados na app (sem flight_categories) |

### Documentação

| Ficheiro | Descrição |
|----------|-----------|
| `USKids_Scraping_Guia_Completo.md` | Guia técnico completo de scraping |
| `RESUMO_PROJETO_USKIDS_v4.md` | Este ficheiro |
| `uskids_scrape.ps1` | Script PowerShell para Fase 3 |

---

## Problemas Conhecidos no Dataset

| Problema | Torneio | Detalhe |
|----------|---------|---------|
| Sem dados | European Van Horn Cup 2020 (Jun 4) | `no_jsondata` — cancelado (COVID) |
| 0 jogadores | 2012 Mediterranean Open Venice (Sep 6) | Torneio antigo, dados indisponíveis |
| Poucos dados | Van Horn Cup 2015 (May 29) | Apenas 2 jogadores — formato especial |
| Duplicado | Venice Open 2018 | 2x (tournament_id diferente, mesmos dados: 259 jogadores) |
| Duplicado | Mexico City Championship 2019 | 2x (2018 + 2019 com mesmos dados) |
| Categorias Unknown | Todos (backup actual) | `flight_categories` ausente no JSON → fallback "Unknown" |
| Sem par por buraco | Todos | API não fornece par — app usa estimativa |

---

## Validação de Dados

### World Championship 2025 (t=18124)

Validação completa: **1461 jogadores** em **13 flights**. GetMeta API funciona correctamente, sem necessidade de paginação.

### Contagem por Método de Extração

- **Método "meta" (GetMeta API):** Maioria dos torneios recentes (2019+)
- **Método "html" (iframe select):** Torneios mais antigos (2013–2018)
- **Método "none":** Torneios sem flights (pré-2013 ou cancelados)

---

## Scripts de Diagnóstico Úteis

### Verificar contagem de jogadores num torneio (consola em signupanytime.com)

```javascript
var BASE = '/plugins/links/admin/LinksAJAX.aspx';
var testT = '18124'; // <- substituir pelo t= do torneio
fetch(BASE + '?op=GetMeta&t=' + testT).then(function(r){ return r.json(); }).then(function(meta){
  var fIds = Object.keys(meta.flights);
  var msg = 'Torneio: ' + meta.tournament.name + '\nFlights: ' + fIds.length + '\n\n';
  var total = 0; var done = 0;
  for(var i=0; i<fIds.length; i++){
    (function(idx){
      var fId = fIds[idx];
      var ag = meta.flights[fId].age_group;
      var name = meta.age_groups[ag] ? meta.age_groups[ag].name : '?';
      fetch(BASE + '?op=GetPlayerTeeTimes&f=' + fId + '&r=4&p=1&t=0').then(function(r){ return r.text(); }).then(function(txt){
        try {
          var d = JSON.parse(txt);
          var n = d.flight_players ? Object.keys(d.flight_players).length : 0;
          total += n;
          msg += name + ' (f=' + fId + '): ' + n + ' jogadores\n';
        } catch(e){ msg += name + ': ERRO\n'; }
        done++;
        if(done === fIds.length){
          msg += '\nTOTAL: ' + total + ' jogadores';
          console.log(msg); alert(msg);
        }
      });
    })(i);
  }
})
```

### Verificar se paginação é necessária (spoiler: não é)

```javascript
var BASE = '/plugins/links/admin/LinksAJAX.aspx';
var testT = '18124';
fetch(BASE + '?op=GetMeta&t=' + testT).then(function(r){ return r.json(); }).then(function(meta){
  var fId = Object.keys(meta.flights)[0];
  var agName = meta.age_groups[meta.flights[fId].age_group].name;
  var promises = [];
  for(var p=1; p<=5; p++){
    promises.push(fetch(BASE + '?op=GetPlayerTeeTimes&f=' + fId + '&r=4&p=' + p + '&t=0').then(function(r){ return r.text(); }));
  }
  Promise.all(promises).then(function(results){
    var msg = 'Flight: ' + fId + ' (' + agName + ')\n\n';
    for(var i=0; i<results.length; i++){
      try {
        var d = JSON.parse(results[i]);
        var n = d.flight_players ? Object.keys(d.flight_players).length : 0;
        msg += 'Pagina ' + (i+1) + ': ' + n + ' jogadores\n';
      } catch(e){ msg += 'Pagina ' + (i+1) + ': ERRO\n'; }
    }
    alert(msg);
  });
})
```

---

## Histórico de Tentativas e Erros

### ❌ Método 1: Brute force de flight IDs
Tentar IDs numéricos à volta de um seed. **Falhou:** Capturou flights de outros torneios (IDs são globais).

### ❌ Método 2: Extrair flight IDs do HTML estático via fetch
Fazer fetch do iframe URL e parsear o HTML. **Falhou parcialmente:** O select está vazio nos torneios recentes (preenchido por JavaScript). **MAS funciona para torneios antigos (~2013–2018)** — os primeiros ~160 torneios foram extraídos com sucesso via este método (batches 001-016, 3–6MB cada). A partir do torneio ~170, parou por rate limiting.

### ❌ Método 3: Usar age_groups IDs do GetMeta como flight IDs
Os IDs de age_groups (1, 2, 3... ou 82, 83...) NÃO são flight IDs. **Falhou:** Dá erro `"Object reference not set to an instance of an object"` na API. Os IDs correctos estão em `meta.flights`, não em `meta.age_groups`.

### ✅ Método 4: Iframe + JSON_DATA (Internacional — 178 torneios)
Carregar cada torneio num iframe escondido, esperar que JavaScript execute, ler `JSON_DATA.flights`. **Funcionou** mas é lento (~4s por torneio).

### ✅ Método 5: GetMeta API → meta.flights (Multi-categoria — 613 torneios)
Chamar GetMeta directamente e usar `meta.flights` para obter flight IDs reais. Com fallback para HTML select para torneios antigos. **Método actual**, implementado no PowerShell script.

---

## O Que Falta Fazer

### ✅ Concluído
1. ~~Descobrir método de extração de flight IDs~~ — Método dual (GetMeta + HTML)
2. ~~Scraping Internacional (178 torneios, 28.001 jogadores)~~ — Dataset v2 completo
3. ~~Mapeamento multi-categoria (1145 torneios, 8 categorias)~~ — Ficheiros consolidados
4. ~~Script PowerShell para Fase 3~~ — uskids_scrape.ps1
5. ~~Aplicação React com design visual~~ — USKidsApp.jsx funcional
6. ~~Agregação inteligente de jogadores~~ — canMerge com tolerância ±1

### ⏳ Pendente
1. **Consolidar ~60 batches** num dataset único sem duplicados
2. **Re-scraping para `flight_categories`** — correr script de discovery (XHR interception de GetMeta) para recuperar nomes de categorias
3. **Expandir International Local Tours** — iterar 125 regiões × múltiplos anos (actualmente só torneios actuais)
4. **Integrar dados multi-categoria na app** — carregar dataset consolidado e activar vistas por categoria
5. **Limpar duplicados** — Venice Open 2018 e Mexico City Championship 2019
6. **Par por buraco** — investigar se existe nos dados do GetMeta ou noutro endpoint

### 💡 Ideias Futuras
- Filtro por país/categoria na app
- Export de dados para Excel
- Gráficos de comparação entre jogadores
- Integração com dados da Federação Portuguesa de Golfe (FPG)
- Dashboard de cobertura: mapa-mundo com nº de jogadores por país
