// ============================================================
// USKids Golf — FASE 3: Extracção de Scorecards
// ============================================================
// ONDE CORRER: Na consola do browser (F12), em signupanytime.com
// 
// PASSO 1: Abrir https://www.signupanytime.com em qualquer página
// PASSO 2: Abrir F12 > Console
// PASSO 3: Colar PARTE A (abaixo) — carrega o ficheiro de torneios
// PASSO 4: Quando pedir, seleccionar o ficheiro tournaments_compact.json
// PASSO 5: Depois de carregado, colar PARTE B — inicia o scraping
//
// O script exporta um JSON a cada 10 torneios para segurança.
// ============================================================


// ================== PARTE A — Carregar dados ==================
// Cola isto primeiro:

(function(){
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e){
    var file = e.target.files[0];
    var reader = new FileReader();
    reader.onload = function(ev){
      try {
        var data = JSON.parse(ev.target.result);
        // Accept both compact format {c,n,t} and full format {category,name,signupanytime_t}
        window._TORNEIOS = data.map(function(x){
          return {
            category: x.c || x.category,
            name: x.n || x.name,
            t: x.t || x.signupanytime_t
          };
        }).filter(function(x){ return x.t; });
        document.title = 'CARREGADO: ' + window._TORNEIOS.length + ' torneios';
        console.log('✅ ' + window._TORNEIOS.length + ' torneios carregados. Agora cola a PARTE B.');
      } catch(err){
        console.error('Erro ao ler ficheiro:', err);
      }
    };
    reader.readAsText(file);
  };
  input.click();
})();


// ================== PARTE B — Scraping ==================
// Cola isto DEPOIS de ver "✅ X torneios carregados" na consola:

(async function(){
  if(!window._TORNEIOS || !window._TORNEIOS.length){
    alert('Primeiro corre a PARTE A para carregar os torneios!');
    return;
  }

  var torneios = window._TORNEIOS;
  var BASE = '/plugins/links/admin/LinksAJAX.aspx';
  var IFRAME_BASE = '/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=';
  var BATCH_SIZE = 10;

  // Resume support: skip already downloaded
  var startFrom = window._RESUME_FROM || 0;
  if(startFrom > 0){
    console.log('⏩ A retomar a partir do torneio #' + startFrom);
  }

  var batch = [];
  var batchNum = Math.floor(startFrom / BATCH_SIZE);
  var totalWithData = 0;
  var totalFlights = 0;
  var errors = [];

  function saveBatch(batchData, num){
    var blob = new Blob([JSON.stringify(batchData, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scorecards_batch_' + String(num).padStart(3,'0') + '.json';
    a.click();
    console.log('💾 Batch ' + num + ' guardado (' + batchData.length + ' torneios)');
  }

  for(var i = startFrom; i < torneios.length; i++){
    var t = torneios[i];
    var posicao = (i+1) + '/' + torneios.length;
    document.title = posicao + ' ' + t.name;
    console.log('🏌️ ' + posicao + ' [' + t.category + '] ' + t.name + ' (t=' + t.t + ')');

    var tournamentData = {
      category: t.category,
      name: t.name,
      signupanytime_t: t.t,
      flights: [],
      error: null
    };

    try {
      // 1. Fetch iframe page to get flight IDs
      var resp = await fetch(IFRAME_BASE + t.t, {credentials:'include'});
      var html = await resp.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var sel = doc.getElementById('view_flight_age_group');

      if(!sel || sel.options.length === 0){
        console.warn('  ⚠️ Sem dropdown de categorias');
        tournamentData.error = 'no_flight_select';
        batch.push(tournamentData);
        // Check batch
        if(batch.length >= BATCH_SIZE){
          batchNum++;
          saveBatch(batch, batchNum);
          batch = [];
        }
        window._RESUME_FROM = i + 1;
        await new Promise(function(r){ setTimeout(r, 200); });
        continue;
      }

      var flights = [];
      for(var j = 0; j < sel.options.length; j++){
        var opt = sel.options[j];
        if(opt.value && opt.value !== ''){
          flights.push({id: opt.value, name: opt.text.trim()});
        }
      }

      console.log('  📋 ' + flights.length + ' categorias encontradas');

      // 2. For each flight, get player data
      for(var f = 0; f < flights.length; f++){
        var flight = flights[f];
        try {
          // Try t=0 first, then t=1
          var url = BASE + '?op=GetPlayerTeeTimes&f=' + flight.id + '&r=2&p=1&t=0';
          var fResp = await fetch(url, {credentials:'include'});
          var fText = await fResp.text();
          var fData;
          try { fData = JSON.parse(fText); } catch(e){ fData = null; }

          // Check if we got players
          var playerCount = fData && fData.flight_players ? Object.keys(fData.flight_players).length : 0;

          // If no players with t=0, try t=1
          if(playerCount === 0){
            url = BASE + '?op=GetPlayerTeeTimes&f=' + flight.id + '&r=2&p=1&t=1';
            fResp = await fetch(url, {credentials:'include'});
            fText = await fResp.text();
            try { fData = JSON.parse(fText); } catch(e){ fData = null; }
            playerCount = fData && fData.flight_players ? Object.keys(fData.flight_players).length : 0;
          }

          tournamentData.flights.push({
            flight_id: flight.id,
            flight_name: flight.name,
            player_count: playerCount,
            data: fData
          });

          totalFlights++;
          if(playerCount > 0){
            console.log('    ✅ ' + flight.name + ': ' + playerCount + ' jogadores');
          } else {
            console.log('    ⚠️ ' + flight.name + ': 0 jogadores');
          }
        } catch(fe){
          console.error('    ❌ ' + flight.name + ': erro', fe.message);
          tournamentData.flights.push({
            flight_id: flight.id,
            flight_name: flight.name,
            player_count: 0,
            data: null,
            error: fe.message
          });
        }

        // Small delay between flights
        await new Promise(function(r){ setTimeout(r, 150); });
      }

      if(tournamentData.flights.length > 0){
        totalWithData++;
      }

    } catch(e){
      console.error('  ❌ Erro no torneio:', e.message);
      tournamentData.error = e.message;
      errors.push({index: i, name: t.name, error: e.message});
    }

    batch.push(tournamentData);

    // Save batch every BATCH_SIZE tournaments
    if(batch.length >= BATCH_SIZE){
      batchNum++;
      saveBatch(batch, batchNum);
      batch = [];
    }

    // Update resume point
    window._RESUME_FROM = i + 1;

    // Delay between tournaments
    await new Promise(function(r){ setTimeout(r, 300); });
  }

  // Save remaining batch
  if(batch.length > 0){
    batchNum++;
    saveBatch(batch, batchNum);
  }

  // Summary
  document.title = 'FEITO! ' + totalWithData + '/' + torneios.length + ' torneios com dados';
  console.log('');
  console.log('============================');
  console.log('SCRAPING COMPLETO');
  console.log('============================');
  console.log('Torneios processados: ' + torneios.length);
  console.log('Com dados: ' + totalWithData);
  console.log('Total flights: ' + totalFlights);
  console.log('Ficheiros guardados: ' + batchNum + ' batches');
  if(errors.length > 0){
    console.log('Erros: ' + errors.length);
    console.log(JSON.stringify(errors, null, 2));
    // Save errors file
    var eb = new Blob([JSON.stringify(errors, null, 2)], {type:'application/json'});
    var ea = document.createElement('a');
    ea.href = URL.createObjectURL(eb);
    ea.download = 'scorecards_errors.json';
    ea.click();
  }
  console.log('============================');
})();


// ================== EMERGÊNCIA — Retomar scraping ==================
// Se o script parar a meio, podes retomar. Os torneios já processados
// foram guardados nos batch files. Para retomar:
//
// 1. Verifica window._RESUME_FROM na consola (diz-te onde parou)
// 2. Cola outra vez a PARTE B — vai continuar de onde parou
//
// Se perdeste a variável _RESUME_FROM, vê o último batch file
// que descarregaste e calcula: batchNum * 10 = ponto de retoma.
// Depois faz: window._RESUME_FROM = XX; e cola a PARTE B.
