/*
 * DISCOVERY — Cola em signupanytime.com (F12 > Console)
 * Examina como a página descobre os flight IDs
 */

// Testar com British Championship 2015
var T = '1108';
var URL_BASE = '/plugins/links/admin/LinksAJAX.aspx';
var IFRAME = '/plugins/links/front/linksviews.aspx?v=results&fmt=nohead&ax=1129&t=' + T;

// 1. GetMeta
fetch(URL_BASE + '?op=GetMeta&t=' + T).then(r => r.text()).then(txt => {
  console.log('=== GetMeta ===');
  console.log(txt.substring(0, 500));
  try {
    var meta = JSON.parse(txt);
    console.log('Keys:', Object.keys(meta));
    if (meta.age_groups) console.log('age_groups:', JSON.stringify(meta.age_groups).substring(0, 500));
  } catch(e) { console.log('Not JSON'); }
});

// 2. Iframe page source
fetch(IFRAME).then(r => r.text()).then(html => {
  console.log('\n=== IFRAME PAGE ===');
  console.log('Size:', html.length, 'bytes');
  
  // Find ALL script content
  var scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  console.log('Script blocks:', scripts.length);
  
  // Search for flight-related code
  for (var i = 0; i < scripts.length; i++) {
    var js = scripts[i].replace(/<\/?script[^>]*>/gi, '');
    if (js.length < 20) continue;
    if (/flight|Flight|teetimes|TeeTimes|category|division|GetPlayer/i.test(js)) {
      console.log('\n--- RELEVANT Script ' + i + ' (' + js.length + ' chars) ---');
      console.log(js.substring(0, 2000));
      if (js.length > 2000) console.log('... truncated ...');
    }
  }
  
  // Find flight ID patterns anywhere in page
  console.log('\n=== FLIGHT PATTERNS ===');
  
  var p1 = html.match(/f=\d+/g);
  if (p1) console.log('f=NNN:', [...new Set(p1)].join(', '));
  
  var p2 = html.match(/GetPlayerTeeTimes[^"']{0,50}/g);
  if (p2) console.log('GetPlayerTeeTimes refs:', p2.slice(0, 5));
  
  var p3 = html.match(/["'](\d{2,6})["']\s*[,\]]/g);
  if (p3) console.log('Numeric IDs in arrays:', p3.slice(0, 10));
  
  // Look for variable assignments with arrays of numbers
  var arrayMatch = html.match(/(?:flights|categories|divisions|tabs|groups)\s*[=:]\s*\[([^\]]+)\]/gi);
  if (arrayMatch) {
    console.log('Array assignments:', arrayMatch.slice(0, 5));
  }
  
  // Look for any URL with flight/category params
  var urlMatch = html.match(/(?:href|src|url|action)[=:]["'][^"']*(?:flight|category|division|f=)[^"']*/gi);
  if (urlMatch) console.log('URLs with flight/cat params:', urlMatch.slice(0, 5));
  
  console.log('\n=== DONE ===');
});

// 3. Test other operations
var otherOps = ['GetFlights','GetResults','GetCategories','GetDivisions','GetField','GetEntries','GetData','GetConfig'];
otherOps.forEach(function(op) {
  fetch(URL_BASE + '?op=' + op + '&t=' + T).then(function(r) {
    return r.text().then(function(txt) {
      if (r.status === 200 && txt.length > 50) {
        console.log('✅ ' + op + ': ' + txt.length + ' bytes → ' + txt.substring(0, 150));
      }
    });
  }).catch(function() {});
});
