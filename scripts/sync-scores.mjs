import https from 'https';

const FIREBASE_PROJECT = 'quiniela-2026-f270d';
const FIREBASE_API_KEY = 'AIzaSyCPWIL-mqKl5cn7zg9ozSH4F_0-SlgSZHE';
const SETTINGS_PATH    = 'quiniela_config/control';

const MATCHES = [
  [1,"Mexico","South Africa"],[2,"South Korea","Czech Republic"],
  [3,"Canada","Bosnia"],[4,"Qatar","Switzerland"],
  [5,"Brazil","Morocco"],[6,"Haiti","Scotland"],
  [7,"United States","Paraguay"],[8,"Australia","Turkey"],
  [9,"Germany","Curacao"],[10,"Ivory Coast","Ecuador"],
  [11,"Netherlands","Japan"],[12,"Sweden","Tunisia"],
  [13,"Belgium","Egypt"],[14,"Iran","New Zealand"],
  [15,"Spain","Cape Verde"],[16,"Saudi Arabia","Uruguay"],
  [17,"France","Senegal"],[18,"Iraq","Norway"],
  [19,"Argentina","Algeria"],[20,"Austria","Jordan"],
  [21,"Portugal","DR Congo"],[22,"Uzbekistan","Colombia"],
  [23,"England","Croatia"],[24,"Ghana","Panama"],
  [25,"Czech Republic","South Africa"],[26,"Canada","Qatar"],
  [27,"Scotland","Morocco"],[28,"Brazil","Haiti"],
  [29,"United States","Australia"],[30,"Turkey","Paraguay"],
  [31,"Germany","Ivory Coast"],[32,"Ecuador","Curacao"],
  [33,"Netherlands","Sweden"],[34,"Tunisia","Japan"],
  [35,"Belgium","Iran"],[36,"New Zealand","Egypt"],
  [37,"Spain","Saudi Arabia"],[38,"Uruguay","Cape Verde"],
  [39,"Argentina","Austria"],[40,"France","Iraq"],
  [41,"Norway","Senegal"],[42,"Jordan","Algeria"],
  [43,"Portugal","Uzbekistan"],[44,"England","Ghana"],
  [45,"Panama","Croatia"],[46,"Colombia","DR Congo"],
  [47,"Switzerland","Canada"],[48,"Bosnia","Qatar"],
  [49,"Scotland","Brazil"],[50,"Morocco","Haiti"],
  [51,"Czech Republic","Mexico"],[52,"South Africa","South Korea"],
  [53,"Ecuador","Germany"],[54,"Curacao","Ivory Coast"],
  [55,"Tunisia","Netherlands"],[56,"Japan","Sweden"],
  [57,"Turkey","United States"],[58,"Paraguay","Australia"],
  [59,"Norway","France"],[60,"Senegal","Iraq"],
  [61,"Uruguay","Spain"],[62,"Cape Verde","Saudi Arabia"],
  [63,"New Zealand","Belgium"],[64,"Egypt","Iran"],
  [65,"Panama","England"],[66,"Croatia","Ghana"],
  [67,"Colombia","Portugal"],[68,"DR Congo","Uzbekistan"],
  [69,"Jordan","Argentina"],[70,"Algeria","Austria"],
  [71,"Switzerland","Bosnia"],[72,"Mexico","South Korea"],
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function firestoreReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const p = '/v1/projects/' + FIREBASE_PROJECT + '/databases/(default)/documents/' + path + '?key=' + FIREBASE_API_KEY;
    const opts = {
      hostname: 'firestore.googleapis.com',
      path: p, method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function toFS(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return { integerValue: String(Math.round(val)) };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k,v] of Object.entries(val)) fields[k] = toFS(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

async function main() {
  const now  = new Date();
  const ayer = new Date(now); ayer.setDate(now.getDate() - 1);
  const fmt  = d => d.toISOString().slice(0,10).replace(/-/g,'');
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

  console.log('Consultando ESPN...');
  const [td, yd] = await Promise.all([
    fetchUrl(ESPN + '?dates=' + fmt(now)).catch(() => ({ events: [] })),
    fetchUrl(ESPN + '?dates=' + fmt(ayer)).catch(() => ({ events: [] })),
  ]);

  const all = [...(yd.events || []), ...(td.events || [])];
  console.log('ESPN: ' + all.length + ' evento(s)');
  if (!all.length) { console.log('Sin datos.'); return; }

  const doc = await firestoreReq('GET', SETTINGS_PATH, null);
  const cur = {};
  const rrFields = doc.fields && doc.fields.realResults && doc.fields.realResults.mapValue
    ? doc.fields.realResults.mapValue.fields || {}
    : {};
  for (const [k, v] of Object.entries(rrFields)) {
    const f = (v.mapValue && v.mapValue.fields) || {};
    cur[k] = {
      gl:    (f.gl    && f.gl.stringValue)    || '',
      gv:    (f.gv    && f.gv.stringValue)    || '',
      final: (f.final && f.final.booleanValue),
    };
  }

  const nr  = Object.assign({}, cur);
  let upd   = 0;
  const LIVE = ['STATUS_IN_PROGRESS', 'STATUS_HALFTIME'];
  const DONE = ['STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FULL_PEN', 'STATUS_FULL_ET'];

  for (const ev of all) {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp) continue;
    const st      = (comp.status && comp.status.type && comp.status.type.name) || '';
    const isLive  = LIVE.includes(st);
    const isFinal = DONE.includes(st) || (comp.status && comp.status.type && comp.status.type.completed === true);
    if (!isLive && !isFinal) continue;

    const competitors = comp.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home');
    const away = competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const hN  = (home.team && (home.team.displayName || home.team.name)) || '';
    const aN  = (away.team && (away.team.displayName || away.team.name)) || '';
    const hs  = parseInt(home.score || '0');
    const as_ = parseInt(away.score || '0');
    if (isNaN(hs) || isNaN(as_)) continue;

    console.log('  ' + st + ': ' + hN + ' ' + hs + '-' + as_ + ' ' + aN);

    const match = MATCHES.find(m => (m[1]===hN && m[2]===aN) || (m[1]===aN && m[2]===hN));
    if (!match) { console.log('  Sin mapeo: ' + hN + ' vs ' + aN); continue; }

    const id    = match[0];
    const local = match[1];
    const gl  = String(local === hN ? hs : as_);
    const gv  = String(local === hN ? as_ : hs);
    const key = String(id);
    const prev = nr[key];
    if (prev && prev.final === true && !isFinal) continue;
    if (!prev || prev.gl !== gl || prev.gv !== gv || prev.final !== isFinal) {
      nr[key] = { gl, gv, final: isFinal };
      upd++;
      console.log('  Partido ' + id + ': ' + gl + '-' + gv + ' final:' + isFinal);
    }
  }

  const patchPath = SETTINGS_PATH
    + '?key=' + FIREBASE_API_KEY
    + '&updateMask.fieldPaths=realResults'
    + '&updateMask.fieldPaths=lastApiSync'
    + '&updateMask.fieldPaths=updatedAt';
  await firestoreReq('PATCH', patchPath, {
    fields: {
      realResults: toFS(nr),
      lastApiSync: toFS(Date.now()),
      updatedAt:   toFS(Date.now()),
    }
  });
  console.log('Firebase actualizado (' + upd + ' cambio(s))');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
