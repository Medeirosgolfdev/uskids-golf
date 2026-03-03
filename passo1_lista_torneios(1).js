/*
=============================================================
PASSO 1: Recolher lista de torneios
=============================================================
Correr na página: https://tournaments.uskidsgolf.com/tournaments/international/past-results
Abrir consola (F12 → Console), colar TUDO e pressionar Enter.
*/

(async function() {
  console.log('🏌️ USKids Tournament Scraper - Passo 1: Lista de Torneios');
  console.log('='.repeat(60));
  
  var allTournaments = [];
  
  // Encontrar o dropdown de anos
  var yearSelect = document.querySelector('select[name*="date"], select[id*="date"]');
  if (!yearSelect) {
    // Tentar encontrar de outra forma
    var selects = document.querySelectorAll('select');
    for (var i = 0; i < selects.length; i++) {
      var opts = selects[i].querySelectorAll('option');
      for (var j = 0; j < opts.length; j++) {
        if (opts[j].value === '2025' || opts[j].textContent.trim() === '2025') {
          yearSelect = selects[i];
          break;
        }
      }
      if (yearSelect) break;
    }
  }
  
  if (!yearSelect) {
    console.error('❌ Não encontrei o dropdown de anos! Verifica que estás na página certa.');
    return;
  }
  
  // Obter anos disponíveis
  var years = [];
  var yearOptions = yearSelect.querySelectorAll('option');
  yearOptions.forEach(function(opt) {
    var y = parseInt(opt.value);
    if (y >= 2002 && y <= 2026) {
      years.push(y);
    }
  });
  
  console.log('Anos encontrados: ' + years.join(', '));
  
  // Encontrar o dropdown de torneios
  var tournamentSelect = null;
  var selects = document.querySelectorAll('select');
  for (var i = 0; i < selects.length; i++) {
    if (selects[i] !== yearSelect) {
      var opts = selects[i].querySelectorAll('option');
      if (opts.length > 1) {
        tournamentSelect = selects[i];
        break;
      }
    }
  }
  
  // Para cada ano, carregar a página e extrair torneios
  for (var yi = 0; yi < years.length; yi++) {
    var year = years[yi];
    console.log('\n📅 Ano ' + year + ' (' + (yi+1) + '/' + years.length + ')...');
    
    // Construir URL para este ano
    var yearUrl = 'https://tournaments.uskidsgolf.com/tournaments/international/past-results?date%5Bvalue%5D%5Byear%5D=' + year;
    
    try {
      // Fazer fetch da página para este ano
      var response = await fetch(yearUrl);
      var html = await response.text();
      
      // Criar parser
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      
      // Encontrar o dropdown de torneios nesta página
      var tournSelects = doc.querySelectorAll('select');
      var tournOptions = [];
      
      for (var si = 0; si < tournSelects.length; si++) {
        var opts = tournSelects[si].querySelectorAll('option');
        for (var oi = 0; oi < opts.length; oi++) {
          var val = opts[oi].value;
          if (val && val.includes('tournament_id=')) {
            tournOptions.push(opts[oi]);
          }
        }
      }
      
      if (tournOptions.length === 0) {
        console.log('   Nenhum torneio encontrado para ' + year);
        continue;
      }
      
      console.log('   ' + tournOptions.length + ' torneios encontrados');
      
      // Para cada torneio, extrair info
      for (var ti = 0; ti < tournOptions.length; ti++) {
        var opt = tournOptions[ti];
        var text = opt.textContent.replace(/\s+/g, ' ').trim();
        var val = opt.value;
        
        // Extrair tournament_id do value
        var idMatch = val.match(/tournament_id=(\d+)/);
        var tournamentId = idMatch ? idMatch[1] : '';
        
        // Extrair data do texto (ex: "(Mar 15)")
        var dateMatch = text.match(/\(([^)]+)\)/);
        var date = dateMatch ? dateMatch[1].trim() : '';
        var name = text.replace(/\([^)]+\)/, '').trim();
        
        allTournaments.push({
          name: name,
          year: year,
          tournament_id: tournamentId,
          date: date,
          page_url: 'https://tournaments.uskidsgolf.com/tournaments/international/past-results?date%5Bvalue%5D%5Byear%5D=' + year + '&tournament_id=' + tournamentId,
          iframe_url: null  // Será preenchido no passo seguinte
        });
      }
      
    } catch(e) {
      console.log('   ⚠️ Erro ao carregar ano ' + year + ': ' + e.message);
    }
    
    // Pequena pausa para não sobrecarregar o servidor
    await new Promise(function(r) { setTimeout(r, 500); });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 Total: ' + allTournaments.length + ' torneios encontrados');
  console.log('');
  console.log('Agora a obter URLs dos iframes... (isto demora um pouco)');
  
  // Fase 2: Para cada torneio, obter o URL do iframe
  var withIframes = 0;
  var errors = 0;
  
  for (var i = 0; i < allTournaments.length; i++) {
    var t = allTournaments[i];
    
    if (i % 10 === 0) {
      console.log('   Processando ' + (i+1) + '/' + allTournaments.length + '...');
    }
    
    try {
      var resp = await fetch(t.page_url);
      var html = await resp.text();
      
      // Procurar o src do iframe
      var iframeMatch = html.match(/src="(https?:\/\/www\.signupanytime\.com[^"]+)"/);
      if (iframeMatch) {
        t.iframe_url = iframeMatch[1].replace(/&amp;/g, '&');
        withIframes++;
      } else {
        // Tentar outro padrão
        var iframeMatch2 = html.match(/signupanytime\.com[^"'\s]+/);
        if (iframeMatch2) {
          t.iframe_url = 'https://www.' + iframeMatch2[0].replace(/&amp;/g, '&');
          withIframes++;
        }
      }
    } catch(e) {
      errors++;
    }
    
    // Pausa
    await new Promise(function(r) { setTimeout(r, 300); });
  }
  
  // Filtrar torneios sem iframe (provavelmente sem resultados)
  var validTournaments = allTournaments.filter(function(t) { return t.iframe_url; });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETO!');
  console.log('   Torneios com resultados: ' + validTournaments.length);
  console.log('   Torneios sem resultados: ' + (allTournaments.length - validTournaments.length));
  if (errors > 0) console.log('   Erros: ' + errors);
  
  // Agrupar por ano para mostrar resumo
  var byYear = {};
  validTournaments.forEach(function(t) {
    if (!byYear[t.year]) byYear[t.year] = 0;
    byYear[t.year]++;
  });
  console.log('\n   Por ano:');
  Object.keys(byYear).sort().forEach(function(y) {
    console.log('   ' + y + ': ' + byYear[y] + ' torneios');
  });
  
  // Copiar para clipboard
  var output = JSON.stringify(validTournaments, null, 2);
  copy(output);
  console.log('\n✅ JSON copiado para o clipboard!');
  console.log('   Abre um editor de texto, cola (Ctrl+V) e guarda como:');
  console.log('   → torneios_lista.json');
  console.log('');
  console.log('   Depois segue para o PASSO 2.');
  
})();
