// Simulação da prova. "Um carro": o mapa segue o carro e a tulipa do ponto atual fica visível.
// "Todos os inscritos": cada carro sai no seu horário de largada, na média da sua categoria, e o app aponta os encontros
// (alcance, cruzamento do percurso com ele mesmo, frente a frente) para analisar o risco da prova.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import MapaWeb from './MapaWeb';
import { Entrada } from './Tulipa';
import { grupoIdx } from './rally';
import { fmtHMS, parseHMS } from './OrgExtras';

const R = 6371000;
const dist = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
const hms = (s) => { const p = (x) => String(x).padStart(2, '0'); s = Math.max(0, Math.round(s)); return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; };
const MULTS = [1, 2, 5, 10, 20, 50];
const MULTS_T = [1, 5, 10, 30, 60, 120];

// Linha do percurso com distâncias acumuladas; at(s) devolve posição e rumo na distância s (m) da prova.
function useLinha(coords, totalM) {
  return useMemo(() => {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]));
    const fim = cum[cum.length - 1] || 1;
    const la0 = coords[0] ? coords[0][0] : 0, kx = Math.cos((la0 * Math.PI) / 180) * 111320, ky = 110540;
    const at = (s) => {
      const alvo = Math.min(1, Math.max(0, s / Math.max(1, totalM))) * fim;
      let lo = 1, hi = cum.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < alvo) lo = m + 1; else hi = m; }
      const i = Math.max(1, lo), seg = cum[i] - cum[i - 1] || 1, f = Math.min(1, Math.max(0, (alvo - cum[i - 1]) / seg));
      const a = coords[i - 1], b = coords[i];
      const lat = a[0] + (b[0] - a[0]) * f, lon = a[1] + (b[1] - a[1]) * f;
      return { lat, lon, x: (lon - (coords[0][1])) * kx, y: (lat - la0) * ky, hd: (Math.atan2((b[1] - a[1]) * kx, (b[0] - a[0]) * ky) * 180) / Math.PI };
    };
    return { at };
  }, [coords, totalM]);
}

function Lay({ wide, mapa, painel }) {
  if (wide) return <View style={{ flex: 1, flexDirection: 'row' }}><View style={{ flex: 1, padding: 8 }}>{mapa}</View><View style={{ width: 470 }}>{painel}</View></View>;
  return <View style={{ flex: 1 }}><View style={{ paddingHorizontal: 10 }}>{mapa}</View>{painel}</View>;
}

// ---------- Um carro ----------
function SimUm({ st, coords, tul, trs, totalM, grupos, cats, wide, mapH }) {
  const [s, setS] = useState(0);
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [mi, setMi] = useState(2);
  const [classe, setClasse] = useState(cats[0] || '');
  const [org, setOrg] = useState(false);
  const scroll = useRef(null);
  const ys = useRef({});
  const linha = useLinha(coords, totalM);
  const gi = classe ? grupoIdx(classe, grupos) : 0;
  const lista = useMemo(() => (org ? tul : tul.filter((e) => e.t !== 'P' || e.nt > 0)), [tul, org]);

  const velEm = (d) => {
    for (let i = trs.length - 1; i >= 0; i--) {
      if (d >= (trs[i].d0 || 0)) {
        const tr = trs[i];
        const fim = i + 1 < trs.length ? trs[i + 1].d0 : totalM;
        if (tr.t === 'D') return Math.max(5, ((fim - tr.d0) / 1000) / Math.max(0.1, tr.min / 60));
        return Math.max(5, tr.v[gi] ?? tr.v[0] ?? 30);
      }
    }
    return 30;
  };
  const vRef = useRef(velEm); vRef.current = velEm;
  const trechoN = (() => { for (let i = trs.length - 1; i >= 0; i--) if (s >= (trs[i].d0 || 0)) return i + 1; return 1; })();
  const v = velEm(s);

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => {
      setS((p) => { const n = p + (vRef.current(p) / 3.6) * MULTS[mi] * 0.25; if (n >= totalM) { setPlay(false); return totalM; } return n; });
      setT((x) => x + 0.25 * MULTS[mi]);
    }, 250);
    return () => clearInterval(id);
  }, [play, mi, totalM]);

  const p = linha.at(s);
  const me = [p.lat, p.lon];
  const atual = Math.max(0, lista.findIndex((e) => e.d >= s - 15));
  useEffect(() => { const y = ys.current[atual]; if (y != null && scroll.current) scroll.current.scrollTo({ y: Math.max(0, y - 6), animated: true }); }, [atual, org]);
  const ir = (e) => setS(Math.max(0, e.d - 60));
  const passo = (k) => { const j = Math.max(0, Math.min(lista.length - 1, atual + k)); if (lista[j]) setS(Math.max(0, lista[j].d - 60)); };
  const chip = (on) => [st.chip, { paddingHorizontal: 12, paddingVertical: 6 }, on && { backgroundColor: '#ff7a2e' }];

  const mapa = <MapaWeb coords={coords} wps={[]} me={me} follow height={mapH} />;
  const painel = (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 12 }}>
        <View style={st.line}>
          <Text style={st.v}>{(s / 1000).toFixed(3).replace('.', ',')} km · trecho {trechoN} · {Math.round(v)} km/h</Text>
          <Text style={st.tipTx}>{MULTS[mi]}x · {hms(t)}</Text>
        </View>
        <View style={[st.row, { marginTop: 6 }]}>
          <TouchableOpacity style={[st.btn2, { flex: 2, backgroundColor: play ? '#c0392b' : '#2e7d32' }]} onPress={() => { if (s >= totalM) { setS(0); setT(0); } setPlay(!play); }}><Text style={[st.btn2Tx, { color: '#fff' }]}>{play ? '⏸ Pausar' : '▶ Simular'}</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => setMi(Math.max(0, mi - 1))}><Text style={st.btn2Tx}>−</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => setMi(Math.min(MULTS.length - 1, mi + 1))}><Text style={st.btn2Tx}>+ rápido</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => { setPlay(false); setS(0); setT(0); }}><Text style={st.btn2Tx}>↺</Text></TouchableOpacity>
        </View>
        <View style={[st.row, { marginTop: 6, flexWrap: 'wrap' }]}>
          <TouchableOpacity style={st.btn2} onPress={() => passo(-1)}><Text style={st.btn2Tx}>▲ tulipa anterior</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => passo(1)}><Text style={st.btn2Tx}>▼ próxima</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {cats.map((c) => <TouchableOpacity key={c} style={chip(classe === c)} onPress={() => setClasse(c)}><Text style={[st.btn2Tx, classe === c && { color: '#0c1014' }]}>{c}</Text></TouchableOpacity>)}
          <TouchableOpacity style={chip(org)} onPress={() => setOrg(!org)}><Text style={[st.btn2Tx, org && { color: '#0c1014' }]}>{org ? 'Visão: organizador' : 'Visão: competidor'}</Text></TouchableOpacity>
        </View>
      </View>
      <ScrollView ref={scroll} style={{ flex: 1, marginTop: 8, paddingHorizontal: 10 }}>
        {lista.map((e, i) => (
          <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => ir(e)} onLayout={(ev) => { ys.current[i] = ev.nativeEvent.layout.y; }}>
            <Entrada e={e} st={st} org={org} classe={classe} grupos={grupos} destaque={i === atual} faltam={i === atual ? e.d - s : null} />
          </TouchableOpacity>
        ))}
        <View style={{ height: 200 }} />
      </ScrollView>
    </View>
  );
  return <Lay wide={wide} mapa={mapa} painel={painel} />;
}

// ---------- Todos os inscritos ----------
const TIPOS = { alcance: 'alcance (mesmo sentido)', cruzamento: 'cruzamento', frente: 'frente a frente' };
const COR = { alcance: '#ffb300', cruzamento: '#ff5252', frente: '#ff1744' };
function SimTodos({ st, coords, trechos, totalM, grupos, inscritos, wide, mapH }) {
  const linha = useLinha(coords, totalM);
  const [T, setT] = useState(null);
  const [play, setPlay] = useState(false);
  const [mi, setMi] = useState(3);
  const [raio, setRaio] = useState(25);
  const [evs, setEvs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [sel, setSel] = useState(null);

  // perfil de tempo ideal por grupo de média: instante (s depois da largada) em que o carro está em cada trecho
  const perfis = useMemo(() => grupos.map((_, g) => {
    let d = 0, t = 0; const segs = [];
    trechos.forEach((tr) => {
      const len = (tr.km || 0) * 1000;
      const mov = tr.t === 'D' ? (tr.min || 0) * 60 : len / 1000 / Math.max(1, tr.v[g] ?? tr.v[0] ?? 30) * 3600;
      segs.push({ d0: d, d1: d + len, t0: t, t1: t + mov, t2: t + mov + (tr.nt || 0) });
      d += len; t += mov + (tr.nt || 0);
    });
    return { segs, dur: t, total: d };
  }), [trechos, grupos]);
  const distEm = (pf, tr) => {
    if (tr <= 0) return 0;
    const sg = pf.segs;
    let lo = 0, hi = sg.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sg[m].t2 <= tr) lo = m + 1; else hi = m; }
    const x = sg[lo];
    if (!x) return pf.total;
    if (tr >= x.t1) return x.d1;
    return x.d0 + ((x.d1 - x.d0) * (tr - x.t0)) / Math.max(1e-6, x.t1 - x.t0);
  };
  const carros = useMemo(() => inscritos.map((i) => ({ numero: i.numero, nome: i.piloto, classe: i.classe, t0: parseHMS(i.largada), gi: grupoIdx(i.classe, grupos) })).filter((c) => c.t0 != null && perfis[c.gi]).sort((a, b) => a.t0 - b.t0), [inscritos, grupos, perfis]);
  const T0 = carros.length ? carros[0].t0 - 30 : 0;
  const T1 = carros.length ? Math.max(...carros.map((c) => c.t0 + perfis[c.gi].dur)) + 30 : 0;
  useEffect(() => { setT(T0); setEvs(null); setSel(null); }, [carros.length, T0]);
  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setT((x) => { const n = (x ?? T0) + 0.25 * MULTS_T[mi]; if (n >= T1) { setPlay(false); return T1; } return n; }), 250);
    return () => clearInterval(id);
  }, [play, mi, T0, T1]);

  const analisar = () => {
    setBusy(true); setSel(null);
    setTimeout(() => {
      const abertos = new Map(), lista = [], R2 = raio * raio;
      for (let tt = T0; tt <= T1; tt += 2) {
        const act = [];
        for (const c of carros) { const tr = tt - c.t0, pf = perfis[c.gi]; if (tr <= 0 || tr >= pf.dur) continue; const s = distEm(pf, tr); act.push({ c, s, ...linha.at(s) }); }
        for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
          const a = act[i], b = act[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > R2) continue;
          const key = a.c.numero + '|' + b.c.numero, d = Math.sqrt(d2);
          let ev = abertos.get(key);
          if (!ev) {
            let dh = Math.abs(a.hd - b.hd) % 360; if (dh > 180) dh = 360 - dh;
            ev = { a: a.c, b: b.c, t0: tt, t1: tt, dmin: d, lat: a.lat, lon: a.lon, sA: a.s, sB: b.s, ty: dh < 45 ? 'alcance' : dh > 135 ? 'frente' : 'cruzamento' };
            abertos.set(key, ev); lista.push(ev);
          }
          ev.t1 = tt; ev.last = tt;
          if (d < ev.dmin) { ev.dmin = d; ev.lat = a.lat; ev.lon = a.lon; ev.sA = a.s; ev.sB = b.s; }
        }
        for (const [k, ev] of abertos) if (tt - (ev.last ?? ev.t0) > 20) abertos.delete(k);
      }
      lista.sort((x, y) => x.t0 - y.t0);
      setEvs(lista); setBusy(false);
    }, 30);
  };

  const Tn = T ?? T0;
  const ativos = new Set();
  if (evs) evs.forEach((e) => { if (Tn >= e.t0 - 2 && Tn <= e.t1 + 2) { ativos.add(e.a.numero); ativos.add(e.b.numero); } });
  const marks = [];
  carros.forEach((c) => {
    const tr = Tn - c.t0, pf = perfis[c.gi];
    if (tr <= 0 || tr >= pf.dur + 20) return;
    const p = linha.at(distEm(pf, tr));
    marks.push({ lat: p.lat, lon: p.lon, txt: c.numero, cls: ativos.has(c.numero) ? 'r' : 'k' });
  });
  const me = sel ? [sel.lat, sel.lon] : null;
  const vis = (evs || []).filter((e) => filtro === 'todos' || e.ty === filtro);
  const chip = (on) => [st.chip, { paddingHorizontal: 10, paddingVertical: 5 }, on && { backgroundColor: '#ff7a2e' }];
  const n = (ty) => (evs || []).filter((e) => e.ty === ty).length;

  const mapa = <MapaWeb coords={coords} wps={[coords[0], coords[coords.length - 1]]} marks={marks} me={me} follow={!!sel} height={mapH} />;
  const painel = (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 12 }}>
        {carros.length === 0 ? (
          <Text style={[st.tipTx, { color: '#ffb300' }]}>Nenhum inscrito com horário de largada. Defina as largadas na aba Inscrições (sorteio ou horário de cada um).</Text>
        ) : (
          <>
            <View style={st.line}>
              <Text style={st.v}>{fmtHMS(Math.round(Tn))}</Text>
              <Text style={st.tipTx}>{carros.length} carros · {MULTS_T[mi]}x</Text>
            </View>
            <View style={[st.row, { marginTop: 6 }]}>
              <TouchableOpacity style={[st.btn2, { flex: 2, backgroundColor: play ? '#c0392b' : '#2e7d32' }]} onPress={() => { if (Tn >= T1) setT(T0); setSel(null); setPlay(!play); }}><Text style={[st.btn2Tx, { color: '#fff' }]}>{play ? '⏸ Pausar' : '▶ Simular todos'}</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => setMi(Math.max(0, mi - 1))}><Text style={st.btn2Tx}>−</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => setMi(Math.min(MULTS_T.length - 1, mi + 1))}><Text style={st.btn2Tx}>+ rápido</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => { setPlay(false); setT(T0); setSel(null); }}><Text style={st.btn2Tx}>↺</Text></TouchableOpacity>
            </View>
            <Text style={[st.tip, { marginTop: 10 }]}>Análise de encontros</Text>
            <Text style={st.tipTx}>Aponta quando dois carros ficam a menos de {raio} m um do outro, seguindo o horário de largada e a média ideal de cada categoria.</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
              {[15, 25, 40].map((r) => <TouchableOpacity key={r} style={chip(raio === r)} onPress={() => { setRaio(r); setEvs(null); }}><Text style={[st.btn2Tx, raio === r && { color: '#0c1014' }]}>{r} m</Text></TouchableOpacity>)}
              <TouchableOpacity style={[st.btn2, { flex: 1 }]} onPress={analisar} disabled={busy}><Text style={st.btn2Tx}>{busy ? 'Analisando…' : evs ? 'Analisar de novo' : 'Analisar riscos'}</Text></TouchableOpacity>
            </View>
            {evs && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {[['todos', `Todos ${evs.length}`], ['cruzamento', `Cruzamento ${n('cruzamento')}`], ['alcance', `Alcance ${n('alcance')}`], ['frente', `Frente a frente ${n('frente')}`]].map(([k, t]) => (
                  <TouchableOpacity key={k} style={chip(filtro === k)} onPress={() => setFiltro(k)}><Text style={[st.btn2Tx, filtro === k && { color: '#0c1014' }]}>{t}</Text></TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 10 }}>
        {evs && vis.length === 0 && <View style={st.card}><Text style={[st.tipTx, { color: '#4caf50' }]}>Nenhum encontro a menos de {raio} m com essas largadas.</Text></View>}
        {vis.slice(0, 150).map((e, i) => (
          <TouchableOpacity key={i} activeOpacity={0.8} style={[st.card, { marginBottom: 6, borderLeftWidth: 5, borderLeftColor: COR[e.ty] }, sel === e && { backgroundColor: '#2a3340' }]} onPress={() => { setPlay(false); setSel(e); setT(Math.max(T0, e.t0 - 6)); }}>
            <Text style={st.v}>{fmtHMS(Math.round(e.t0))} · #{e.a.numero} × #{e.b.numero}</Text>
            <Text style={{ color: COR[e.ty], fontWeight: '800' }}>{TIPOS[e.ty]} · mín {Math.round(e.dmin)} m</Text>
            <Text style={st.tipTx}>{e.a.nome} ({e.a.classe}) km {(e.sA / 1000).toFixed(2).replace('.', ',')} · {e.b.nome} ({e.b.classe}) km {(e.sB / 1000).toFixed(2).replace('.', ',')}{e.t1 > e.t0 ? ` · juntos ${Math.round(e.t1 - e.t0)} s` : ''}</Text>
          </TouchableOpacity>
        ))}
        {vis.length > 150 && <Text style={st.tipTx}>Mostrando 150 de {vis.length}. Use os filtros.</Text>}
        <View style={{ height: 200 }} />
      </ScrollView>
    </View>
  );
  return <Lay wide={wide} mapa={mapa} painel={painel} />;
}

export default function Simulacao({ st, visible, onClose, coords, tul, trs, trechos, totalM, grupos, cats, inscritos = [] }) {
  const { width, height } = useWindowDimensions();
  const [modo, setModo] = useState('um');
  const wide = Platform.OS === 'web' && width >= 900;
  const mapH = wide ? Math.max(300, height - 100) : Math.max(200, Math.round(height * 0.36));
  const chip = (on) => [st.chip, { paddingHorizontal: 12, paddingVertical: 6 }, on && { backgroundColor: '#ff7a2e' }];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0c1014', paddingTop: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
          <TouchableOpacity onPress={onClose} style={{ paddingRight: 8 }}><Text style={{ color: '#4fc3f7', fontSize: 26, fontWeight: '800' }}>←</Text></TouchableOpacity>
          <Text style={[st.tip, { marginBottom: 0, marginRight: 8 }]}>Simular a prova</Text>
          <TouchableOpacity style={chip(modo === 'um')} onPress={() => setModo('um')}><Text style={[st.btn2Tx, modo === 'um' && { color: '#0c1014' }]}>Um carro</Text></TouchableOpacity>
          <TouchableOpacity style={chip(modo === 'todos')} onPress={() => setModo('todos')}><Text style={[st.btn2Tx, modo === 'todos' && { color: '#0c1014' }]}>Todos os inscritos</Text></TouchableOpacity>
        </View>
        {visible && (modo === 'um'
          ? <SimUm st={st} coords={coords} tul={tul} trs={trs} totalM={totalM} grupos={grupos} cats={cats} wide={wide} mapH={mapH} />
          : <SimTodos st={st} coords={coords} trechos={trechos} totalM={totalM} grupos={grupos} inscritos={inscritos} wide={wide} mapH={mapH} />)}
      </View>
    </Modal>
  );
}
