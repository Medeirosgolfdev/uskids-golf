# USKids Golf — Guia Completo de Extração de Dados

## Objetivo

Extrair todos os resultados históricos de torneios USKids Golf (2002–2026) a partir do site oficial, mapeando cada torneio ao seu identificador na plataforma **signupanytime.com**, que aloja os scorecards reais.

---

## Arquitectura: Como os Dados Estão Organizados

O site `tournaments.uskidsgolf.com` mostra resultados dentro de iframes que apontam para `signupanytime.com`. A cadeia é:

```
uskidsgolf.com (dropdown de anos/torneios)
  → iframe → signupanytime.com (resultados reais)
    → API: GetPlayerTeeTimes (scorecards hole-by-hole)
```

### Dois Identificadores-Chave

| ID | Onde vive | Para que serve |
|----|-----------|---------------|
| `tournament_id` | URL do uskidsgolf.com | Identificar o torneio no site USKids |
| `t` (signupanytime) | URL do iframe / API | Aceder aos resultados na API signupanytime |

---

## Categorias de Torneios e URLs

Cada categoria tem a sua página de past-results com dropdowns de ano e torneio:

| Categoria | Slug no URL | Torneios | Com t= | Estado |
|-----------|------------|------:|------:|--------|
| World | `world` | 44 | 33 | ✅ |
| Regional | `regional` | 161 | 133 | ✅ |
| Teen World | `teen-world` | 23 | 19 | ✅ |
| State | `state` | 702 | 213 | ✅ |
| Girls Invitationals | `girls-invitationals` | 11 | 11 | ✅ |
| Teen Series | `teen-series` | 189 | 189 | ✅ |
| Local Tours (US) | `local-tours` | 0 | 0 | ❌ Vazio |
| Parent/Child | `parent-child` | 0 | 0 | ❌ Vazio |
| International Local Tours | Estrutura diferente | 15 | 15 | ⚠️ Parcial |

**URL base para categorias com dropdown:**
```
https://tournaments.uskidsgolf.com/tournaments/{slug}/past-results?date[value][year]={ano}
```

**URL base para International Local Tours (por região):**
```
https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/{id}/{slug-região}/results
```

---

## Elementos HTML da Página

Na página de past-results, existem 3 selectores relevantes:

| Selector | ID | Função |
|----------|----|--------|
| SELECT #0 | `edit-select-dest` | Products/Non-Products (ignorar) |
| SELECT #1 | `edit-date-value-year` | Dropdown de anos (2002–2026) |
| SELECT #2 | `edit-jump` | Dropdown de torneios do ano selecionado |

O SELECT #2 tem opções no formato:
```
value="HASH::/tournaments/{slug}/past-results?date[value][year]=2025&tournament_id=514125"
text="World Championship 2025 (Jul 31)"
```

---

## Método de Extração — 3 Fases

### FASE 1: Listar Torneios (por categoria)

Iterar anos via `fetch()` e extrair `tournament_id` do dropdown `edit-jump`.

**IMPORTANTE:** Usar `fetch()` em vez de mudar o dropdown, porque a página faz reload completo (mata o script).

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
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var jumpSel = doc.getElementById('edit-jump');
      if(jumpSel){
        for(var j=0; j<jumpSel.options.length; j++){
          var o = jumpSel.options[j];
          if(o.value && o.value !== ''){
            var match = o.value.match(/tournament_id=(\d+)/);
            if(match){
              all.push({year: year, tournament_id: match[1], name: o.text.trim()});
            }
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

**Substituir `{SLUG}`** pelo slug da categoria (ex: `world`, `regional`, `state`).

---

### FASE 2: Mapear tournament_id → signupanytime t=

Para cada torneio, fazer fetch da página individual e extrair o parâmetro `t=` do iframe signupanytime:

```javascript
(async function(){
  var data = window._TOURNAMENTS; // da Fase 1
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
      results.push({
        year: t.year,
        tournament_id: t.tournament_id,
        name: t.name,
        signupanytime_t: signupMatch ? signupMatch[1] : null
      });
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

**Nota:** Torneios anteriores a ~2013 não têm iframe signupanytime (sistema mais antigo). O `signupanytime_t` será `null` para esses.

---

### FASE 1+2 Combinada (script tudo-em-um por categoria)

Para correr múltiplas categorias de seguida, usar este script que faz Fase 1 + Fase 2 automaticamente:

```javascript
(async function(){
  var cats = [
    {slug:'teen-series', label:'Teen Series'},
    {slug:'local-tours', label:'Local Tours'}
    // Adicionar mais categorias conforme necessário
  ];
  var base = 'https://tournaments.uskidsgolf.com/tournaments/';
  var ALL = {};

  for(var c=0; c<cats.length; c++){
    var cat = cats[c];
    var torneios = [];
    // FASE 1: Listar
    for(var y=2002; y<=2026; y++){
      document.title = cat.label + ' lista ' + y;
      try {
        var r = await fetch(base+cat.slug+'/past-results?date%5Bvalue%5D%5Byear%5D='+y, {credentials:'include'});
        var h = await r.text();
        var d = new DOMParser().parseFromString(h,'text/html');
        var s = d.getElementById('edit-jump');
        if(s) for(var j=0;j<s.options.length;j++){
          var o=s.options[j]; if(!o.value) continue;
          var m=o.value.match(/tournament_id=(\d+)/);
          if(m) torneios.push({year:y,tid:m[1],name:o.text.trim()});
        }
      }catch(e){}
    }
    console.log(cat.label+': '+torneios.length+' torneios');
    // FASE 2: Mapear t=
    var mapped=[];
    for(var i=0;i<torneios.length;i++){
      var t=torneios[i];
      document.title=cat.label+' t= '+(i+1)+'/'+torneios.length;
      try{
        var r=await fetch(base+cat.slug+'/past-results?date%5Bvalue%5D%5Byear%5D='+t.year+'&tournament_id='+t.tid,{credentials:'include'});
        var h=await r.text();
        var m=h.match(/signupanytime\.com[^"']*[?&]t=(\d+)/);
        mapped.push({year:t.year,tournament_id:t.tid,name:t.name,signupanytime_t:m?m[1]:null});
      }catch(e){mapped.push({year:t.year,tournament_id:t.tid,name:t.name,signupanytime_t:null});}
      await new Promise(r=>setTimeout(r,200));
    }
    ALL[cat.slug]=mapped;
    console.log(cat.label+' DONE: '+mapped.filter(x=>x.signupanytime_t).length+'/'+mapped.length);
  }

  // Descarregar ficheiros
  for(var k in ALL){
    var b=new Blob([JSON.stringify(ALL[k],null,2)],{type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(b);
    a.download=k+'_tournaments_mapped.json'; a.click();
    await new Promise(r=>setTimeout(r,500));
  }
  window._ALL_CATEGORIES=ALL;
  document.title='TUDO FEITO!';
})();
```

---

### International Local Tours — Script Especial

As International Local Tours têm uma estrutura diferente (página por região, não dropdown central).

**Passo 1: Descobrir todas as regiões** (correr em `https://tournaments.uskidsgolf.com/tournaments/local-tours/find-local-tour/international-local-tours`):

```javascript
(function(){
  var links = document.querySelectorAll('a[href*="/find-local-tour/"]');
  var tours = [];
  var seen = {};
  for(var i=0; i<links.length; i++){
    var href = links[i].href;
    if(seen[href]) continue;
    seen[href] = true;
    var m = href.match(/find-local-tour\/(\d+)\/([\w-]+)/);
    if(m){
      tours.push({id: m[1], slug: m[2], label: links[i].textContent.trim(), url: href});
    }
  }
  console.log('Encontradas ' + tours.length + ' regiões internacionais');
  window._INT_TOURS = tours;
})();
```

Resultado: **125 regiões** em 40+ países.

**Passo 2: Extrair torneios de cada região:**

```javascript
(async function(){
  var tours = window._INT_TOURS;
  if(!tours){alert('Corre o script de regiões primeiro!'); return;}
  var all = [];

  for(var i=0; i<tours.length; i++){
    var tour = tours[i];
    var resultsUrl = tour.url + '/results';
    document.title = 'Int ' + (i+1) + '/' + tours.length + ' - ' + tour.label;

    try {
      var r = await fetch(resultsUrl, {credentials:'include'});
      var h = await r.text();
      var doc = new DOMParser().parseFromString(h, 'text/html');

      // Verificar se tem dropdown de anos
      var yearSel = doc.getElementById('edit-date-value-year');
      var years = [];
      if(yearSel){
        for(var y=0; y<yearSel.options.length; y++){
          if(yearSel.options[y].value) years.push(yearSel.options[y].value);
        }
      }
      if(years.length === 0) years = [''];

      for(var yi=0; yi<years.length; yi++){
        var pageUrl = years[yi] ? resultsUrl + '?date%5Bvalue%5D%5Byear%5D=' + years[yi] : resultsUrl;
        var pageHtml = h;
        if(years[yi]){
          try {
            var r2 = await fetch(pageUrl, {credentials:'include'});
            pageHtml = await r2.text();
          } catch(e){ continue; }
        }

        var tMatch = pageHtml.match(/signupanytime\.com[^"']*[?&]t=(\d+)/);
        var doc2 = new DOMParser().parseFromString(pageHtml, 'text/html');
        var jumpSel = doc2.getElementById('edit-jump');
        
        if(jumpSel && jumpSel.options.length > 1){
          for(var j=0; j<jumpSel.options.length; j++){
            var o = jumpSel.options[j];
            if(!o.value) continue;
            var m = o.value.match(/tournament_id=(\d+)/);
            if(m) all.push({
              region: tour.label, region_id: tour.id, region_slug: tour.slug,
              year: years[yi] || null, tournament_id: m[1], name: o.text.trim(),
              signupanytime_t: null, needs_fetch: true
            });
          }
        } else if(tMatch){
          all.push({
            region: tour.label, region_id: tour.id, region_slug: tour.slug,
            year: years[yi] || null, tournament_id: null,
            name: tour.label + (years[yi] ? ' ' + years[yi] : ''),
            signupanytime_t: tMatch[1], needs_fetch: false
          });
        }
      }
    } catch(e){ console.error(tour.label, e); }
    await new Promise(r=>setTimeout(r,200));
  }

  // Fase 2: buscar t= dos que precisam
  var needFetch = all.filter(x => x.needs_fetch);
  for(var i=0; i<needFetch.length; i++){
    var t = needFetch[i];
    document.title = 'Int t= ' + (i+1) + '/' + needFetch.length;
    var base = 'https://tournaments.uskidsgolf.com/tournaments/local/find-local-tour/' + t.region_id + '/' + t.region_slug + '/results';
    var url = base + '?date%5Bvalue%5D%5Byear%5D=' + t.year + '&tournament_id=' + t.tournament_id;
    try {
      var r = await fetch(url, {credentials:'include'});
      var h = await r.text();
      var m = h.match(/signupanytime\.com[^"']*[?&]t=(\d+)/);
      if(m) t.signupanytime_t = m[1];
    } catch(e){}
    await new Promise(r=>setTimeout(r,150));
  }

  var withT = all.filter(x=>x.signupanytime_t).length;
  document.title = 'DONE Int: ' + withT + '/' + all.length;
  window._INTERNATIONAL_LOCAL = all;
  var blob = new Blob([JSON.stringify(all, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'international_local_tours_mapped.json';
  a.click();
})();
```

---

## FASE 3: Extrair Scorecards (API signupanytime)

Uma vez que temos o `t=` de cada torneio, podemos aceder à API do signupanytime para obter os scorecards reais.

### Endpoint Principal

```
https://www.signupanytime.com/plugins/links/admin/LinksAJAX.aspx?op=GetPlayerTeeTimes&t={t}
```

### Descoberta de Flight IDs (Categorias de Idade)

**Os flight IDs estão num `<select>` com id `view_flight_age_group`** na página iframe do torneio.

Para extraí-los, fazer fetch da página iframe e parsear o HTML:

```
https://www.signupanytime.com/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t={t}
```

O HTML contém:
```html
<select id="view_flight_age_group">
  <option value="13517" selected="">Boys 7 &amp; Under</option>
  <option value="13518">Boys 8</option>
  <option value="13519">Boys 9</option>
  ...
</select>
```

O `value` de cada `<option>` é o **flight ID real**.

### Chamada da API para Obter Scorecards

```
/plugins/links/admin/LinksAJAX.aspx?op=GetPlayerTeeTimes&f={flight_id}&r=2&p=1&t=0
```

| Parâmetro | Significado |
|-----------|-------------|
| `op` | Operação (GetPlayerTeeTimes) |
| `f` | Flight ID (da dropdown) |
| `r` | Número de rondas (2 é seguro) |
| `p` | Página (1) |
| `t` | 0 ou 1 (tentar ambos se um não funcionar) |

### Estrutura da Resposta JSON

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

**Notas:**
- Array `strokes` tem sempre 18 posições; zeros = buracos não jogados
- `start_hole` indica buraco de partida (ex: 10 = back nine)
- `status`: 1 = activo, outro = WD/DNS

### Script Completo de Scraping (correr em signupanytime.com)

```javascript
(async function(){
  // Lista de torneios com t= (importar do ficheiro JSON)
  var tournaments = [...]; // Colar aqui os torneios com signupanytime_t

  var BASE = '/plugins/links/admin/LinksAJAX.aspx';
  var IFRAME_BASE = '/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=';
  var allData = [];

  for(var i=0; i<tournaments.length; i++){
    var t = tournaments[i];
    if(!t.signupanytime_t) continue;
    document.title = (i+1) + '/' + tournaments.length + ' - ' + t.name;

    try {
      // 1. Obter flight IDs
      var resp = await fetch(IFRAME_BASE + t.signupanytime_t);
      var html = await resp.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var sel = doc.getElementById('view_flight_age_group');
      if(!sel) continue;

      var flights = [];
      for(var j=0; j<sel.options.length; j++){
        flights.push({id: sel.options[j].value, name: sel.options[j].text});
      }

      // 2. Obter dados de cada flight
      var tournamentData = {name: t.name, year: t.year, t: t.signupanytime_t, flights: []};
      for(var f=0; f<flights.length; f++){
        try {
          var r = await fetch(BASE + '?op=GetPlayerTeeTimes&f=' + flights[f].id + '&r=2&p=1&t=0');
          var json = await r.json();
          tournamentData.flights.push({
            flight_id: flights[f].id,
            flight_name: flights[f].name,
            data: json
          });
        } catch(e){}
        await new Promise(r=>setTimeout(r,150));
      }
      allData.push(tournamentData);
    } catch(e){ console.error(t.name, e); }
    await new Promise(r=>setTimeout(r,200));
  }

  var blob = new Blob([JSON.stringify(allData, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'uskids_scorecards_complete.json';
  a.click();
  document.title = 'DONE: ' + allData.length + ' torneios';
})();
```

---

## Outros Endpoints Úteis da API

| Endpoint | Descrição |
|----------|-----------|
| `?op=GetMeta&t={t}` | Metadados: nome, categorias, nº rondas, nomes dos buracos |
| `?op=GetPlayerTeeTimes&f={f}&r=2&p=1&t=0` | Scorecards completos de uma categoria |

---

## Script de Emergência — Recuperar Dados da Memória

Se o download automático não funcionar mas os dados ainda estão em memória:

```javascript
// Para categorias standard
for(var k in window._ALL_CATEGORIES){
  var b=new Blob([JSON.stringify(window._ALL_CATEGORIES[k],null,2)],{type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(b);
  a.download=k+'_tournaments_mapped.json'; a.click();
}

// Para International Local Tours
var b=new Blob([JSON.stringify(window._INTERNATIONAL_LOCAL,null,2)],{type:'application/json'});
var a=document.createElement('a'); a.href=URL.createObjectURL(b);
a.download='international_local_tours_mapped.json'; a.click();
```

---

## Ficheiros Gerados

| Ficheiro | Conteúdo | Formato |
|----------|----------|---------|
| `world_tournaments_mapped.json` | 44 torneios, 33 com t= | `{year, tournament_id, name, signupanytime_t}` |
| `regional_tournaments_mapped.json` | 161 torneios, 133 com t= | Idem |
| `teen-world_tournaments_mapped.json` | 23 torneios, 19 com t= | Idem |
| `state_tournaments_mapped.json` | 702 torneios, 213 com t= | Idem |
| `girls-invitationals_tournaments_mapped.json` | 11 torneios, 11 com t= | Idem |
| `teen-series_tournaments_mapped.json` | 189 torneios, 189 com t= | Idem |
| `international_local_tours_mapped.json` | 15 torneios, 15 com t= | `{region, region_id, year, tournament_id, name, signupanytime_t}` |
| **`all_tournaments_consolidated.json`** | **1145 torneios (todos)** | Unificado com campo `category` |
| **`tournaments_ready_for_scraping.json`** | **613 com t= (prontos)** | Prontos para Fase 3 (API) |

---

## Notas Técnicas Importantes

1. **CORS:** Scripts de fetch só funcionam se a consola estiver aberta no domínio correcto (uskidsgolf.com para listar torneios; signupanytime.com para API de scorecards).

2. **Usar `var` em vez de `let`:** Na consola do browser, `let` dá erro de re-declaração se o script for corrido várias vezes.

3. **Flight IDs são globais:** Na plataforma signupanytime, o ID `f=13517` refere-se a UMA categoria de UM torneio em toda a plataforma. Não são relativos.

4. **Parâmetro `t` no GetPlayerTeeTimes:** Alterna entre 0 e 1. Tentar ambos se um não devolver dados.

5. **Rate limiting:** Usar delays de 150-300ms entre requests para não sobrecarregar o servidor.

6. **Torneios pré-2013:** Não têm iframe signupanytime. Os dados mais antigos podem usar um sistema diferente.

7. **Variáveis na consola perdem-se:** Se mudar de tab ou fechar a consola, os dados desaparecem. Os scripts devem ser auto-contidos e fazer download automático.

8. **`ax=1129`:** Parece ser o ID da aplicação USKids na plataforma signupanytime (constante).

---

## Resultado Final — Mapeamento de Torneios

| Categoria | Total | Com t= | Sem t= | Estado |
|-----------|------:|-------:|-------:|--------|
| World | 44 | 33 | 11 | ✅ Completo |
| Regional | 161 | 133 | 28 | ✅ Completo |
| Teen World | 23 | 19 | 4 | ✅ Completo |
| State | 702 | 213 | 489 | ✅ Completo |
| Girls Invitationals | 11 | 11 | 0 | ✅ Completo |
| Teen Series | 189 | 189 | 0 | ✅ Completo |
| International Local | 15 | 15 | 0 | ⚠️ Parcial (só actuais) |
| **TOTAL** | **1145** | **613** | **532** | |

**Categorias vazias (slug inexistente ou estrutura diferente):**
- `world-teen` — vazio (torneios Teen World estão em `teen-world`)
- `local-tours` — vazio (estrutura diferente ou só torneios futuros)
- `parent-child` — vazio (pode não ter past-results)

**Nota sobre os 532 sem t=:** Quase todos anteriores a 2013, quando o signupanytime não era usado.

### Ficheiros Consolidados

- `all_tournaments_consolidated.json` — 1145 torneios, todas as categorias
- `tournaments_ready_for_scraping.json` — 613 com signupanytime_t, prontos para Fase 3

### Torneios prontos para scraping da API (por categoria)

1. State: 213
2. Teen Series: 189
3. Regional: 133
4. World: 33
5. Teen World: 19
6. International Local: 15
7. Girls Invitationals: 11

## Próximos Passos

1. ⏳ **Melhorar International Local Tours** — re-correr com iteração por anos (125 regiões × múltiplos anos)
2. ⏳ **Extrair scorecards** — usar 613 torneios com t= para chamar GetPlayerTeeTimes
3. ⏳ **Combinar tudo** num `uskids_complete.json`
4. ⏳ **Carregar na aplicação React** para análise de jogadores
