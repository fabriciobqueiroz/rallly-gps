// Editor de tulipa no estilo Kraken: abas Desenho, Tulipas e Imagens, com o quadro quadrado, formas, espessura, estilo e setas.
import { useRef, useState } from 'react';
import Tela from './Tela';
import { Image, PanResponder, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Circle } from 'react-native-svg';
import { DesenhoSvg, SIMBOLOS, centro, mover } from './Desenho';
import { CATEGORIAS } from './Simbolos';
import { DIRECOES, TIPOS, banco, filtrar } from './BancoTulipas';

const AZ = '#6cc4ec', CI = '#8fe6f2', LARANJA = '#f57c1f', VERDE = '#7be07b', CZ = '#6b7480';
const r1 = (n) => Math.round(n * 10) / 10;

// Formas arrastadas do ponto (x0,y0) ao ponto (x1,y1): devolve uma lista de linhas (cada uma é [x,y,x,y,...]).
function forma(tipo, x0, y0, x1, y1) {
  const bez = (cx, cy) => { const o = []; for (let i = 0; i <= 14; i++) { const t = i / 14, u = 1 - t; o.push(r1(u * u * x0 + 2 * u * t * cx + t * t * x1), r1(u * u * y0 + 2 * u * t * cy + t * t * y1)); } return o; };
  if (tipo === 'linha') return [[x0, y0, x1, y1]];
  if (tipo === 'canto') return [[x0, y0, x0, y1, x1, y1]];
  if (tipo === 'curva') return [bez(x0, y1)];
  if (tipo === 'curva2') {
    const r = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2, sx = x1 >= x0 ? 1 : -1, sy = y1 >= y0 ? 1 : -1, o = [x0, y0];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); o.push(r1(x0 + sx * r * (1 - Math.cos(a))), r1(y1 - sy * r * (1 - Math.sin(a)))); }
    o.splice(2, 0, x0, r1(y1 - sy * r));
    o.push(x1, y1);
    return [o];
  }
  if (tipo === 'circulo') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2, o = []; for (let i = 0; i <= 36; i++) { const a = (i / 36) * 2 * Math.PI; o.push(r1(cx + rx * Math.cos(a)), r1(cy + ry * Math.sin(a))); } return [o]; }
  if (tipo === 'ret') return [[x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]];
  if (tipo === 'paralelas') {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = (-dy / d) * 6, ny = (dx / d) * 6;
    return [-1, 0, 1].map((k) => [r1(x0 + nx * k), r1(y0 + ny * k), r1(x1 + nx * k), r1(y1 + ny * k)]);
  }
  return [];
}
const FORMAS = [['sel', '⌖', 'Selecionar'], ['linha', '╱', 'Linha'], ['canto', '⌐', 'Linha em L'], ['curva', '⌒', 'Curva'], ['curva2', '◜', 'Canto arredondado'], ['circulo', '○', 'Círculo'], ['ret', '▭', 'Retângulo'], ['paralelas', '≡', 'Paralelas'], ['txt', 'T', 'Texto'], ['pen', '✎', 'Mão livre']];
const ESPESSURA = [[1.5, '╱'], [3, '╱'], [6, '╱']];
const ESTILOS = [['', '━'], ['d', '┅'], ['p', '┈'], ['dp', '╌'], ['l', '╍']];
const SETAS = [['', '—'], ['f', '→'], ['i', '←'], ['b', '↔']];

export default function EditorDesenho({ visible, inicial, foto, sat, hdg = 0, km, onApagarFoto, onCancel, onSave }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const S = wide ? Math.max(260, Math.min(height - 190, 560)) : Math.min(width - 24, 380);
  const [items, setItems] = useState(inicial || []);
  const [aba, setAba] = useState('des');
  const [fundo, setFundo] = useState(foto ? 'foto' : sat ? 'sat' : 'nada');
  const [conf, setConf] = useState(false);
  const [sel, setSel] = useState(null);
  const [live, setLive] = useState(null);
  const [ferr, setFerr] = useState('linha');
  const [esp, setEsp] = useState(3);
  const [est, setEst] = useState('');
  const [seta, setSeta] = useState('');
  const [txt, setTxt] = useState('');
  const [fDir, setFDir] = useState('todas');
  const [fTipo, setFTipo] = useState('todos');
  const [fImg, setFImg] = useState('todas');
  const [fCat, setFCat] = useState('todas');
  const [mostra, setMostra] = useState(60);
  const hist = useRef([]);
  const fut = useRef([]);
  const R = useRef({});
  R.current = { ...R.current, items, ferr, sel, esp, est, seta, S, txt };
  const push = () => { hist.current = [...hist.current.slice(-40), R.current.items]; fut.current = []; };
  const desfazer = () => { if (!hist.current.length) return; fut.current.push(R.current.items); const p = hist.current.pop(); setItems(p); setSel(null); };
  const refazer = () => { if (!fut.current.length) return; hist.current.push(R.current.items); setItems(fut.current.pop()); setSel(null); };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { ferr: f, items: it, S: s } = R.current;
      const x = (e.nativeEvent.locationX / s) * 100, y = (e.nativeEvent.locationY / s) * 100;
      R.current.x0 = x; R.current.y0 = y; R.current.last = [x, y]; R.current.moved = false; R.current.hit = false;
      if (f === 'pen') { R.current.stroke = [r1(x), r1(y)]; setLive([[...R.current.stroke]]); setSel(null); return; }
      if (f === 'sel') {
        let best = null, bd = 18;
        it.forEach((q, i) => { const [cx, cy] = centro(q); const d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = i; } });
        R.current.hit = best != null;
        if (best != null) { setSel(best); R.current.sel = best; push(); } else setSel(null);
      } else if (f === 'txt') {
        const t = (R.current.txt || '').trim();
        if (t) { push(); setItems((o) => [...o, { k: 'txt', tx: t.slice(0, 18), x: r1(x), y: r1(y), s: 1 }]); setSel(R.current.items.length); }
      } else setSel(null);
    },
    onPanResponderMove: (e, g) => {
      const { ferr: f, S: s } = R.current;
      const x = R.current.x0 + (g.dx / s) * 100, y = R.current.y0 + (g.dy / s) * 100;
      if (Math.abs(g.dx) + Math.abs(g.dy) > 4) R.current.moved = true;
      if (f === 'pen') {
        const st = R.current.stroke; if (!st) return;
        if (Math.hypot(x - st[st.length - 2], y - st[st.length - 1]) >= 1.2) { st.push(r1(x), r1(y)); setLive([[...st]]); }
      } else if (f === 'sel') {
        const [px, py] = R.current.last; R.current.last = [x, y];
        const sl = R.current.sel;
        if (R.current.hit && sl != null) setItems((o) => o.map((q, i) => (i === sl ? mover(q, x - px, y - py) : q)));
      } else if (f !== 'txt') setLive(forma(f, R.current.x0, R.current.y0, x, y));
    },
    onPanResponderRelease: (e, g) => {
      const { ferr: f, esp: w, est: d, seta: a, S: s } = R.current;
      const x = R.current.x0 + (g.dx / s) * 100, y = R.current.y0 + (g.dy / s) * 100;
      let novos = [];
      if (f === 'pen') { if (R.current.stroke && R.current.stroke.length >= 4) novos = [R.current.stroke]; }
      else if (f !== 'sel' && f !== 'txt' && R.current.moved) novos = forma(f, R.current.x0, R.current.y0, x, y);
      if (novos.length) { push(); setItems((o) => [...o, ...novos.map((p) => ({ k: 'pen', p, w, d, ar: a }))]); }
      R.current.stroke = null; setLive(null);
    },
  })).current;

  const add = (its) => { push(); setItems((o) => [...o, ...its]); setAba('des'); setFerr('sel'); setSel(null); };
  const usarTulipa = (b) => { push(); setItems((o) => [...o.filter((q) => !q.b), ...b.it]); setAba('des'); setFerr('sel'); setSel(null); };
  const alt = (patch) => { if (sel == null || !items[sel] || items[sel].k !== 'pen') return; push(); setItems((o) => o.map((q, i) => (i === sel ? { ...q, ...patch } : q))); };
  const Chip = ({ t, on, press, w = 36, h = 32, fs = 17 }) => (
    <TouchableOpacity onPress={press} style={{ width: w, height: h, borderWidth: 1, borderColor: '#cfd8dc', backgroundColor: on ? CI : '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 5, marginBottom: 5 }}>
      <Text style={{ color: '#333', fontSize: fs }}>{t}</Text>
    </TouchableOpacity>
  );
  const Rotulo = ({ t }) => <Text style={{ color: CZ, fontSize: 11, marginBottom: 3, marginTop: 4 }}>{t}</Text>;
  const it0 = sel != null ? items[sel] : null;
  const realce = it0 ? (() => { const [cx, cy] = centro(it0); return <Circle cx={cx} cy={cy} r={10} fill="#ffe600" fillOpacity={0.45} />; })() : null;
  const todos = live ? [...items, ...live.map((p) => ({ k: 'pen', p, w: esp, d: est, ar: seta }))] : items;
  const Quadro = (
    <View style={{ alignSelf: 'center', width: S, height: S, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfd8dc', overflow: 'hidden' }}>
      {fundo === 'foto' && foto ? <Image source={{ uri: foto }} style={{ position: 'absolute', width: S, height: S, opacity: 0.4 }} resizeMode="cover" /> : null}
      {fundo === 'sat' && sat ? <Image source={{ uri: sat }} style={{ position: 'absolute', width: S, height: S, opacity: 0.55, transform: [{ rotate: `${-hdg}deg` }, { scale: 1.42 }] }} resizeMode="cover" /> : null}
      <View style={{ position: 'absolute' }}><DesenhoSvg items={todos} size={S} fundo={fundo === 'nada'}>{realce}</DesenhoSvg></View>
      <View style={{ position: 'absolute', width: S, height: S }} {...pan.panHandlers} />
    </View>
  );
  const Ferramentas = (
    <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
      <Rotulo t="Ações" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip t="⌖" on={ferr === 'sel'} press={() => setFerr('sel')} />
        <Chip t="↶" press={desfazer} /><Chip t="↷" press={refazer} />
        <Chip t="🗑" press={() => { if (sel != null) { push(); setItems((o) => o.filter((_, i) => i !== sel)); setSel(null); } }} fs={15} />
        <Chip t="✕" press={() => { push(); setItems([]); setSel(null); }} />
        {it0 && it0.k !== 'pen' ? <>
          <Chip t="−" press={() => { push(); setItems((o) => o.map((q, i) => (i === sel ? { ...q, s: Math.max(0.3, (q.s || 1) - 0.15) } : q))); }} />
          <Chip t="+" press={() => { push(); setItems((o) => o.map((q, i) => (i === sel ? { ...q, s: Math.min(3, (q.s || 1) + 0.15) } : q))); }} />
          <Chip t="↺" press={() => { push(); setItems((o) => o.map((q, i) => (i === sel ? { ...q, r: ((q.r || 0) - 45 + 360) % 360 } : q))); }} />
          <Chip t="↻" press={() => { push(); setItems((o) => o.map((q, i) => (i === sel ? { ...q, r: ((q.r || 0) + 45) % 360 } : q))); }} />
        </> : null}
      </View>
      <Rotulo t="Formas" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {FORMAS.filter((f) => f[0] !== 'sel').map(([k, g]) => <Chip key={k} t={g} on={ferr === k} press={() => { setFerr(k); setSel(null); }} />)}
      </View>
      {ferr === 'txt' ? <TextInput style={{ borderWidth: 1, borderColor: '#cfd8dc', padding: 8, marginBottom: 6, color: '#222' }} value={txt} onChangeText={setTxt} placeholder="Digite o texto e toque no quadro" placeholderTextColor="#999" /> : null}
      <Rotulo t="Espessura" />
      <View style={{ flexDirection: 'row' }}>
        {ESPESSURA.map(([v], i) => <Chip key={v} t={'━'.repeat(1)} fs={11 + i * 5} on={esp === v} press={() => { setEsp(v); alt({ w: v }); }} />)}
      </View>
      <Rotulo t="Estilo" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ESTILOS.map(([v, g]) => <Chip key={v || 's'} t={g} on={est === v} press={() => { setEst(v); alt({ d: v }); }} />)}
      </View>
      <Rotulo t="Setas" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {SETAS.map(([v, g]) => <Chip key={v || 'n'} t={g} on={seta === v} press={() => { setSeta(v); alt({ ar: v }); }} />)}
      </View>
    </View>
  );
  const cel = wide ? 110 : Math.floor((width - 24) / 4) - 6;
  const lista = aba === 'tul' ? filtrar(fDir, fTipo, fImg) : [];
  const syms = Object.keys(SIMBOLOS).filter((n) => SIMBOLOS[n].cat && (fCat === 'todas' || SIMBOLOS[n].cat === fCat));
  const Grade = ({ children }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 8 }}>{children}</View>;
  const CC = ({ children, press }) => <TouchableOpacity onPress={press} style={{ margin: 3 }}>{children}</TouchableOpacity>;

  return (
    <Tela visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ backgroundColor: AZ, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 }}>
          <TouchableOpacity onPress={onCancel} style={{ paddingRight: 14 }}><Text style={{ color: '#fff', fontSize: 26, lineHeight: 26 }}>‹</Text></TouchableOpacity>
          <Text style={{ flex: 1, color: '#fff', fontSize: 17 }}>Tulipa ({km != null ? Number(km).toFixed(3).replace('.', ',') : '0,000'})</Text>
          <TouchableOpacity onPress={() => onSave(items)} style={{ paddingHorizontal: 10 }}><Text style={{ color: '#fff', fontSize: 18 }}>💾</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setConf((v) => !v)} style={{ paddingHorizontal: 10 }}><Text style={{ color: '#fff', fontSize: 18 }}>⚙</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
          {[['des', '✎ Desenho'], ['tul', '↑ Tulipas'], ['img', '▣ Imagens']].map(([k, t]) => (
            <TouchableOpacity key={k} onPress={() => setAba(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 3, borderBottomColor: aba === k ? AZ : 'transparent' }}>
              <Text style={{ color: aba === k ? '#222' : '#777', fontSize: 14 }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {conf && (
          <View style={{ padding: 10, backgroundColor: '#f3f6f8', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            <Text style={{ color: CZ, marginRight: 8 }}>Fundo para decalcar:</Text>
            {foto ? <Chip w={70} t="Foto" fs={13} on={fundo === 'foto'} press={() => setFundo('foto')} /> : null}
            {sat ? <Chip w={70} t="Satélite" fs={13} on={fundo === 'sat'} press={() => setFundo('sat')} /> : null}
            <Chip w={80} t="Sem fundo" fs={13} on={fundo === 'nada'} press={() => setFundo('nada')} />
            {foto && onApagarFoto ? <Chip w={90} t="Apagar foto" fs={13} press={() => { setFundo(sat ? 'sat' : 'nada'); onApagarFoto(); }} /> : null}
            <Text style={{ color: CZ, fontSize: 11, width: '100%' }}>O fundo só serve para decalcar: não aparece no roadbook.</Text>
          </View>
        )}
        {aba === 'des' && (wide ? (
          <View style={{ flex: 1, flexDirection: 'row', padding: 12 }}>
            {Quadro}
            <ScrollView style={{ flex: 1, marginLeft: 12 }}>{Ferramentas}</ScrollView>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 10 }}>{Quadro}{Ferramentas}</ScrollView>
        ))}
        {aba === 'tul' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
              <Rotulo t="Direção:" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{DIRECOES.map(([k, g]) => <Chip key={k} t={g} on={fDir === k} press={() => { setFDir(k); setMostra(60); }} />)}</View>
              <Rotulo t="Tipo de tulipa:" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{TIPOS.map(([k, g]) => <Chip key={k} t={g} on={fTipo === k} press={() => { setFTipo(k); setMostra(60); }} />)}</View>
              <Rotulo t="Tipo de imagem:" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Chip t="∞" on={fImg === 'todas'} press={() => { setFImg('todas'); setMostra(60); }} />
                <Chip t="⊘" on={fImg === 'nenhuma'} press={() => { setFImg('nenhuma'); setMostra(60); }} />
                {CATEGORIAS.map(([k, g]) => <Chip key={k} t={g} on={fImg === k} press={() => { setFImg(k); setMostra(60); }} />)}
              </View>
              <Text style={{ color: CZ, fontSize: 11 }}>{lista.length} desenhos de {banco().length}</Text>
            </View>
            <Grade>
              {lista.slice(0, mostra).map((b) => <CC key={b.id} press={() => usarTulipa(b)}><DesenhoSvg items={b.it} size={cel} /></CC>)}
            </Grade>
            {lista.length > mostra ? <TouchableOpacity onPress={() => setMostra((m) => m + 80)} style={{ alignSelf: 'center', margin: 14, padding: 10, borderWidth: 1, borderColor: AZ }}><Text style={{ color: AZ }}>Mostrar mais</Text></TouchableOpacity> : null}
          </ScrollView>
        )}
        {aba === 'img' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
              <Rotulo t="Tipo de imagem:" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Chip t="∞" on={fCat === 'todas'} press={() => setFCat('todas')} />
                {CATEGORIAS.map(([k, g]) => <Chip key={k} t={g} on={fCat === k} press={() => setFCat(k)} />)}
              </View>
            </View>
            <Grade>
              {syms.map((n) => (
                <CC key={n} press={() => add([{ k: 'sym', n, x: 50, y: 30, s: 1.1 }])}>
                  <DesenhoSvg items={[{ k: 'sym', n, x: 50, y: 50, s: 2 }]} size={cel} />
                  <Text style={{ color: CZ, fontSize: 10, textAlign: 'center', width: cel }} numberOfLines={1}>{SIMBOLOS[n].nome}</Text>
                </CC>
              ))}
            </Grade>
          </ScrollView>
        )}
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={onCancel} style={{ flex: 1, backgroundColor: LARANJA, paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>✕  CANCELAR</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onSave(items)} style={{ flex: 1, backgroundColor: VERDE, paddingVertical: 16, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>✓  OK</Text></TouchableOpacity>
        </View>
      </View>
    </Tela>
  );
}
