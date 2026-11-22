// Levantamento da prova dirigindo: o rastro do GPS vira o percurso, o organizador marca tulipas (com observação e foto)
// e, ao chegar, edita cada tulipa com calma (desenho do cruzamento, nome, neutro) antes de aplicar à planilha.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, Text, Vibration, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Tela from './Tela';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import MapaWeb from './MapaWeb';
import { Tulipa } from './Tulipa';
import { DesenhoSvg } from './Desenho';
import EditorDesenho from './EditorDesenho';
import { loadJson, saveJson } from './persist';
import { salvarProva } from './firebase';
import { cumulative } from './rally';
import { getState, passoGps } from './store';
import { calcularRota } from './osrm';

const WEB = Platform.OS === 'web'; // no computador: sem GPS; o percurso vem do mapa ou da nuvem e as marcas são editadas à mão
import { detectarCruzamento, dist, linhaPc, rumo, satUrl } from './osm';

const km2 = (m) => (m / 1000).toFixed(3).replace('.', ',');
const CORES = ['#ff7a2e', '#ffe600', '#00e5ff', '#ff1744', '#76ff03'];
const KIND = { L: 'Largada', T: 'Referência', S: 'Trecho', P: 'PC', N: 'Neutro', C: 'Chegada', R: 'REF' };
const COR = { L: '#4caf50', T: '#ff7a2e', S: '#7b1fa2', P: '#ff5a1f', N: '#ff5252', C: '#c0392b', R: '#ffe600' };
const PRESETS = [
  ['Em T', [90, 270]], ['Cruzamento', [0, 90, 270]], ['Y', [45, 315]], ['Só reta', [0]],
];
// Entrada de tulipa (formato do roadbook) a partir da marca editada. A rua de chegada aponta sempre para baixo (180°).
export function entradaDe(m, p) {
  const arms = [...(m.arms || [])].sort((a, b) => a - b);
  const b = [180, ...arms];
  const o = m.out != null && arms.includes(m.out) ? b.indexOf(m.out) : -1;
  const e = { t: 'T', d: m.km, p, ty: m.rot ? 'roundabout' : 'turn', mo: '', b, i: 0, o, ex: m.rot ? m.ex || 1 : 0, nm: m.nm || '', man: true };
  if (m.dw && m.dw.length) e.dw = m.dw;
  return e;
}

function B({ cor, tx, on, fg }) {
  return (
    <TouchableOpacity style={{ flex: 1, minHeight: 66, backgroundColor: cor, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }} onPressIn={on} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} activeOpacity={0.6}>
      <Text style={{ color: fg || '#000', fontWeight: '900', fontSize: 15, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{tx}</Text>
    </TouchableOpacity>
  );
}
function ChipT({ st, on, tx, onPress, cor }) {
  return (
    <TouchableOpacity style={[st.chip, { paddingHorizontal: 10, paddingVertical: 6 }, on && { backgroundColor: cor || '#ff7a2e' }]} onPress={onPress}>
      <Text style={[st.btn2Tx, on && { color: '#0c1014' }]}>{tx}</Text>
    </TouchableOpacity>
  );
}

function EditorTulipa({ st, m, onChange, onDesenhar, onDetectar }) {
  const arms = m.arms || [];
  const toggle = (a) => {
    const has = arms.includes(a);
    onChange({ arms: has ? arms.filter((x) => x !== a) : [...arms, a], out: has && m.out === a ? null : m.out });
  };
  const ANG = [[315, '↖'], [0, '↑'], [45, '↗'], [270, '←'], [90, '→'], [225, '↙'], [135, '↘']];
  const e = entradaDe(m, 0);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {m.dw && m.dw.length ? <DesenhoSvg items={m.dw} size={110} /> : <Tulipa e={e} size={110} />}
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={[st.btn, { marginBottom: 6, paddingVertical: 10, backgroundColor: '#1565c0' }]} onPress={onDetectar}><Text style={[st.btnTx, { color: '#fff' }]}>Detectar cruzamento (mapa)</Text></TouchableOpacity>
          <Text style={st.tipTx}>1) Toque as ruas que existem no cruzamento (você chega por baixo).</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {ANG.map(([a, t]) => <ChipT st={st} key={a} on={arms.includes(a)} tx={t} onPress={() => toggle(a)} />)}
          </View>
        </View>
      </View>
      <View style={[st.row, { marginTop: 8, marginBottom: 0 }]}>
        <TouchableOpacity style={[st.btn, { flex: 1, marginBottom: 0, paddingVertical: 12 }]} onPress={onDesenhar}><Text style={st.btnTx}>{m.dw && m.dw.length ? 'Editar desenho' : 'Desenhar a tulipa'}</Text></TouchableOpacity>
        {m.dw && m.dw.length ? <TouchableOpacity style={st.btn2} onPress={() => onChange({ dw: null })}><Text style={st.btn2Tx}>Usar automática</Text></TouchableOpacity> : null}
      </View>
      <Text style={st.tipTx}>Atalhos (desenho automático pelas ruas)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map(([n, a]) => <ChipT st={st} key={n} on={false} tx={n} onPress={() => onChange({ arms: a, out: a.includes(m.out) ? m.out : null })} />)}
      </View>
      <Text style={st.tipTx}>2) Por qual rua você sai (seta)?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[...arms].sort((a, b) => a - b).map((a) => <ChipT st={st} key={a} cor="#4caf50" on={m.out === a} tx={ANG.find((x) => x[0] === a)?.[1] || a} onPress={() => onChange({ out: a })} />)}
        {arms.length === 0 && <Text style={st.tipTx}>Marque ao menos uma rua.</Text>}
      </View>
      <View style={[st.row, { marginTop: 8, marginBottom: 0 }]}>
        <ChipT st={st} on={!!m.rot} tx="Rotatória" onPress={() => onChange({ rot: !m.rot })} />
        {m.rot ? <TextInput style={[st.input, { minWidth: 50 }]} value={String(m.ex || 1)} onChangeText={(v) => onChange({ ex: parseInt(v, 10) || 1 })} keyboardType="number-pad" /> : null}
        {m.rot ? <Text style={st.tipTx}>saída nº</Text> : null}
      </View>
      <TextInput style={st.field} value={m.nm || ''} onChangeText={(v) => onChange({ nm: v })} placeholder="Observação para o competidor (ex.: carros vindo, atenção)" placeholderTextColor="#666" />
    </View>
  );
}

const slugProva = (p) => String(p).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');

export default function Levantamento({ st, prova, last, onAplicar, onProva, levNuvem, trailNuvem }) {
  const slug0 = String(prova).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const chave = 'lev_' + slug0;
  const chaveW = 'levw_' + slug0;
  const [trailW, setTrailW] = useState(() => (WEB && levNuvem ? trailNuvem || [] : []));
  const [wpsNovo, setWpsNovo] = useState([]);
  const [busyW, setBusyW] = useState('');
  const [lev, setLevRaw] = useState(() => {
    if (WEB) {
      const sv = loadJson(chaveW, null);
      if (sv && sv.lev && sv.base === ((levNuvem && levNuvem.em) || 0)) return sv.lev;
      return levNuvem ? { iniT: 0, marks: levNuvem.marks || [], trechos: levNuvem.trechos || [], em: levNuvem.em || 0 } : { iniT: null, marks: [], trechos: [] };
    }
    const loc = loadJson(chave, { iniT: null, marks: [] });
    // Levantamento editado no computador (mais novo): o celular adota, mantendo as fotos que só existem aqui.
    if (levNuvem && loc.iniT != null && (loc.marks || []).length && (levNuvem.em || 0) > (loc.em || 0)) {
      return { ...loc, em: levNuvem.em, trechos: levNuvem.trechos || loc.trechos, marks: (levNuvem.marks || []).map((m) => ({ ...m, foto: ((loc.marks || []).find((x) => x.id === m.id) || {}).foto || null })) };
    }
    return loc;
  });
  const [aberta, setAberta] = useState(null);
  const [tela, setTela] = useState(true);
  const [menuMapa, setMenuMapa] = useState(false);
  const [trAsk, setTrAsk] = useState(null);
  const { height: winH } = useWindowDimensions();
  const listaRef = useRef(null);
  const ultimoToque = useRef(0);
  const [seguir, setSeguir] = useState(true);
  const [ctr, setCtr] = useState(0);
  const [rw, setRw] = useState(5);
  const [dash, setDash] = useState(false);
  const [rc, setRc] = useState('#ff7a2e');
  const [editorId, setEditorId] = useState(null);
  const [cand, setCand] = useState(null);
  const pontosW = useMemo(() => (WEB ? trailW.map((c, i) => ({ lat: c[0], lon: c[1], t: i * 1000, acc: 0 })) : null), [trailW]);
  const getPts = () => (WEB ? pontosW : getState().points);
  // Distância acumulada e índice da largada calculados de forma incremental: com dezenas de milhares de pontos de GPS,
  // refazer isso a cada leitura travava a tela e o toque nos botões se perdia.
  const cacheR = useRef({ first: null, n: 0, cum: [], dist: 0, last: null });
  const iniR = useRef({ t: null, i: -1 });
  const cumCache = (pts) => {
    const c = cacheR.current;
    if (c.first !== pts[0] || pts.length < c.n) { c.first = pts[0]; c.n = 0; c.cum = []; c.dist = 0; c.last = null; }
    for (let i = c.n; i < pts.length; i++) {
      const p = pts[i];
      if (!(p.acc != null && p.acc > 25)) {
        if (c.last) { const st = passoGps(c.last, p); c.dist += st.d; if (st.mover) c.last = p; } else c.last = p;
      }
      c.cum[i] = c.dist;
    }
    c.n = pts.length;
    return c.cum;
  };
  const iniDe = (pts, t) => {
    if (t == null) return -1;
    const r = iniR.current;
    if (r.t === t && r.i >= 0 && pts[r.i] && pts[r.i].t >= t && (r.i === 0 || pts[r.i - 1].t < t)) return r.i;
    const i = Math.max(0, pts.findIndex((p) => p.t >= t));
    iniR.current = { t, i };
    return i;
  };
  // Rascunho do levantamento (marcas e rastro, sem fotos) vai para a nuvem sozinho, para o computador poder abrir e editar.
  const tSync = useRef(null);
  const sincronizar = (n, ja) => {
    if (WEB || !(n.marks || []).length) return;
    clearTimeout(tSync.current);
    const enviar = () => {
      const tr = trailRef.current || [];
      salvarProva(prova, { lev: { em: n.em || 0, marks: n.marks.map((m) => ({ ...m, foto: null })), trechos: n.trechos || [], trail: tr.flatMap((c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]) } }).catch(() => {});
    };
    if (ja) enviar(); else tSync.current = setTimeout(enviar, 2500);
  };
  // Levantamento que já existia no celular (feito antes desta versão): envia uma vez para a nuvem ao abrir a aba.
  useEffect(() => {
    if (WEB || !lev.marks.length) return;
    if (levNuvem && (levNuvem.em || 0) >= (lev.em || 0) && levNuvem.trail && levNuvem.trail.length) return;
    const t = setTimeout(() => sincronizar(lev, true), 1500);
    return () => clearTimeout(t);
  }, []);
  const setLev = (fn) => setLevRaw((o) => {
    const n0 = typeof fn === 'function' ? fn(o) : fn;
    const n = { ...n0, em: Date.now() };
    if (WEB) { saveJson(chaveW, { base: (levNuvem && levNuvem.em) || 0, lev: n }); return n; }
    saveJson(chave, n);
    sincronizar(n);
    try {
      const cod = String(prova).trim().toUpperCase();
      const old = loadJson('lev_index', []).find((x) => x.code === cod);
      const idx = loadJson('lev_index', []).filter((x) => x.code !== cod);
      const pts = getPts();
      const ini = iniDe(pts, n.iniT);
      const ult = (n.marks || []).length;
      const kmx = ini >= 0 && pts.length ? Math.max(0, cumCache(pts)[pts.length - 1] - cumCache(pts)[ini]) : (loadJson('lev_index', []).find((x) => x.code === cod)?.km || 0);
      if (n.nome || old || ult) saveJson('lev_index', [{ code: cod, nome: n.nome || old?.nome || '', marcas: ult, km: Math.round(kmx), ts: Date.now() }, ...idx]);
    } catch {}
    return n;
  });

  const points = getPts();
  const cum = cumCache(points);
  const iniIdx = iniDe(points, lev.iniT);
  const kmAqui = iniIdx >= 0 && points.length ? Math.max(0, cum[points.length - 1] - cum[iniIdx]) : 0;
  const fechado = lev.marks.some((m) => m.k === 'C');
  const kmScale = (() => { const c = lev.marks.find((m) => m.k === 'C'); const t = iniIdx >= 0 && points.length ? cum[points.length - 1] - cum[iniIdx] : 0; return WEB && c && t > 0 ? c.km / t : 1; })();
  const nTrechos = (o) => o.marks.filter((m) => m.k === 'S').length + 1;
  // trechos garantidos: um por intervalo entre largada, fins de trecho e chegada
  const trAtual = (o) => { const a = [...(o.trechos || [])]; while (a.length < nTrechos(o)) a.push({ ...(a[a.length - 1] || { t: 'V', v: '', min: '15' }) }); return a.slice(0, nTrechos(o)); };
  const setTr = (i, patch) => setLev((o) => { const a = trAtual(o); a[i] = { ...a[i], ...patch }; return { ...o, trechos: a }; });
  // Rastro percorrido (no máximo ~700 pontos para o mapa).
  const trailKey = points.length + '_' + iniIdx;
  const trailC = useRef({ k: null, v: [] });
  const trailCalc = () => {
    if (iniIdx < 0) return [];
    const seg = points.slice(iniIdx).filter((p) => !(p.acc != null && p.acc > 25));
    const step = Math.max(1, Math.ceil(seg.length / 700));
    return seg.filter((_, i) => i % step === 0 || i === seg.length - 1).map((p) => [p.lat, p.lon]);
  };
  const trail = (() => {
    if (trailC.current.k === trailKey) return trailC.current.v;
    const v = trailCalc();
    trailC.current = { k: trailKey, v };
    return v;
  })();
  const trailRef = useRef([]);
  trailRef.current = trail;

  const perguntaTrecho = (i) => Alert.alert(`Trecho ${i + 1}`, 'Definir a velocidade (média) ou o deslocamento deste trecho agora?', [{ text: 'Depois', style: 'cancel' }, { text: 'Agora', onPress: () => setTrAsk(i) }]);
  // lê sempre o ponto GPS mais recente na hora do toque (não o da última renderização)
  const pronto = () => {
    const pts = getPts();
    const l = pts[pts.length - 1];
    if (!l) { Alert.alert('Sem GPS', 'Ainda não chegou nenhuma posição. Espere o GPS ficar verde e toque de novo.'); return null; }
    if (Date.now() - l.t > 20000) { Alert.alert('GPS parado', 'A última posição tem mais de 20 s. Confira se o GPS está ligado e com sinal, e toque de novo.'); return null; }
    if (l.acc != null && l.acc > 50) { Alert.alert('Sinal fraco', `Precisão do GPS: ${Math.round(l.acc)} m. Espere melhorar e toque de novo.`); return null; }
    return l;
  };
  const marcar = (k, extra = {}) => {
    if (Date.now() - ultimoToque.current < 700) return;
    const l = pronto(); if (!l) return;
    ultimoToque.current = Date.now();
    const pts = getPts();
    const iniI = iniDe(pts, lev.iniT);
    const cumF = cumCache(pts);
    const kmAgora = iniI >= 0 && pts.length ? Math.max(0, cumF[pts.length - 1] - cumF[iniI]) : 0;
    Vibration.vibrate(60);
    if (k === 'L') {
      const novo = () => { setLev({ iniT: l.t, trechos: [{ t: 'V', v: '', min: '15' }], marks: [{ id: 1, k: 'L', lat: l.lat, lon: l.lon, hdg: l.hdg ?? null, km: 0, nota: '', foto: null }] }); perguntaTrecho(0); };
      if (!lev.marks.length) return novo();
      Alert.alert('Iniciar levantamento', 'Isso apaga o levantamento anterior desta prova. Continuar?', [
        { text: 'Cancelar' },
        { text: 'Iniciar', onPress: novo },
      ]);
      return;
    }
    if (iniI < 0) return Alert.alert('Marque a largada primeiro');
    const m = { id: Date.now(), k, lat: Math.round(l.lat * 1e6) / 1e6, lon: Math.round(l.lon * 1e6) / 1e6, hdg: l.hdg != null && l.hdg >= 0 ? Math.round(l.hdg) : null, km: Math.round(kmAgora), nota: '', foto: null, ...(k === 'N' ? { nt: 120 } : {}), ...extra };
    setLev((o) => ({ ...o, marks: [...o.marks, m], trechos: k === 'S' ? [...trAtual(o), { ...trAtual(o)[trAtual(o).length - 1] }] : o.trechos }));
    if (k === 'S') perguntaTrecho(nTrechos(lev));
  };
  const upd = (id, patch) => setLev((o) => ({ ...o, marks: o.marks.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const del = (id) => setLev((o) => {
    const alvo = o.marks.find((m) => m.id === id);
    let tr = o.trechos;
    if (alvo && alvo.k === 'S') {
      const idx = o.marks.filter((m) => m.k === 'S').findIndex((m) => m.id === id);
      tr = trAtual(o); tr.splice(idx + 1, 1);
    }
    return { ...o, marks: o.marks.filter((m) => m.id !== id), trechos: tr };
  });
  const foto = (id) => {
    Alert.alert('Foto da referência', 'De onde vem a foto?', [
      { text: 'Câmera', onPress: () => pegaFoto(id, true) },
      { text: 'Galeria', onPress: () => pegaFoto(id, false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
  const pegaFoto = async (id, cam) => {
    try {
      let r;
      if (cam) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Permissão', 'Permita o uso da câmera para fotografar a referência.');
        r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      } else {
        r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
      }
      if (r.canceled || !r.assets?.length) return;
      let uri = r.assets[0].uri;
      try { const dest = new File(Paths.document, `foto_${id}.jpg`); new File(uri).copy(dest); uri = dest.uri; } catch {}
      upd(id, { foto: uri });
    } catch (e) { Alert.alert('Não abriu a foto', String(e?.message || e)); }
  };
  const apagarFoto = (id) => {
    const m = lev.marks.find((x) => x.id === id);
    try { if (m?.foto && String(m.foto).includes('foto_')) new File(m.foto).delete(); } catch {}
    upd(id, { foto: null });
  };
  // rumo do trecho logo depois da marca (35 m à frente no rastro gravado), se o carro já passou dali
  const saidaRumo = (m) => {
    const pts = getPts();
    let bi = -1, bd = 1e9;
    pts.forEach((p, i) => { const d = dist([m.lat, m.lon], [p.lat, p.lon]); if (d < bd) { bd = d; bi = i; } });
    if (bi < 0 || bd > 30) return null;
    for (let j = bi + 1; j < pts.length; j++) if (dist([m.lat, m.lon], [pts[j].lat, pts[j].lon]) >= 35) return rumo([m.lat, m.lon], [pts[j].lat, pts[j].lon]);
    return null;
  };
  const detectar = async (m) => {
    try {
      const r = await detectarCruzamento(m, saidaRumo(m));
      upd(m.id, { arms: r.arms, out: r.out, rot: r.rot, ex: r.ex, dw: null });
      Alert.alert('Cruzamento detectado', `${r.arms.length + 1} ruas${r.rot ? ' (rotatória)' : ''}. ${r.out != null ? 'Saída marcada pelo seu rastro.' : 'Agora toque no passo 2 a rua por onde você sai.'} Confira com o satélite e ajuste se precisar.`);
    } catch (e) { Alert.alert('Não detectou', String(e?.message || e)); }
  };
  const fotoRapida = () => {
    const u = lev.marks[lev.marks.length - 1];
    if (!u) return Alert.alert('Marque a largada primeiro');
    foto(u.id);
  };

  const ordenadas = lev.marks;
  const comTulipa = (m) => m.k === 'T' || m.k === 'L' || m.k === 'C' || m.k === 'S' || m.k === 'N';
  const semArms = ordenadas.filter((m) => (m.k === 'T' || m.k === 'S') && !(m.dw && m.dw.length) && !(m.arms && m.arms.length && m.out != null));
  const aplicar = () => {
    if (!fechado) return Alert.alert('Falta a chegada', 'Toque em CHEGADA no fim do percurso.');
    const sem = trAtual(lev).map((t, i) => (t.t === 'V' && !(parseFloat(String(t.v).replace(',', '.')) > 0) ? i + 1 : 0)).filter(Boolean);
    if (sem.length) return Alert.alert('Trecho sem média', `Defina a média do(s) trecho(s) ${sem.join(', ')} ou marque como deslocamento.`);
    if (semArms.length) return Alert.alert('Tulipas sem desenho', `${semArms.length} tulipa(s) ainda sem ruas e saída. Elas ficam só com o texto. Continuar?`, [{ text: 'Voltar' }, { text: 'Aplicar assim', onPress: () => confirmar() }]);
    confirmar();
  };
  const temDesenho = (m) => (m.arms && m.arms.length) || (m.dw && m.dw.length);
  const confirmar = () => {
    let prev = 0, pcN = 0, pcNum = 0, refN = 0, trI = 0;
    const trsL = trAtual(lev);
    const trsOut = [{ ...trsL[0], d0: 0 }];
    const tul = [], wps = [], ntMap = new Map(), refs = [], pontosKm = [], pcl = [];
    const tulipaDe = (m, p) => (temDesenho(m) ? entradaDe(m, p) : { t: 'T', d: m.km, p, ty: 'turn', mo: '', b: [180], i: 0, o: -1, ex: 0, nm: m.nm || m.nota || '', man: true });
    ordenadas.forEach((m) => {
      if (m.k === 'R') { refs.push({ n: refs.length + 1, lat: m.lat, lon: m.lon, hdg: m.hdg, km: Math.round(m.km) / 1000 }); return; }
      const d = m.km, p = Math.max(0, d - prev);
      if (m.k === 'L') { refN++; tul.push({ t: 'L', d: 0, p: 0, man: true, rn: refN }); if (temDesenho(m)) tul.push({ ...entradaDe(m, 0), rn: refN, ptr: 0 }); }
      else if (m.k === 'T') { refN++; tul.push({ ...tulipaDe(m, p), rn: refN }); }
      else if (m.k === 'S') { refN++; trI++; trsOut.push({ ...trsL[trI], d0: d }); tul.push({ ...tulipaDe(m, p), rn: refN, ptr: trI }); }
      else if (m.k === 'P') { pcN++; pcNum++; tul.push({ t: 'P', n: pcN, pn: pcNum, d, p, man: true }); }
      else if (m.k === 'N') { pcN++; tul.push({ ...(temDesenho(m) ? entradaDe(m, p) : {}), t: 'P', n: pcN, d, p, man: true, neu: true }); }
      else if (m.k === 'C') { refN++; if (temDesenho(m)) tul.push({ ...entradaDe(m, p), rn: refN }); tul.push({ t: 'C', n: pcN + 1, d, p: temDesenho(m) ? 0 : p, man: true, rn: refN }); }
      if (m.k === 'L' || m.k === 'P' || m.k === 'N' || m.k === 'C') {
        wps.push([m.lat, m.lon]); pontosKm.push(d / 1000);
        pcl.push(...(m.k === 'P' || m.k === 'N' ? linhaPc(m) : [0, 0, 0, 0]));
        if (m.k === 'N') ntMap.set(wps.length - 2, Math.max(1, m.nt || 120));
      }
      if (comTulipa(m)) prev = d;
    });
    const legs = pontosKm.slice(1).map((k, i) => Math.round((k - pontosKm[i]) * 1000) / 1000);
    onAplicar({ wps, rota: { coords: trail, legs, tul }, nIdx: ntMap, refs, pcl, trs: trsOut, lev: { em: lev.em || Date.now(), marks: lev.marks.map((m) => ({ ...m, foto: null })), trechos: trAtual(lev), trail: trail.flatMap((c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]) } });
    Alert.alert('Aplicado', 'Percurso, tulipas e trechos foram para a aba Planilha. Ajuste as médias e publique.');
  };

  // Depois da chegada: toque no traçado para inserir tulipa, PC ou neutro (a numeração se refaz sozinha pela ordem no percurso).
  const candDe = (bi) => {
    const p = points[bi], a = points[Math.max(iniIdx, bi - 2)], b = points[Math.min(points.length - 1, bi + 2)];
    const fim = lev.marks.find((x) => x.k === 'C');
    return { i: bi, lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6, hdg: Math.round(rumo([a.lat, a.lon], [b.lat, b.lon])), km: Math.min(Math.round((cum[bi] - cum[iniIdx]) * kmScale), fim ? fim.km : 1e12) };
  };
  const tocaTrilha = (lat, lon) => {
    if (!fechado || iniIdx < 0) return;
    let bi = -1, bd = 1e9;
    for (let i = iniIdx; i < points.length; i++) {
      const p = points[i];
      if (p.acc != null && p.acc > 25) continue;
      const d = dist([lat, lon], [p.lat, p.lon]);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi < 0 || bd > 60) return Alert.alert('Longe do traçado', 'Toque mais perto da linha do percurso.');
    setCand(candDe(bi));
  };
  const nudge = (dir) => {
    if (!cand) return;
    let j = cand.i;
    const alvo = cum[j] + dir * 5;
    while (j + dir >= iniIdx && j + dir < points.length && (dir > 0 ? cum[j] < alvo : cum[j] > alvo)) j += dir;
    setCand(candDe(Math.max(iniIdx, Math.min(points.length - 1, j))));
  };
  const inserir = (k) => {
    if (!cand) return;
    const m = { id: Date.now(), k, lat: cand.lat, lon: cand.lon, hdg: cand.hdg, km: cand.km, nota: '', foto: null, ...(k === 'N' ? { nt: 120 } : {}) };
    const ord = (x) => (x.k === 'L' ? -1 : x.k === 'C' ? 1e12 : x.km);
    setLev((o) => {
      const marks = [...o.marks, m].sort((x, y) => ord(x) - ord(y));
      let tr = o.trechos;
      if (k === 'S') { const idx = marks.filter((x) => x.k === 'S').findIndex((x) => x.id === m.id); tr = trAtual(o); tr.splice(idx + 1, 0, { ...tr[idx] }); }
      return { ...o, marks, trechos: tr };
    });
    setCand(null);
    if (k === 'S') perguntaTrecho(lev.marks.filter((x) => x.k === 'S' && (x.km < m.km)).length + 1);
    else if (k === 'T' || k === 'P' || k === 'N') setAberta(m.id);
  };

  const addWp = (la, lo) => setWpsNovo((w) => [...w, [Math.round(la * 1e6) / 1e6, Math.round(lo * 1e6) / 1e6]]);
  const gerarPercurso = async () => {
    if (wpsNovo.length < 2) return Alert.alert('Faltam pontos', 'Toque no mapa: primeiro a largada, depois (se quiser) pontos para guiar o caminho e por fim a chegada.');
    setBusyW('Calculando o percurso pelas ruas…');
    try {
      const r = await calcularRota(wpsNovo);
      const total = Math.round(r.legs.reduce((a, b) => a + b, 0) * 1000);
      const c = r.coords;
      const L = { id: 1, k: 'L', lat: c[0][0], lon: c[0][1], hdg: Math.round(rumo(c[0], c[Math.min(3, c.length - 1)])), km: 0, nota: '', foto: null };
      const C = { id: 2, k: 'C', lat: c[c.length - 1][0], lon: c[c.length - 1][1], hdg: Math.round(rumo(c[Math.max(0, c.length - 4)], c[c.length - 1])), km: total, nota: '', foto: null };
      setTrailW(c);
      setLev({ iniT: 0, marks: [L, C], trechos: [{ t: 'V', v: '', min: '15' }] });
      setWpsNovo([]);
    } catch (e) { Alert.alert('Não calculou', String(e?.message || e)); }
    setBusyW('');
  };
  const novoPercurso = WEB && lev.marks.length === 0;
  const ult = ordenadas[ordenadas.length - 1];
  const nTul = (i) => ordenadas.slice(0, i + 1).filter(comTulipa).length;
  const nPc = (i) => ordenadas.slice(0, i + 1).filter((x) => x.k === 'P').length;
  const nTr = (i) => ordenadas.slice(0, i + 1).filter((x) => x.k === 'S').length;
  const rotulo = (m, i) => (m.k === 'T' ? 'Referência ' + nTul(i) : m.k === 'S' ? 'Trecho ' + (nTr(i) + 1) + ' · referência ' + nTul(i) : m.k === 'P' ? 'PC ' + nPc(i) : m.k === 'N' ? 'Neutro' : m.k === 'L' ? 'Largada · referência ' + nTul(i) : m.k === 'C' ? 'Chegada · referência ' + nTul(i) : KIND[m.k]);
  const pinosBase = ordenadas.map((m, i) => ({ lat: m.lat, lon: m.lon, txt: m.k === 'T' ? 'R' + nTul(i) : m.k === 'S' ? 'R' + nTul(i) + ' · T' + (nTr(i) + 1) : m.k === 'P' ? 'PC' + nPc(i) : m.k === 'N' ? 'N' : KIND[m.k], cls: m.k === 'L' ? 'l' : m.k === 'C' ? 'c' : m.k === 'S' ? 's' : '' }));
  const pinos = cand ? [...pinosBase, { lat: cand.lat, lon: cand.lon, txt: 'NOVO', cls: 'c' }] : pinosBase;
  const linhas = ordenadas.filter((m) => m.k === 'P' || m.k === 'N').map(linhaPc).concat(cand ? [linhaPc({ lat: cand.lat, lon: cand.lon, hdg: cand.hdg })] : []);
  const Sep = () => <View style={{ height: 2, backgroundColor: '#444', marginTop: 6 }} />;
  const trAskV = trAsk != null ? trAtual(lev)[trAsk] : null;
  const statusTxt = (iniIdx >= 0 ? `${km2(kmAqui)} km percorridos · ${ordenadas.filter((m) => m.k === 'T').length} referência(s) · trecho ${nTrechos(lev)} em andamento · ${ordenadas.filter((m) => m.k === 'N').length} neutro(s)` : 'Levantamento ainda não iniciado: ligue o GPS, espere ficar verde e toque LARGADA.') + (last?.acc != null ? ` · GPS ${last.acc.toFixed(0)} m` : '');

  return (
    <View>
      <View style={st.card}>
        <Text style={st.tip}>Levantamento do percurso</Text>
        <Text style={st.tipTx}>{statusTxt}</Text>
        <TouchableOpacity style={[st.btn, { marginBottom: 0 }]} onPress={() => setTela(true)}><Text style={st.btnTx}>Abrir levantamento</Text></TouchableOpacity>
      </View>
      <Tela visible={tela} onRequestClose={() => setTela(false)}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 8 }}>
            <Text style={{ flex: 1, color: '#f5f5f5', fontSize: 12 }} numberOfLines={2}>{statusTxt}</Text>
            <TouchableOpacity style={st.btn2} onPress={() => { setCtr((c) => c + 1); setSeguir(true); }}><Text style={st.btn2Tx}>◎</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setMenuMapa((v) => !v)}><Text style={st.btn2Tx}>⚙ Mapa</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setTela(false)}><Text style={st.btn2Tx}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 10 }}>
            <MapaWeb wps={novoPercurso ? wpsNovo : []} coords={trail} marks={pinos} lines={linhas} sat={!novoPercurso} editable={fechado || novoPercurso} onTap={novoPercurso ? addWp : tocaTrilha} follow={!WEB && seguir && !fechado} rw={rw} dash={dash} rc={rc} ctr={ctr} me={last ? [last.lat, last.lon] : null} height={Math.round(winH * (WEB ? 0.5 : 0.28))} />
          </View>
          {menuMapa && (
            <View style={[st.row, { paddingHorizontal: 10, marginBottom: 6, flexWrap: 'wrap' }]}>
              <TouchableOpacity style={st.btn2} onPress={() => setSeguir((v) => !v)}><Text style={st.btn2Tx}>{seguir ? 'Seguindo: SIM' : 'Seguindo: NÃO'}</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => setRw((w) => (w >= 10 ? 3 : w + 2))}><Text style={st.btn2Tx}>Espessura: {rw}</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => setDash((d) => !d)}><Text style={st.btn2Tx}>{dash ? 'Pontilhado' : 'Contínuo'}</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => setRc((c) => CORES[(CORES.indexOf(c) + 1) % CORES.length])}><Text style={[st.btn2Tx, { color: rc }]}>Cor</Text></TouchableOpacity>
            </View>
          )}
          <View style={{ paddingHorizontal: 10 }}>
            {novoPercurso && (
              <View style={st.card}>
                <Text style={st.tip}>Percurso pelo mapa</Text>
                <Text style={st.tipTx}>Toque no mapa: 1º a largada, depois (se quiser) pontos para guiar o caminho, e por fim a chegada. O app calcula o percurso pelas ruas. Depois você insere referências, trechos, PCs e neutros tocando no traçado.</Text>
                <View style={[st.row, { marginTop: 6, marginBottom: 0 }]}>
                  <TouchableOpacity style={st.btn2} onPress={() => setWpsNovo((w) => w.slice(0, -1))}><Text style={st.btn2Tx}>Desfazer ponto</Text></TouchableOpacity>
                  <TouchableOpacity style={st.btn2} onPress={() => setWpsNovo([])}><Text style={st.btn2Tx}>Limpar</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={[st.btn, { marginTop: 8, marginBottom: 0 }]} onPress={gerarPercurso}><Text style={st.btnTx}>Gerar percurso ({wpsNovo.length} pontos)</Text></TouchableOpacity>
                {busyW ? <Text style={st.tipTx}>{busyW}</Text> : null}
              </View>
            )}
            {!fechado && !WEB && (
              <>
              <View style={[st.row, { marginBottom: 6 }]}>
                {lev.marks.length === 0 ? <B cor="#4caf50" tx="LARGADA" on={() => marcar('L')} /> : (
                  <>
                    <B cor="#ff7a2e" tx="REFERÊNCIA" on={() => marcar('T')} />
                    <B cor="#7b1fa2" fg="#fff" tx="TRECHO" on={() => marcar('S')} />
                  </>
                )}
              </View>
              {lev.marks.length > 0 && (
                <View style={[st.row, { marginBottom: 6 }]}>
                  <B cor="#ff5a1f" tx="PC" on={() => marcar('P')} />
                  <B cor="#c0392b" fg="#fff" tx="NEUTRO" on={() => marcar('N')} />
                </View>
              )}
              </>
            )}
            {lev.marks.length > 0 && !fechado && !WEB && (
              <View style={[st.row, { marginBottom: 6 }]}>
                <B cor="#1565c0" fg="#fff" tx="FOTO" on={fotoRapida} />
                <B cor="#c0392b" fg="#fff" tx="CHEGADA" on={() => marcar('C')} />
              </View>
            )}
            {fechado && !cand && <Text style={st.tipTx}>Toque no traçado do mapa, no ponto certo, para incluir referência, trecho, PC ou neutro.</Text>}
{cand && (
          <View style={st.card}>
            <Text style={st.tip}>Novo ponto · km {km2(cand.km)}</Text>
            <View style={[st.row, { marginTop: 6, marginBottom: 6, alignItems: 'center' }]}>
              <TouchableOpacity style={st.btn2} onPress={() => nudge(-1)}><Text style={st.btn2Tx}>◀ 5 m</Text></TouchableOpacity>
              <Text style={[st.tipTx, { flex: 1, textAlign: 'center' }]}>ajustar ao longo do traçado</Text>
              <TouchableOpacity style={st.btn2} onPress={() => nudge(1)}><Text style={st.btn2Tx}>5 m ▶</Text></TouchableOpacity>
            </View>
            <Text style={st.tipTx}>O que é este ponto?</Text>
            <View style={[st.row, { marginTop: 4, marginBottom: 6 }]}>
              <B cor="#ff7a2e" tx="REFERÊNCIA" on={() => inserir('T')} />
              <B cor="#7b1fa2" fg="#fff" tx="TRECHO" on={() => inserir('S')} />
            </View>
            <View style={[st.row, { marginBottom: 6 }]}>
              <B cor="#ff5a1f" tx="PC" on={() => inserir('P')} />
              <B cor="#c0392b" fg="#fff" tx="NEUTRO" on={() => inserir('N')} />
            </View>
            <TouchableOpacity style={st.btn2} onPress={() => setCand(null)}><Text style={st.btn2Tx}>Cancelar</Text></TouchableOpacity>
          </View>
        )}
            </View>
          <ScrollView ref={listaRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (!fechado) listaRef.current && listaRef.current.scrollToEnd({ animated: true }); }}>
            {fechado && !WEB && (
              <TouchableOpacity style={[st.btn2, { marginBottom: 8 }]} onPress={() => del(ult.id)}><Text style={st.btn2Tx}>Reabrir (desfazer chegada)</Text></TouchableOpacity>
            )}
      {fechado && lev.marks.length > 0 && (() => {
        const trs = trAtual(lev);
        const bnd = ordenadas.filter((m) => m.k === 'L' || m.k === 'S' || m.k === 'C');
        return (
          <View style={st.card}>
            <Text style={st.tip}>Trechos (toque para alterar)</Text>
            {trs.map((t, i) => {
              const ini = bnd[i], fim = bnd[i + 1];
              const kmT = ini ? (fim ? fim.km : kmAqui) - ini.km : 0;
              const atual = !fechado && i === trs.length - 1;
              return (
                <View key={i} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: '#262b32', paddingVertical: 6 }}>
                  <Text style={[st.v, atual && { color: '#ff7a2e' }]}>Trecho {i + 1}{atual ? ' · em andamento' : ''} · {km2(Math.max(0, kmT))} km</Text>
                  <View style={[st.row, { marginVertical: 4, alignItems: 'center' }]}>
                    <TouchableOpacity style={[st.btn2, t.t === 'V' && { backgroundColor: '#ff7a2e' }]} onPress={() => setTr(i, { t: 'V' })}><Text style={[st.btn2Tx, t.t === 'V' && { color: '#0c1014' }]}>Média</Text></TouchableOpacity>
                    <TouchableOpacity style={[st.btn2, t.t === 'D' && { backgroundColor: '#ff7a2e' }]} onPress={() => setTr(i, { t: 'D' })}><Text style={[st.btn2Tx, t.t === 'D' && { color: '#0c1014' }]}>Deslocamento</Text></TouchableOpacity>
                    {t.t === 'V' ? <TextInput style={[st.input, { minWidth: 70 }]} value={String(t.v ?? '')} onChangeText={(v) => setTr(i, { v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#666" />
                      : <TextInput style={[st.input, { minWidth: 70 }]} value={String(t.min ?? '')} onChangeText={(v) => setTr(i, { min: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#666" />}
                    <Text style={st.k}>{t.t === 'V' ? 'km/h' : 'min'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })()}
      {ordenadas.length > 0 && !WEB && (
        <TouchableOpacity style={[st.btn2, { marginBottom: 8 }]} onPress={() => Alert.alert('Recomeçar o levantamento?', 'Apaga todas as marcas e o rastro marcado desta prova (no celular e na nuvem). A prova em si continua.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar e recomeçar', style: 'destructive', onPress: () => { setLev({ iniT: null, marks: [], trechos: [] }); salvarProva(prova, { lev: null }).catch(() => {}); } }])}>
          <Text style={st.btn2Tx}>Recomeçar levantamento (apaga as marcas)</Text>
        </TouchableOpacity>
      )}
      {ordenadas.length > 0 && (
        <View style={st.card}>
          <Text style={st.tip}>{fechado ? 'Marcas (editar)' : 'Marcas (toque para anotar e fotografar)'}</Text>
          {ordenadas.map((m, i) => {
            const aberto = aberta === m.id;
            const nt = m.nt || 120;
            return (
              <View key={m.id}>
                <Sep />
                <View style={{ paddingVertical: 8 }}>
                  <TouchableOpacity onPress={() => setAberta(aberto ? null : m.id)} style={st.line}>
                    <Text style={[st.v, { color: COR[m.k] }]}>{rotulo(m, i)}</Text>
                    <Text style={st.k}>  {km2(m.km)} km{m.k === 'N' ? ` · parado ${Math.floor(nt / 60)}:${String(nt % 60).padStart(2, '0')}` : ''}{m.foto ? ' · foto' : ''}</Text>
                    <Text style={st.v}>{aberto ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {aberto && (
                    <View style={{ borderTopWidth: 1, borderTopColor: '#262b32', marginTop: 6, paddingTop: 6 }}>
                      {m.k === 'P' && (
                        <View>
                          <Text style={st.tipTx}>Linha do PC: {m.lw || 30} m, perpendicular ao rastro (vermelha no mapa). O competidor conta se o rastro cruzar a linha.</Text>
                          <View style={[st.row, { marginTop: 4, marginBottom: 4 }]}>
                            <TouchableOpacity style={st.btn2} onPress={() => upd(m.id, { lw: Math.max(10, (m.lw || 30) - 10) })}><Text style={st.btn2Tx}>− largura</Text></TouchableOpacity>
                            <TouchableOpacity style={st.btn2} onPress={() => upd(m.id, { lw: Math.min(100, (m.lw || 30) + 10) })}><Text style={st.btn2Tx}>+ largura</Text></TouchableOpacity>
                            <TouchableOpacity style={st.btn2} onPress={() => upd(m.id, { lrot: ((m.lrot || 0) + 15) % 90 })}><Text style={st.btn2Tx}>girar</Text></TouchableOpacity>
                          </View>
                        </View>
                      )}
                      {m.k === 'N' && (
                        <View>
                          <Text style={st.tipTx}>Tempo parado</Text>
                          <View style={[st.line, { justifyContent: 'flex-start', gap: 8, alignItems: 'center' }]}>
                            <TextInput style={[st.input, { minWidth: 56 }]} defaultValue={String(Math.floor(nt / 60))} keyboardType="number-pad" onEndEditing={(e) => upd(m.id, { nt: Math.max(1, (parseInt(e.nativeEvent.text, 10) || 0) * 60 + (nt % 60)) })} />
                            <Text style={st.k}>min</Text>
                            <TextInput style={[st.input, { minWidth: 56 }]} defaultValue={String(nt % 60)} keyboardType="number-pad" onEndEditing={(e) => upd(m.id, { nt: Math.max(1, Math.floor(nt / 60) * 60 + Math.min(59, parseInt(e.nativeEvent.text, 10) || 0)) })} />
                            <Text style={st.k}>seg</Text>
                          </View>
                          <Text style={st.tipTx}>O relógio do trecho seguinte só começa depois desse tempo.</Text>
                        </View>
                      )}
                      {m.k !== 'P' && (
                        <View>
                          <TextInput style={st.field} value={m.nota} onChangeText={(v) => upd(m.id, { nota: v })} placeholder="Observação (só para você)" placeholderTextColor="#666" multiline />
                          {!WEB && <View style={[st.row, { marginTop: 8, marginBottom: 0 }]}>
                            <TouchableOpacity style={st.btn2} onPress={() => foto(m.id)}><Text style={st.btn2Tx}>{m.foto ? 'Trocar foto' : 'Tirar foto'}</Text></TouchableOpacity>
                            {m.foto ? <TouchableOpacity style={st.btn2} onPress={() => apagarFoto(m.id)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar foto</Text></TouchableOpacity> : null}
                          </View>}
                          {m.foto && !WEB ? <Image source={{ uri: m.foto }} style={{ width: '100%', height: 180, borderRadius: 10, marginTop: 8 }} resizeMode="cover" /> : null}
                          {comTulipa(m) && <EditorTulipa st={st} m={m} onChange={(p) => upd(m.id, p)} onDesenhar={() => setEditorId(m.id)} onDetectar={() => detectar(m)} />}
                        </View>
                      )}
                      {m.k !== 'L' && m.k !== 'C' && (
                        <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={() => del(m.id)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar marca</Text></TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          <Sep />
          <TouchableOpacity style={[st.btn, { marginTop: 12, marginBottom: 0, backgroundColor: '#2e7d32' }]} onPress={aplicar}><Text style={[st.btnTx, { color: '#fff' }]}>Aplicar à planilha</Text></TouchableOpacity>
          <Text style={st.tipTx}>Depois de aplicar, ajuste médias e tipos (V, D) de cada trecho na aba Planilha e publique.</Text>
        </View>
      )}
          </ScrollView>
          {trAskV && (
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
              <View style={st.card}>
                <Text style={st.tip}>Trecho {trAsk + 1}</Text>
                <View style={[st.row, { marginVertical: 8 }]}>
                  <TouchableOpacity style={[st.btn2, trAskV.t === 'V' && { backgroundColor: '#ff7a2e' }]} onPress={() => setTr(trAsk, { t: 'V' })}><Text style={[st.btn2Tx, trAskV.t === 'V' && { color: '#0c1014' }]}>Média</Text></TouchableOpacity>
                  <TouchableOpacity style={[st.btn2, trAskV.t === 'D' && { backgroundColor: '#ff7a2e' }]} onPress={() => setTr(trAsk, { t: 'D' })}><Text style={[st.btn2Tx, trAskV.t === 'D' && { color: '#0c1014' }]}>Deslocamento</Text></TouchableOpacity>
                </View>
                <View style={[st.row, { alignItems: 'center' }]}>
                  {trAskV.t === 'V'
                    ? <TextInput style={[st.input, { minWidth: 90 }]} autoFocus value={String(trAskV.v ?? '')} onChangeText={(v) => setTr(trAsk, { v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#666" />
                    : <TextInput style={[st.input, { minWidth: 90 }]} autoFocus value={String(trAskV.min ?? '')} onChangeText={(v) => setTr(trAsk, { min: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#666" />}
                  <Text style={[st.v, { marginLeft: 8 }]}>{trAskV.t === 'V' ? 'km/h' : 'min'}</Text>
                </View>
                <TouchableOpacity style={[st.btn, { marginTop: 12, marginBottom: 0 }]} onPress={() => setTrAsk(null)}><Text style={st.btnTx}>OK</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Tela>
      {(() => { const em = ordenadas.find((x) => x.id === editorId); return em ? (
        <EditorDesenho visible foto={em.foto} sat={satUrl(em.lat, em.lon)} hdg={em.hdg || 0} onApagarFoto={() => apagarFoto(em.id)} inicial={em.dw && em.dw.length ? em.dw : em.arms && em.arms.length ? [{ k: 'tpl', arms: em.arms, out: em.out ?? null, x: 50, y: 55, s: 0.85, r: 0 }] : []}
          onCancel={() => setEditorId(null)} onSave={(it) => { upd(em.id, { dw: it }); setEditorId(null); }} />
      ) : null; })()}
    </View>
  );
}
