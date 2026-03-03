/*
 * DIAGNÓSTICO — Cola em QUALQUER página (F12 > Console)
 * Cria um botão visível para seleccionar o ficheiro
 */

// Create visible UI
var div = document.createElement('div');
div.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;background:#1e293b;color:#fff;padding:20px;border-radius:12px;font-family:sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
div.innerHTML = '<h3 style="margin:0 0 10px">⛳ USKids Diagnóstico</h3><p style="margin:0 0 10px;font-size:13px;color:#94a3b8">Selecciona o uskids_complete.json ou último backup</p><input type="file" id="uskdiag" accept=".json" style="font-size:14px;color:#fff"><div id="uskdiag_status" style="margin-top:10px;font-size:12px;color:#93c5fd"></div>';
document.body.appendChild(div);

document.getElementById('uskdiag').onchange = function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var status = document.getElementById('uskdiag_status');
  status.textContent = 'A ler ' + (file.size/1024/1024).toFixed(1) + ' MB...';
  
  var reader = new FileReader();
  reader.onload = function(ev) {
    status.textContent = 'A analisar...';
    try {
      var data = JSON.parse(ev.target.result);
      analisar(data, file.name, file.size, status);
    } catch(err) {
      status.textContent = 'ERRO: ' + err.message;
      status.style.color = '#fca5a5';
    }
  };
  reader.readAsText(file);
};

function analisar(data, filename, filesize, statusEl) {
  var ts = data.tournaments || [];
  var problems = [];
  var okCount = 0;
  var fingerprints = {}; // player fingerprint → first tournament index
  
  console.log('📊 Analisando ' + ts.length + ' torneios...\n');
  
  for (var i = 0; i < ts.length; i++) {
    var t = ts[i];
    var flights = t.flights || {};
    var cats = t.flight_categories || {};
    var fkeys = Object.keys(flights);
    var nFlights = fkeys.length;
    var nExpected = t.num_categories_expected || t.num_categories || 0;
    var nPlayers = t.num_players || 0;
    
    var issues = [];
    
    // Check 1: empty
    if (nFlights === 0) {
      issues.push('EMPTY: 0 flights');
    }
    
    // Check 2: only 1 category when expecting more
    if (nFlights === 1 && nExpected > 1) {
      issues.push('INCOMPLETE: 1/' + nExpected + ' cats');
    }
    
    // Check 3: duplicate players WITHIN tournament (same players in different flights)
    var localPrints = {};
    var dupWithin = 0;
    for (var j = 0; j < fkeys.length; j++) {
      var fp = flights[fkeys[j]].flight_players || {};
      var names = [];
      for (var pid in fp) {
        names.push((fp[pid].first || '') + ' ' + (fp[pid].last || ''));
      }
      names.sort();
      var print = names.slice(0, 8).join('|');
      if (print.length < 5) continue;
      
      if (localPrints[print]) {
        dupWithin++;
      }
      localPrints[print] = true;
      
      // Check 4: same players as ANOTHER tournament
      if (fingerprints[print] !== undefined && fingerprints[print] !== i) {
        var origIdx = fingerprints[print];
        issues.push('CROSS_DUP: flight ' + fkeys[j] + ' has same players as tournament #' + origIdx + ' (' + ts[origIdx].name + ')');
      }
      if (fingerprints[print] === undefined) {
        fingerprints[print] = i;
      }
    }
    
    if (dupWithin > 0) {
      issues.push('DUP_INTERNAL: ' + dupWithin + ' flights with identical players');
    }
    
    // Check 5: fewer categories than expected (partial)
    if (nFlights > 1 && nExpected > 0 && nFlights < nExpected) {
      issues.push('PARTIAL: ' + nFlights + '/' + nExpected + ' cats');
    }
    
    var icon = issues.length === 0 ? '✅' : '🔴';
    var extra = issues.length > 0 ? ' — ' + issues[0] : '';
    console.log(icon + ' [' + i + '] ' + t.name + ' (' + t.year + ') | ' + nFlights + '/' + nExpected + ' cats | ' + nPlayers + ' pl' + extra);
    
    if (issues.length > 0) {
      problems.push({
        idx: i, name: t.name, year: t.year,
        tournament_id: t.tournament_id,
        iframe_url: t.iframe_url,
        nFlights: nFlights, nExpected: nExpected, nPlayers: nPlayers,
        issues: issues
      });
    } else {
      okCount++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO:');
  console.log('  Total: ' + ts.length);
  console.log('  OK: ' + okCount);
  console.log('  Problemas: ' + problems.length);
  
  if (problems.length > 0) {
    console.log('\n🔴 TORNEIOS COM PROBLEMAS:');
    for (var k = 0; k < problems.length; k++) {
      var p = problems[k];
      console.log('  [' + p.idx + '] ' + p.name + ' (' + p.year + ') — ' + p.issues.join('; '));
    }
  }
  
  // Download diagnostic
  var result = {
    file: filename,
    fileSize: filesize,
    timestamp: new Date().toISOString(),
    total: ts.length,
    ok: okCount,
    problemCount: problems.length,
    problems: problems,
    rescrapeList: problems.map(function(p) {
      return { idx: p.idx, name: p.name, year: p.year, tournament_id: p.tournament_id, iframe_url: p.iframe_url };
    })
  };
  
  var blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'uskids_diagnostico.json'; a.click();
  
  statusEl.textContent = '✅ Concluído! ' + okCount + ' OK, ' + problems.length + ' com problemas. Ficheiro descarregado.';
  statusEl.style.color = '#4ade80';
}
