// Levantamento da prova dirigindo: o rastro do GPS vira o percurso, o organizador marca tulipas (com observação e foto)
// e, ao chegar, edita cada tulipa com calma (desenho do cruzamento, nome, neutro) antes de aplicar à planilha.
import { useState } from 'react';
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import MapaWeb from './MapaWeb';
import { Tulipa } from './Tulipa';
import { DesenhoSvg } from './Desenho';
import EditorDesenho from './EditorDesenho';
import { loadJson, saveJson, apagarJson } from './persist';
import { cumulative } from './rally';
import { getState } from './store';
import { detectarCruzamento, dist, rumo, satUrl } from './osm';

const km2 = (m) => (m / 1000).toFixed(3).replace('.', ',');
const CORES = ['#ff7a2e', '#ffe600', '#00e5ff', '#ff1744', '#76ff03'];
const KIND = { L: 'Largada', T: 'Tulipa', P: 'PC', C: 'Chegada', R: 'REF' };
const COR = { L: '#4caf50', T: '#ff7a2e', P: '#ff5a1f', C: '#c0392b', R: '#ffe600' };
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

function EditorTulipa({ st, m, onChange, onDesenhar, onDetectar }) {
  const arms = m.arms || [];
  const toggle = (a) => {
    const has = arms.includes(a);
    onChange({ arms: has ? arms.filter((x) => x !== a) : [...arms, a], out: has && m.out === a ? null : m.out });
  };
  const Chip = ({ on, tx, onPress, cor }) => (
    <TouchableOpacity style={[st.btn2, { flex: 0, paddingHorizontal: 10, paddingVertical: 6 }, on && { backgroundColor: cor || '#ff7a2e' }]} onPress={onPress}>
      <Text style={[st.btn2Tx, on && { color: '#0c1014' }]}>{tx}</Text>
    </TouchableOpacity>
  );
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
            {ANG.map(([a, t]) => <Chip key={a} on={arms.includes(a)} tx={t} onPress={() => toggle(a)} />)}
          </View>
        </View>
      </View>
      <View style={[st.row, { marginTop: 8, marginBottom: 0 }]}>
        <TouchableOpacity style={[st.btn, { flex: 1, marginBottom: 0, paddingVertical: 12 }]} onPress={onDesenhar}><Text style={st.btnTx}>{m.dw && m.dw.length ? 'Editar desenho' : 'Desenhar a tulipa'}</Text></TouchableOpacity>
        {m.dw && m.dw.length ? <TouchableOpacity style={st.btn2} onPress={() => onChange({ dw: null })}><Text style={st.btn2Tx}>Usar automática</Text></TouchableOpacity> : null}
      </View>
      <Text style={st.tipTx}>Atalhos (desenho automático pelas ruas)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map(([n, a]) => <Chip key={n} on={false} tx={n} onPress={() => onChange({ arms: a, out: a.includes(m.out) ? m.out : null })} />)}
      </View>
      <Text style={st.tipTx}>2) Por qual rua você sai (seta)?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[...arms].sort((a, b) => a - b).map((a) => <Chip key={a} cor="#4caf50" on={m.out === a} tx={ANG.find((x) => x[0] === a)?.[1] || a} onPress={() => onChange({ out: a })} />)}
        {arms.length === 0 && <Text style={st.tipTx}>Marque ao menos uma rua.</Text>}
      </View>
      <View style={[st.row, { marginTop: 8, marginBottom: 0 }]}>
        <Chip on={!!m.rot} tx="Rotatória" onPress={() => onChange({ rot: !m.rot })} />
        {m.rot ? <TextInput style={[st.input, { minWidth: 50 }]} value={String(m.ex || 1)} onChangeText={(v) => onChange({ ex: parseInt(v, 10) || 1 })} keyboardType="number-pad" /> : null}
        {m.rot ? <Text style={st.tipTx}>saída nº</Text> : null}
      </View>
      <TextInput style={st.field} value={m.nm || ''} onChangeText={(v) => onChange({ nm: v })} placeholder="Texto para o competidor (ex.: igreja à direita)" placeholderTextColor="#666" />
    </View>
  );
}

const slugProva = (p) => String(p).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');

// Lista das provas levantadas neste celular (nome, código, marcas): abrir, renomear e apagar.
function MinhasProvas({ st, atual, onAbrir, onApagou, versao }) {
  const [lista, setLista] = useState(() => loadJson('lev_index', []));
  const [edit, setEdit] = useState(null);
  const [nome, setNome] = useState('');
  const salvaLista = (l) => { setLista(l); saveJson('lev_index', l); };
  const items = loadJson('lev_index', lista);
  const ver = versao;
  const apagar = (it) => Alert.alert('Apagar levantamento', `Apagar "${it.nome || it.code}" (${it.code}) e todas as marcas deste celular? Não afeta a prova já publicada.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Apagar', style: 'destructive', onPress: () => {
      (loadJson('lev_' + slugProva(it.code), { marks: [] }).marks || []).forEach((m) => { try { if (m.foto && String(m.foto).includes('foto_')) new File(m.foto).delete(); } catch {} });
      apagarJson('lev_' + slugProva(it.code));
      salvaLista(items.filter((x) => x.code !== it.code));
      onApagou(it.code);
    } },
  ]);
  const renomear = (it) => {
    const n = nome.trim().slice(0, 60);
    const l = items.map((x) => (x.code === it.code ? { ...x, nome: n } : x));
    const d = loadJson('lev_' + slugProva(it.code), null);
    if (d) saveJson('lev_' + slugProva(it.code), { ...d, nome: n });
    salvaLista(l); setEdit(null); onApagou(null, it.code, n);
  };
  if (!items.length) return null;
  return (
    <View style={st.card} key={ver}>
      <Text style={st.tip}>Provas levantadas neste celular</Text>
      {items.map((it) => (
        <View key={it.code} style={{ borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 8 }}>
          <Text style={st.v}>{it.nome || '(sem nome)'}{it.code === atual ? ' · atual' : ''}</Text>
          <Text style={st.tipTx}>Código {it.code} · {it.marcas || 0} marca(s) · {(it.km / 1000).toFixed(3).replace('.', ',')} km</Text>
          {edit === it.code ? (
            <View>
              <TextInput style={st.field} value={nome} onChangeText={setNome} placeholder="Nome da prova" placeholderTextColor="#666" />
              <View style={[st.row, { marginTop: 6, marginBottom: 0 }]}>
                <TouchableOpacity style={st.btn2} onPress={() => renomear(it)}><Text style={st.btn2Tx}>Salvar nome</Text></TouchableOpacity>
                <TouchableOpacity style={st.btn2} onPress={() => setEdit(null)}><Text style={st.btn2Tx}>Cancelar</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[st.row, { marginTop: 6, marginBottom: 0 }]}>
              {it.code !== atual && onAbrir ? <TouchableOpacity style={st.btn2} onPress={() => onAbrir(it.code)}><Text style={st.btn2Tx}>Abrir / editar</Text></TouchableOpacity> : null}
              <TouchableOpacity style={st.btn2} onPress={() => { setEdit(it.code); setNome(it.nome || ''); }}><Text style={st.btn2Tx}>Renomear</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => apagar(it)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

export default function Levantamento({ st, prova, last, onAplicar, onProva }) {
  const chave = 'lev_' + String(prova).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const [lev, setLevRaw] = useState(() => loadJson(chave, { iniT: null, marks: [] }));
  const [aberta, setAberta] = useState(null);
  const [seguir, setSeguir] = useState(true);
  const [ctr, setCtr] = useState(0);
  const [rw, setRw] = useState(5);
  const [dash, setDash] = useState(false);
  const [rc, setRc] = useState('#ff7a2e');
  const [editorId, setEditorId] = useState(null);
  const [cand, setCand] = useState(null);
  const [vers, setVers] = useState(0);
  const setLev = (fn) => setLevRaw((o) => {
    const n = typeof fn === 'function' ? fn(o) : fn;
    saveJson(chave, n);
    try {
      const cod = String(prova).trim().toUpperCase();
      const idx = loadJson('lev_index', []).filter((x) => x.code !== cod);
      const pts = getState().points;
      const ini = n.iniT != null ? pts.findIndex((p) => p.t >= n.iniT) : -1;
      const ult = (n.marks || []).length;
      const kmx = ini >= 0 && pts.length ? Math.max(0, cumulative(pts)[pts.length - 1] - cumulative(pts)[ini]) : (loadJson('lev_index', []).find((x) => x.code === cod)?.km || 0);
      if (n.nome || ult) saveJson('lev_index', [{ code: cod, nome: n.nome || '', marcas: ult, km: Math.round(kmx), ts: Date.now() }, ...idx]);
    } catch {}
    return n;
  });

  const { points } = getState();
  const cum = cumulative(points);
  const iniIdx = lev.iniT != null ? Math.max(0, points.findIndex((p) => p.t >= lev.iniT)) : -1;
  const kmAqui = iniIdx >= 0 && points.length ? Math.max(0, cum[points.length - 1] - cum[iniIdx]) : 0;
  const fechado = lev.marks.some((m) => m.k === 'C');
  // Rastro percorrido (no máximo ~700 pontos para o mapa).
  const trail = (() => {
    if (iniIdx < 0) return [];
    const seg = points.slice(iniIdx).filter((p) => !(p.acc != null && p.acc > 25));
    const step = Math.max(1, Math.ceil(seg.length / 700));
    return seg.filter((_, i) => i % step === 0 || i === seg.length - 1).map((p) => [p.lat, p.lon]);
  })();

  const pronto = () => {
    const l = points[points.length - 1];
    if (!l || (l.acc != null && l.acc > 25) || Date.now() - l.t > 6000) { Alert.alert('GPS sem sinal bom', 'Inicie a gravação na aba Gravar e espere o GPS ficar verde.'); return null; }
    return l;
  };
  const marcar = (k, extra = {}) => {
    const l = pronto(); if (!l) return;
    if (k === 'L') {
      const novo = () => setLev({ iniT: l.t, marks: [{ id: 1, k: 'L', lat: l.lat, lon: l.lon, hdg: l.hdg ?? null, km: 0, nota: '', foto: null }] });
      if (!lev.marks.length) return novo();
      Alert.alert('Iniciar levantamento', 'Isso apaga o levantamento anterior desta prova. Continuar?', [
        { text: 'Cancelar' },
        { text: 'Iniciar', onPress: novo },
      ]);
      return;
    }
    if (iniIdx < 0) return Alert.alert('Marque a largada primeiro');
    const m = { id: Date.now(), k, lat: Math.round(l.lat * 1e6) / 1e6, lon: Math.round(l.lon * 1e6) / 1e6, hdg: l.hdg != null && l.hdg >= 0 ? Math.round(l.hdg) : null, km: Math.round(kmAqui), nota: '', foto: null, ...extra };
    setLev((o) => ({ ...o, marks: [...o.marks, m] }));
    if (k === 'T' || k === 'P') setAberta(m.id);
  };
  const upd = (id, patch) => setLev((o) => ({ ...o, marks: o.marks.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const del = (id) => setLev((o) => ({ ...o, marks: o.marks.filter((m) => m.id !== id) }));
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
    const pts = getState().points;
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
  const semArms = ordenadas.filter((m) => m.k === 'T' && !(m.dw && m.dw.length) && !(m.arms && m.arms.length && m.out != null));
  const aplicar = () => {
    if (!fechado) return Alert.alert('Falta a chegada', 'Toque em CHEGADA no fim do percurso.');
    if (semArms.length) return Alert.alert('Tulipas sem desenho', `${semArms.length} tulipa(s) ainda sem ruas e saída. Elas ficam só com o texto. Continuar?`, [{ text: 'Voltar' }, { text: 'Aplicar assim', onPress: () => confirmar() }]);
    confirmar();
  };
  const confirmar = () => {
    let prev = 0, pcN = 0;
    const tul = [], wps = [], nIdx = new Set(), refs = [], pontosKm = [];
    ordenadas.forEach((m) => {
      if (m.k === 'R') { refs.push({ n: refs.length + 1, lat: m.lat, lon: m.lon, hdg: m.hdg, km: Math.round(m.km) / 1000 }); return; }
      const d = m.km, p = d - prev;
      if (m.k === 'L') tul.push({ t: 'L', d: 0, p: 0, man: true });
      else if (m.k === 'T') tul.push((m.arms && m.arms.length) || (m.dw && m.dw.length) ? entradaDe(m, p) : { t: 'T', d, p, ty: 'turn', mo: '', b: [180], i: 0, o: -1, ex: 0, nm: m.nm || m.nota || '', man: true });
      else if (m.k === 'P') { pcN++; tul.push({ t: 'P', n: pcN, d, p, man: true }); }
      else if (m.k === 'C') tul.push({ t: 'C', n: pcN + 1, d, p, man: true });
      if (m.k === 'L' || m.k === 'P' || m.k === 'C') {
        wps.push([m.lat, m.lon]); pontosKm.push(d / 1000);
        if (m.k !== 'L' && m.n) nIdx.add(wps.length - 2);
      }
      prev = d;
    });
    const legs = pontosKm.slice(1).map((k, i) => Math.round((k - pontosKm[i]) * 1000) / 1000);
    onAplicar({ wps, rota: { coords: trail, legs, tul }, nIdx, refs });
    Alert.alert('Aplicado', 'Percurso, tulipas e trechos foram para a aba Planilha. Ajuste as médias e publique.');
  };

  // Depois da chegada: toque no rastro para inserir tulipa ou PC naquele ponto (a numeração se refaz sozinha pela ordem no percurso).
  const tocaTrilha = (lat, lon) => {
    if (!fechado || iniIdx < 0) return;
    let bi = -1, bd = 1e9;
    for (let i = iniIdx; i < points.length; i++) {
      const p = points[i];
      if (p.acc != null && p.acc > 25) continue;
      const d = dist([lat, lon], [p.lat, p.lon]);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi < 0 || bd > 60) return Alert.alert('Longe do rastro', 'Toque mais perto da linha do percurso.');
    const p = points[bi], a = points[Math.max(iniIdx, bi - 2)], b = points[Math.min(points.length - 1, bi + 2)];
    const fim = lev.marks.find((x) => x.k === 'C');
    setCand({ lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6, hdg: Math.round(rumo([a.lat, a.lon], [b.lat, b.lon])), km: Math.min(Math.round(cum[bi] - cum[iniIdx]), fim ? fim.km : 1e12) });
  };
  const inserir = (k, extra = {}) => {
    if (!cand) return;
    const m = { id: Date.now(), k, lat: cand.lat, lon: cand.lon, hdg: cand.hdg, km: cand.km, nota: '', foto: null, ...extra };
    const ord = (x) => (x.k === 'L' ? -1 : x.k === 'C' ? 1e12 : x.km);
    setLev((o) => ({ ...o, marks: [...o.marks, m].sort((x, y) => ord(x) - ord(y)) }));
    setCand(null);
    if (k === 'T' || k === 'P') setAberta(m.id);
  };

  const ult = ordenadas[ordenadas.length - 1];
  const pinosBase = ordenadas.map((m, i) => ({ lat: m.lat, lon: m.lon, txt: m.k === 'T' ? 'T' + ordenadas.slice(0, i + 1).filter((x) => x.k === 'T').length : m.k === 'P' ? 'PC' + ordenadas.slice(0, i + 1).filter((x) => x.k === 'P').length : KIND[m.k], cls: m.k === 'L' ? 'l' : m.k === 'C' ? 'c' : '' }));
  const pinos = cand ? [...pinosBase, { lat: cand.lat, lon: cand.lon, txt: 'NOVO', cls: 'c' }] : pinosBase;
  const B = ({ cor, tx, on, fg }) => (
    <TouchableOpacity style={{ flex: 1, backgroundColor: cor, borderRadius: 10, paddingVertical: 16, alignItems: 'center' }} onPress={on}>
      <Text style={{ color: fg || '#000', fontWeight: '900', fontSize: 13 }}>{tx}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <MapaWeb wps={[]} coords={trail} marks={pinos} sat editable={fechado} onTap={tocaTrilha} follow={seguir && !fechado} rw={rw} dash={dash} rc={rc} ctr={ctr} me={last ? [last.lat, last.lon] : null} height={380} />
      {fechado && !cand && <Text style={st.tipTx}>Para incluir uma tulipa ou um PC que faltou, toque no rastro do mapa no ponto certo.</Text>}
      {cand && (
        <View style={st.card}>
          <Text style={st.tip}>Novo ponto no km {km2(cand.km)}</Text>
          <View style={[st.row, { marginTop: 6, marginBottom: 6 }]}>
            <B cor="#ff7a2e" tx="TULIPA" on={() => inserir('T')} />
            <B cor="#ff5a1f" tx="PC" on={() => inserir('P')} />
            <B cor="#c0392b" fg="#fff" tx="PC N" on={() => inserir('P', { n: true })} />
          </View>
          <TouchableOpacity style={st.btn2} onPress={() => setCand(null)}><Text style={st.btn2Tx}>Cancelar</Text></TouchableOpacity>
          <Text style={st.tipTx}>As marcas seguintes são renumeradas sozinhas pela ordem no percurso.</Text>
        </View>
      )}
      <View style={[st.row, { marginBottom: 6 }]}>
        <TouchableOpacity style={st.btn2} onPress={() => { setCtr((c) => c + 1); setSeguir(true); }}><Text style={st.btn2Tx}>◎ Centralizar</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={() => setSeguir((v) => !v)}><Text style={st.btn2Tx}>{seguir ? 'Seguindo: SIM' : 'Seguindo: NÃO'}</Text></TouchableOpacity>
      </View>
      <View style={[st.row, { marginBottom: 6 }]}>
        <TouchableOpacity style={st.btn2} onPress={() => setRw((w) => (w >= 10 ? 3 : w + 2))}><Text style={st.btn2Tx}>Espessura: {rw}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={() => setDash((d) => !d)}><Text style={st.btn2Tx}>{dash ? 'Pontilhado' : 'Contínuo'}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={() => setRc((c) => CORES[(CORES.indexOf(c) + 1) % CORES.length])}><Text style={[st.btn2Tx, { color: rc }]}>Cor</Text></TouchableOpacity>
      </View>
      {!fechado && lev.marks.length > 0 && (
        <View style={[st.row, { marginBottom: 8 }]}>
          <B cor="#ff7a2e" tx="TULIPA" on={() => marcar('T')} />
          <B cor="#ff5a1f" tx="PC" on={() => marcar('P')} />
          <B cor="#1565c0" fg="#fff" tx="FOTO" on={fotoRapida} />
        </View>
      )}
      <View style={st.card}>
        <Text style={st.tip}>Nome da prova</Text>
        <TextInput style={st.field} value={lev.nome || ''} onChangeText={(v) => setLev((o) => ({ ...o, nome: v.slice(0, 60) }))} placeholder="Ex.: Rally dos Ipês 2026" placeholderTextColor="#666" />
        <Text style={st.tip}>Levantar a prova dirigindo</Text>
        <Text style={st.tipTx}>Ligue a gravação na aba Gravar, toque LARGADA e dirija o percurso. Marque tulipas e PCs conforme passa, com observação e foto. Ao chegar, toque CHEGADA e edite cada tulipa com calma. As fotos ficam só no seu celular.</Text>
        {!fechado && (
          <View style={[st.row, { marginTop: 8, marginBottom: 6 }]}>
            {lev.marks.length === 0 ? <B cor="#4caf50" tx="LARGADA" on={() => marcar('L')} /> : (
              <>
                <B cor="#ff7a2e" tx="TULIPA" on={() => marcar('T')} />
                <B cor="#ff5a1f" tx="PC" on={() => marcar('P')} />
                <B cor="#c0392b" fg="#fff" tx="PC N" on={() => marcar('P', { n: true })} />
                <B cor="#ffe600" tx="REF" on={() => marcar('R')} />
              </>
            )}
          </View>
        )}
        {lev.marks.length > 0 && !fechado && (
          <TouchableOpacity style={[st.btn, { backgroundColor: '#c0392b', marginTop: 4, marginBottom: 6 }]} onPress={() => marcar('C')}><Text style={[st.btnTx, { color: '#fff' }]}>CHEGADA (fim da prova)</Text></TouchableOpacity>
        )}
        <Text style={st.tipTx}>{iniIdx >= 0 ? `${km2(kmAqui)} km percorridos · ${ordenadas.filter((m) => m.k === 'T').length} tulipa(s) · ${ordenadas.filter((m) => m.k === 'P').length} PC(s)` : 'Levantamento ainda não iniciado.'}{last?.acc != null ? ` · GPS ${last.acc.toFixed(0)} m` : ''}</Text>
        {fechado && (
          <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={() => del(ult.id)}><Text style={st.btn2Tx}>Reabrir (desfazer chegada)</Text></TouchableOpacity>
        )}
      </View>

      {(() => { const em = ordenadas.find((x) => x.id === editorId); return em ? (
        <EditorDesenho visible foto={em.foto} sat={satUrl(em.lat, em.lon)} hdg={em.hdg || 0} onApagarFoto={() => apagarFoto(em.id)} inicial={em.dw && em.dw.length ? em.dw : em.arms && em.arms.length ? [{ k: 'tpl', arms: em.arms, out: em.out ?? null, x: 50, y: 55, s: 0.85, r: 0 }] : []}
          onCancel={() => setEditorId(null)} onSave={(it) => { upd(em.id, { dw: it }); setEditorId(null); }} />
      ) : null; })()}

      <MinhasProvas st={st} atual={String(prova).trim().toUpperCase()} versao={vers} onAbrir={onProva}
        onApagou={(code) => { if (code && code === String(prova).trim().toUpperCase()) setLevRaw({ iniT: null, marks: [] }); setVers((v) => v + 1); }} />
      {ordenadas.length > 0 && (
        <View style={st.card}>
          <Text style={st.tip}>{fechado ? 'Editar marcas' : 'Marcas (toque para anotar e fotografar)'}</Text>
          {ordenadas.map((m, i) => {
            const nT = ordenadas.slice(0, i + 1).filter((x) => x.k === 'T').length, nP = ordenadas.slice(0, i + 1).filter((x) => x.k === 'P').length;
            const titulo = m.k === 'T' ? `Tulipa ${nT}` : m.k === 'P' ? `PC ${nP}${m.n ? ' · N' : ''}` : KIND[m.k];
            const aberto = aberta === m.id;
            return (
              <View key={m.id} style={{ borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 8 }}>
                <TouchableOpacity onPress={() => setAberta(aberto ? null : m.id)} style={st.line}>
                  <Text style={[st.v, { color: COR[m.k] }]}>{titulo}</Text>
                  <Text style={st.k}>  {km2(m.km)} km{m.foto ? ' · foto' : ''}{m.nota ? ' · nota' : ''}</Text>
                  <Text style={st.v}>{aberto ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {aberto && (
                  <View>
                    <TextInput style={st.field} value={m.nota} onChangeText={(v) => upd(m.id, { nota: v })} placeholder="Observação (só para você)" placeholderTextColor="#666" multiline />
                    <View style={[st.row, { marginTop: 8, marginBottom: 0 }]}>
                      <TouchableOpacity style={st.btn2} onPress={() => foto(m.id)}><Text style={st.btn2Tx}>{m.foto ? 'Trocar foto' : 'Tirar foto'}</Text></TouchableOpacity>
                      {m.foto ? <TouchableOpacity style={st.btn2} onPress={() => apagarFoto(m.id)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar foto</Text></TouchableOpacity> : null}
                      {m.k !== 'L' && <TouchableOpacity style={st.btn2} onPress={() => del(m.id)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar marca</Text></TouchableOpacity>}
                    </View>
                    {m.foto ? <Image source={{ uri: m.foto }} style={{ width: '100%', height: 180, borderRadius: 10, marginTop: 8 }} resizeMode="cover" /> : null}
                    {m.k === 'T' && <EditorTulipa st={st} m={m} onChange={(p) => upd(m.id, p)} onDesenhar={() => setEditorId(m.id)} onDetectar={() => detectar(m)} />}
                    {m.k === 'P' && (
                      <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={() => upd(m.id, { n: !m.n })}><Text style={st.btn2Tx}>{m.n ? 'Neutro ligado (toque para tirar)' : 'Marcar como PC neutro (N)'}</Text></TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          <TouchableOpacity style={[st.btn, { marginTop: 12, marginBottom: 0, backgroundColor: '#2e7d32' }]} onPress={aplicar}><Text style={[st.btnTx, { color: '#fff' }]}>Aplicar à planilha</Text></TouchableOpacity>
          <Text style={st.tipTx}>Depois de aplicar, ajuste médias e tipos (V, D) de cada trecho na aba Planilha e publique.</Text>
        </View>
      )}
    </View>
  );
}
