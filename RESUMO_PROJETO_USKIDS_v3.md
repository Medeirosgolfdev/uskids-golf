# Projeto USKids Golf — Resumo Completo (v3 — Março 2026)

## Objetivo

Extrair todos os resultados históricos de torneios internacionais USKids Golf (2005–2026) a partir do site oficial, processar os dados e construir uma aplicação React para análise de jogadores e torneios. O foco principal é acompanhar a evolução de jogadores juniores ao longo dos anos, com especial atenção ao Manuel (11 anos).

---

## ✅ ESTADO ATUAL: SCRAPING CONCLUÍDO COM SUCESSO

**Ficheiro final:** `uskids_complete_v2.json` (~22MB)
**Resultado:** 178 torneios | 2488 categorias | 28.001 jogadores (com scorecards hole-by-hole)
**Taxa de sucesso:** 177/178 torneios com dados (99.4%)

### Problemas menores no dataset:

| Problema | Torneio | Detalhe |
|----------|---------|---------|
| Sem dados | European Van Horn Cup 2020 (Jun 4) | Erro `no_jsondata` — provavelmente cancelado (COVID) |
| 0 jogadores | 2012 Mediterranean Open Venice (Sep 6) | Torneio antigo, dados possivelmente não disponíveis |
| Poucos dados | Van Horn Cup 2015 (May 29) | Apenas 2 jogadores — formato especial |
| Duplicado | Venice Open 2018 | Aparece 2x (tournament_id diferente, mesmos dados: 259 jogadores) |
| Duplicado | Mexico City Championship 2019 | Aparece 2x (2018 Mexico City Championship + Mexico City Championship) |

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
| `LinksAJAX.aspx?op=GetMeta&t={t_param}` | GET | Metadados do torneio: nome, categorias (age_groups), nº rondas, campos |
| `LinksAJAX.aspx?op=GetPlayerTeeTimes&f={flight_id}&r={rounds}&p=1&t={0ou1}` | GET | Dados completos de uma categoria: jogadores, scores hole-by-hole, país, localidade |

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
- O campo `flight_name` NÃO existe no GetPlayerTeeTimes — o nome da categoria vem do JSON_DATA.age_groups

### Estrutura do ficheiro `uskids_complete_v2.json`

O ficheiro é um array de objetos, um por torneio:

```json
[
  {
    "name": "European Championship 2025 (May 27)",
    "year": 2025,
    "tournament_id": "514056",
    "iframe_url": "https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=2739&t=18242",
    "flights": [
      {
        "flight_id": "236703",
        "flight_name": "Boys 7 & Under",
        "data": {
          "flight_players": { ... },
          "flight_teams": {}
        }
      },
      ...
    ]
  },
  ...
]
```

Cada torneio tem:
- `name`, `year`, `tournament_id`, `iframe_url` — identificação
- `flights` — array de categorias, cada uma com `flight_id`, `flight_name` e `data` (resposta completa do GetPlayerTeeTimes)
- `error` (opcional) — se houve problema ao extrair

---

## Pipeline de Dados — Método que Funcionou

### Passo 1 — Lista de Torneios (consola em tournaments.uskidsgolf.com)

**Como funciona:**
1. Iterar anos 2005–2026
2. Para cada ano, fazer fetch de `https://tournaments.uskidsgolf.com/tournaments/international/past-results?date[value][year]=YYYY`
3. No HTML devolvido, parsear o `<select id="edit-jump">` — cada `<option>` contém um torneio
4. Formato das options: `value="HASH::/tournaments/international/past-results?tournament_id=XXXXXX"` e `text="Nome do Torneio (data)"`

**Para obter os iframe URLs:**
- Fazer fetch da página de cada torneio individual
- Procurar `signupanytime.com` no HTML da página
- Extrair o URL completo do iframe

**Script (bloco único, colar na consola):**
```javascript
var years = []; for(var y=2005; y<=2026; y++) years.push(y);
var allTournaments = []; var done = 0;
years.forEach(function(year){
  fetch('/tournaments/international/past-results?date%5Bvalue%5D%5Byear%5D=' + year)
  .then(function(r){ return r.text(); })
  .then(function(html){
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var sel = doc.getElementById('edit-jump');
    if(sel){
      for(var i=0; i<sel.options.length; i++){
        var val = sel.options[i].value;
        var name = sel.options[i].text.trim();
        if(val && name !== '-Select an Event'){
          var tidMatch = val.match(/tournament_id=(\d+)/);
          allTournaments.push({name: name, year: year, tournament_id: tidMatch ? tidMatch[1] : ''});
        }
      }
    }
    done++;
    document.title = done + '/' + years.length + ' anos';
    if(done === years.length){
      document.title = 'LISTA PRONTA! ' + allTournaments.length + ' torneios. Cola o proximo script.';
    }
  });
});
```

**Depois, na mesma consola (sem mudar de tab), colar o script dos iframe URLs:**
```javascript
var done2 = 0; var total = allTournaments.length;
allTournaments.forEach(function(t, idx){
  setTimeout(function(){
    fetch('/tournaments/international/past-results?date%5Bvalue%5D%5Byear%5D=' + t.year + '&tournament_id=' + t.tournament_id)
    .then(function(r){ return r.text(); })
    .then(function(html){
      var m = html.match(/signupanytime\.com[^"'\s]*/);
      t.iframe_url = m ? 'https://www.' + m[0] : '';
      done2++;
      document.title = done2 + '/' + total + ' iframes';
      if(done2 === total){
        document.title = 'IFRAMES PRONTO! ' + allTournaments.filter(function(x){return x.iframe_url}).length + ' com URL';
      }
    });
  }, idx * 500);
});
```

**Guardar a lista:**
```javascript
var blob = new Blob([JSON.stringify(allTournaments)], {type:'application/json'});
var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
a.download = 'torneios.json'; a.click();
```

**Output:** `torneios.json` — array com 178 objetos `{name, year, tournament_id, iframe_url}`

---

### Passo 2 — Scraping dos Resultados (consola em signupanytime.com)

#### ✅ Descoberta Crítica: Como obter os Flight IDs

**O HTML estático do iframe NÃO contém os flight IDs.** O `<select id="view_flight_age_group">` está vazio no HTML — é preenchido por JavaScript que corre no browser.

**Os flight IDs vivem no objeto JavaScript `JSON_DATA.flights`** que é injetado pelo servidor ASP.NET quando a página carrega no browser (não via AJAX, não no HTML estático).

**JSON_DATA contém:**
```
tournament, age_groups, courses, teeMarkers, flights, flight_courses,
flight_rounds, flight_players, tee_times, scores, flight_teams,
tee_times_team, IDX_FLIGHT_ROUNDS, courses_sorted
```

**A relação é:**
- `JSON_DATA.flights` → objeto com `{flight_id: {age_group: X, name: ""}}`
- `JSON_DATA.age_groups` → objeto com `{age_group_id: {name: "Boys 10", gender: "Boys", min_age: 10, ...}}`
- Para obter o nome da categoria: `JSON_DATA.age_groups[JSON_DATA.flights[flight_id].age_group].name`

**Método que funciona: carregar cada torneio num IFRAME escondido dentro da página signupanytime.com**

Ao criar um `<iframe>` que aponta para o URL do torneio:
1. O browser carrega a página completa (incluindo o JavaScript)
2. O `JSON_DATA` é populado pelo servidor
3. Conseguimos aceder a `iframe.contentWindow.JSON_DATA`
4. De lá extraímos os flight IDs e os nomes das categorias

**Nota:** É preciso esperar ~4 segundos após o load do iframe para o JSON_DATA estar disponível.

#### Script completo de scraping

**Pré-requisito:** Abrir qualquer página em signupanytime.com (ex: um dos iframe URLs). Ter a lista de torneios carregada na variável `torneios`.

**Para carregar os torneios:** Abrir o ficheiro `torneios.json`, copiar o conteúdo, e na consola:
```javascript
var torneios = COLAR_CONTEUDO_DO_JSON_AQUI;
document.title = 'Lista de torneios carregada? ' + torneios.length;
```

**Script de scraping (colar na consola):**
```javascript
var allData = []; var tIdx = 0;
var BASE = '/plugins/links/admin/LinksAJAX.aspx';
var iframe = document.createElement('iframe');
iframe.style.display = 'none'; document.body.appendChild(iframe);

function nextTorneio() {
  if (tIdx >= torneios.length) {
    document.title = 'CONCLUIDO! ' + allData.length + ' torneios';
    return;
  }
  var t = torneios[tIdx];
  document.title = (tIdx+1) + '/' + torneios.length + ' ' + t.name;
  if (!t.iframe_url) {
    allData.push({name:t.name,year:t.year,tournament_id:t.tournament_id,flights:[],error:'no_url'});
    tIdx++; setTimeout(nextTorneio, 100); return;
  }
  iframe.onload = function() {
    setTimeout(function() {
      try {
        var jd = iframe.contentWindow.JSON_DATA;
        if (!jd || !jd.flights) {
          allData.push({name:t.name,year:t.year,tournament_id:t.tournament_id,iframe_url:t.iframe_url,flights:[],error:'no_jsondata'});
          tIdx++; setTimeout(nextTorneio, 500); return;
        }
        var flightIds = []; var agMap = {};
        for (var fid in jd.flights) {
          var agId = jd.flights[fid].age_group;
          var agName = jd.age_groups[agId] ? jd.age_groups[agId].name : 'Unknown';
          flightIds.push(fid);
          agMap[fid] = agName;
        }
        var torneioData = {name:t.name,year:t.year,tournament_id:t.tournament_id,iframe_url:t.iframe_url,flights:[]};
        var fIdx = 0;
        function nextFlight() {
          if (fIdx >= flightIds.length) {
            allData.push(torneioData);
            tIdx++; setTimeout(nextTorneio, 500); return;
          }
          var fid = flightIds[fIdx];
          document.title = (tIdx+1) + '/' + torneios.length + ' ' + t.name + ' [' + (fIdx+1) + '/' + flightIds.length + ']';
          fetch(BASE + '?op=GetPlayerTeeTimes&f=' + fid + '&r=4&p=1&t=0')
          .then(function(r){ return r.text(); })
          .then(function(txt){
            try {
              var d = JSON.parse(txt);
              var np = Object.keys(d.flight_players || {}).length;
              if (np === 0) {
                return fetch(BASE + '?op=GetPlayerTeeTimes&f=' + fid + '&r=4&p=1&t=1').then(function(r2){ return r2.text(); });
              }
              return txt;
            } catch(e) { return txt; }
          })
          .then(function(txt2) {
            try {
              var d2 = typeof txt2 === 'string' ? JSON.parse(txt2) : txt2;
              torneioData.flights.push({flight_id:fid,flight_name:agMap[fid],data:d2});
            } catch(e) {
              torneioData.flights.push({flight_id:fid,flight_name:agMap[fid],data:null,error:e.message});
            }
            fIdx++; setTimeout(nextFlight, 400);
          })
          .catch(function(e) {
            torneioData.flights.push({flight_id:fid,flight_name:agMap[fid],data:null,error:e.message});
            fIdx++; setTimeout(nextFlight, 400);
          });
        }
        nextFlight();
      } catch(e) {
        allData.push({name:t.name,year:t.year,tournament_id:t.tournament_id,iframe_url:t.iframe_url,flights:[],error:e.message});
        tIdx++; setTimeout(nextTorneio, 500);
      }
    }, 4000);
  };
  iframe.src = t.iframe_url;
}

nextTorneio();
```

**Monitorização:** O título da tab mostra o progresso: `"45/178 Venice Open [3/14]"`
**Duração:** ~20-30 minutos
**NÃO fechar a tab** durante o processo!

#### Verificar resultados:
```javascript
var ok = 0; var err = 0;
for(var i=0; i<allData.length; i++){
  if(allData[i].flights.length > 0) ok++; else err++;
}
'OK: ' + ok + ' | Erros: ' + err + ' | Total: ' + allData.length
```

#### Guardar o ficheiro (download automático):
```javascript
var blob = new Blob([JSON.stringify(allData)], {type:'application/json'});
var a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'uskids_complete_v2.json';
a.click();
```

#### Gerar relatório resumido:
```javascript
var r = []; var totalPlayers = 0; var totalCats = 0;
for(var i=0; i<allData.length; i++){
  var t = allData[i]; var np = 0;
  for(var j=0; j<t.flights.length; j++){
    var d = t.flights[j].data;
    if(d && d.flight_players) np += Object.keys(d.flight_players).length;
  }
  totalPlayers += np; totalCats += t.flights.length;
  r.push(t.year + ' | ' + t.flights.length + ' cats | ' + np + ' jogadores | ' + t.name + (t.error ? ' ERR: ' + t.error : ''));
}
r.sort();
r.unshift('TOTAL: ' + allData.length + ' torneios | ' + totalCats + ' categorias | ' + totalPlayers + ' jogadores');
var blob = new Blob([r.join('\n')], {type:'text/plain'});
var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
a.download = 'resumo_torneios.txt'; a.click();
```

---

## Como Atualizar Dados no Futuro

Se forem adicionados novos torneios ao site USKids, basta:

1. **Repetir o Passo 1** em `tournaments.uskidsgolf.com` para obter a lista atualizada
2. **Filtrar apenas os torneios novos** (comparar tournament_id com os existentes no JSON)
3. **Correr o Passo 2** só para os novos torneios
4. **Juntar** os dados novos ao `uskids_complete_v2.json` existente

Alternativamente, pode correr-se o pipeline completo de novo (demora ~30 min) para regenerar tudo.

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

A app recebe o ficheiro `uskids_complete_v2.json` via upload. O JSON é processado no browser — não há backend.

---

## Notas Técnicas Importantes

1. **CORS:** O browser bloqueia fetch de signupanytime.com quando a página está no domínio uskidsgolf.com. O scraping tem de correr a partir de uma tab aberta em signupanytime.com.

2. **Variável `var` vs `let`:** Na consola do browser, `let` dá erro de re-declaração se corrido múltiplas vezes. Usar sempre `var` nos scripts de consola.

3. **Flight IDs são globais:** Na plataforma signupanytime.com, o ID `f=236703` identifica uma categoria de UM torneio específico em toda a plataforma.

4. **Parâmetro `t` no GetPlayerTeeTimes:** Alterna entre 0 e 1. O script tenta `t=0` primeiro e se devolver 0 jogadores tenta `t=1`.

5. **Parâmetro `r` no GetPlayerTeeTimes:** Número de rondas. Usamos `r=4` para garantir que apanhamos todas as rondas.

6. **Categorias variam por torneio:** Não são sempre 14. Van Horn Cup tem ~7-10 (equipas). European Championship tem 16-17. Torneios antigos têm formatos diferentes.

7. **JSON_DATA não está no HTML estático:** É injetado pelo servidor ASP.NET quando o JavaScript da página corre. Por isso o fetch do HTML não funciona — tem de se usar um iframe real para o browser executar o JavaScript.

8. **Variáveis na consola perdem-se:** Se mudares de tab ou a consola for limpa, as variáveis desaparecem. O script de scraping (Passo 2) é auto-contido e não depende de variáveis externas exceto `torneios`.

9. **Rate limiting:** O script usa timeouts (400-500ms entre requests) para não sobrecarregar o servidor. O iframe precisa de ~4 segundos para carregar.

10. **Dados completos incluem hole-by-hole:** Cada jogador tem strokes para cada buraco, não apenas totais.

---

## Ficheiros de Dados

| Ficheiro | Descrição | Estado |
|----------|-----------|--------|
| `torneios.json` | Lista de 178 torneios com iframe URLs | ✅ Atual |
| `uskids_complete_v2.json` | Dataset completo: 178 torneios, 28.001 jogadores, hole-by-hole | ✅ Atual (~22MB) |
| `resumo_torneios.txt` | Resumo: categorias e jogadores por torneio | ✅ Atual |
| `uskids_complete.json` | Dataset antigo com dados corrompidos (brute force) | ❌ Obsoleto |
| `backup_30.json` | Backup parcial dos primeiros 30 torneios | ❌ Obsoleto |

---

## O Que Falta Fazer

### 1. ✅ ~~Descobrir método de extração de flight IDs~~ — FEITO
### 2. ✅ ~~Scraping completo dos 178 torneios~~ — FEITO (28.001 jogadores)
### 3. Limpar duplicados no dataset
- Remover Venice Open 2018 duplicado
- Remover Mexico City Championship 2019 duplicado
### 4. Construir/atualizar a App React
- Atualizar para usar a nova estrutura do `uskids_complete_v2.json`
- Filtro por país/categoria
- Export de dados para Excel
- Gráficos de comparação entre jogadores
- Integração com dados da Federação Portuguesa de Golfe (FPG)

---

## Histórico de Tentativas e Erros (para referência)

### ❌ Método 1: Brute force de flight IDs
- Tentar IDs numéricos à volta de um seed
- **Falhou:** Capturou flights de outros torneios (IDs são globais)

### ❌ Método 2: Extrair flight IDs do HTML estático via fetch
- Fazer fetch do iframe URL e parsear o HTML
- **Falhou:** O `<select id="view_flight_age_group">` está vazio no HTML — é preenchido por JavaScript

### ❌ Método 3: Extrair do GetMeta
- As chaves do `age_groups` no GetMeta (1, 2, 3...) NÃO são os flight IDs
- **Falhou:** GetMeta dá categorias mas não flight IDs

### ✅ Método 4: Iframe + JSON_DATA (o que funcionou)
- Carregar cada torneio num `<iframe>` escondido
- Esperar que o JavaScript execute e popule `JSON_DATA`
- Ler `iframe.contentWindow.JSON_DATA.flights` para obter os flight IDs reais
- Depois chamar `GetPlayerTeeTimes` com cada flight ID
