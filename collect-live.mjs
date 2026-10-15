/*
 * collect-live.mjs — one-shot IBOS collector for GitHub Actions
 * ------------------------------------------------------------
 * Connects to the IBOS FlowFuse dashboard (ops.ibos.io) over Socket.IO
 * (Engine.IO polling), gathers the latest "milldata" (silo levels + mill TPH)
 * and machine status topics, and writes them to a JSON file.
 *
 * Credentials come from env: IBOS_USER, IBOS_PASS (set as GitHub secrets).
 * Output: { ok, connected, lastAt, milldata, status }
 */
import http from 'node:http';
import fs from 'node:fs';

const HOST = process.env.IBOS_HOST || 'ops.ibos.io';
const PORT = Number(process.env.IBOS_PORT || 12081);
const USER = process.env.IBOS_USER || 'dashboard';
const PASS = process.env.IBOS_PASS || '';
const SIO_PATH = process.env.IBOS_SIO_PATH || '/dashboard/socket.io/';
const OUT = process.argv[2] || 'live.json';
const DUR = Number(process.argv[3] || 12000);
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASS).toString('base64');

const STATUS_MAP = {
  'loesche.status': 'loesche', 'fls.status': 'fls',
  'P1': 'packer1', 'P2': 'packer2', 'P3': 'packer3', 'P4': 'packer4', 'P5': 'packer5',
  'GRID.status': 'grid', 'R1.status': 'r1', 'M2.status': 'm2'
};

function req(method, qs, body) {
  return new Promise((res, rej) => {
    const r = http.request({
      host: HOST, port: PORT, path: SIO_PATH + '?' + qs, method,
      headers: Object.assign({ Authorization: AUTH, Accept: '*/*' },
        body ? { 'Content-Type': 'text/plain;charset=UTF-8', 'Content-Length': Buffer.byteLength(body) } : {})
    }, x => { let d = ''; x.setEncoding('utf8'); x.on('data', c => d += c); x.on('end', () => res({ status: x.statusCode, body: d })); });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
}
const stamp = () => Date.now() + '' + Math.floor(Math.random() * 1e6);

const out = { ok: false, connected: false, lastAt: 0, milldata: null, status: {} };

function collect(durMs) {
  return new Promise(async (resolve) => {
    try {
      const hs = await req('GET', 'EIO=4&transport=polling&t=' + stamp());
      const sid = JSON.parse(hs.body.slice(1)).sid;
      await req('POST', 'EIO=4&transport=polling&sid=' + sid, '40');
      // ask status widgets for their current value
      for (const node of ['05857ec78d95da7c', 'cea7e6e091ac0c79', '5abe755ecb2c66d7', 'd56526efc48390f3', '6d782c2287b4e425']) {
        req('POST', 'EIO=4&transport=polling&sid=' + sid, '42["widget-load","' + node + '"]').catch(() => {});
      }
      out.connected = true;
      const t0 = Date.now();
      while (Date.now() - t0 < durMs) {
        const g = await req('GET', 'EIO=4&transport=polling&sid=' + sid + '&t=' + stamp());
        if (g.status !== 200) break;
        for (const pkt of g.body.split('\x1e')) {
          if (!pkt) continue;
          if (pkt[0] === '2') { req('POST', 'EIO=4&transport=polling&sid=' + sid, '3').catch(() => {}); continue; }
          if (!pkt.startsWith('42')) continue;
          let arr; try { arr = JSON.parse(pkt.slice(2)); } catch (e) { continue; }
          const m = arr[1]; if (!m || typeof m !== 'object') continue;
          const topic = m.topic || arr[0];
          if (topic === 'milldata' && m.payload) { out.milldata = m.payload; out.lastAt = Date.now(); }
          if (STATUS_MAP[topic]) out.status[STATUS_MAP[topic]] = { on: !!m.payload, topic: topic, at: Date.now() };
        }
      }
    } catch (e) {
      out.error = e.message;
    }
    out.ok = !!out.milldata;
    resolve();
  });
}

collect(DUR).then(() => {
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('[collect] ok=' + out.ok + ' connected=' + out.connected +
    ' milldata=' + (out.milldata ? 'yes' : 'no') + ' status=' + Object.keys(out.status).join(',') +
    (out.error ? ' error=' + out.error : ''));
  process.exit(out.ok ? 0 : 1);
});
