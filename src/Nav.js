// Tela do navegador (durante a prova) e tela de personalização (antes da prova).
// Durante a prova nada é editável, só os botões de correção (+10 m, -10 m, PC) e o menu ⋮.
import { zeroOff } from './rally';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Tela from './Tela';
import * as Battery from 'expo-battery';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ouvirEspelho, publicarEspelho } from './firebase';
import { grupoIdx } from './rally';
import Svg, { Text as SvgText } from 'react-native-svg';
import { useKeepAwake } from 'expo-keep-awake';
import { loadJson, saveJson } from './persist';
import { Bloco, fmtDist, fmtTnav, faixaDe } from './Blocos';
import Erro from './Erro';
import Seguro from './Seguro';
import LayoutEditor, { TOPO } from './LayoutEditor';
import { getLayout, loadLayouts, novoId, padraoDe, saveLayouts } from './NavLayout';

export { fmtDist, fmtTnav, faixaDe };

export const NAV_PADRAO = {
  tiles: { odo: true, tnav: true, vel: true, regref: true, atual: true, prox: true, regtrc: true, pm: true, bat: true, rb: true },
  tnavDec: 1,
  faixas: [
    { a: -3, b: 3, bg: '#f5e50f' },
    { a: -10, b: -3, bg: '#e53935' },
    { a: 3, b: 10, bg: '#1e88e5' },
  ],
  ref: { un: 'm', dec: 0 },
  trc: { un: 'm', dec: 0 },
  odo: { un: 'km', dec: 3 },
  rb: { ant: 1, prox: 4, pAnt: 60, pAtual: 100, pProx: [80, 60, 50, 40, 40, 40, 40, 40] },
  barra: { on: true, ini: 100, cor: '#e53935' },
};
export const loadNav = () => {
  const c = loadJson('navcfg', {});
  if (c && c.tnavDec > 2) c.tnavDec = 2;
  return { ...NAV_PADRAO, ...c, tiles: { ...NAV_PADRAO.tiles, ...(c.tiles || {}) }, ref: { ...NAV_PADRAO.ref, ...(c.ref || {}) }, trc: { ...NAV_PADRAO.trc, ...(c.trc || {}) }, odo: { ...NAV_PADRAO.odo, ...(c.odo || {}) }, rb: { ...NAV_PADRAO.rb, ...(c.rb || {}) }, barra: { ...NAV_PADRAO.barra, ...(c.barra || {}) } };
};
export const saveNav = (c) => saveJson('navcfg', c);

const CORES = ['#f5e50f', '#e53935', '#1e88e5', '#43a047', '#fb8c00', '#000000', '#ffffff'];
const num = (s) => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? 0 : v; };

// Monta as linhas do roadbook: N tulipas anteriores, a atual e M seguintes (configuráveis).
function montarRb(tul, iA, rb) {
  const out = [];
  if (iA < 0) return out;
  for (let k = rb.ant; k >= 1; k--) if (tul[iA - k]) out.push({ e: tul[iA - k], pct: rb.pAnt, key: 'a' + k });
  if (tul[iA]) out.push({ e: tul[iA], pct: rb.pAtual, atual: true, key: 'c' });
  for (let k = 1; k <= rb.prox; k++) if (tul[iA + k]) out.push({ e: tul[iA + k], pct: rb.pProx[k - 1] ?? 40, key: 'p' + k });
  return out;
}
export function NavTela({ cfg, stage, rs, last, globalDist, odoM, tul, rot, trs, fim, classe, grupos, aviso, cont, onAdj, onPc, onZerar, onClose, onIniciarAgora, onEncerrar, factor, aferRef, onAfer, podeDesfazer, onDesfazer, onW, onEstouAqui }) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const [t, setT] = useState(Date.now());
  const [menu, setMenu] = useState(false);
  const bat = Battery.useBatteryLevel();
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 200); return () => clearInterval(id); }, []);
  const sc = 1;
  const [cv, setCv] = useState({ w: width, h: 600 });
  const lay = getLayout(false);
  useEffect(() => {
    ScreenOrientation.lockAsync(lay.orient === 'h' ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); };
  }, [lay.orient]);
  // velocidade real e T.NAV com extrapolação até o instante atual (o GPS chega ~1 vez por segundo)
  const spd = last && last.spd != null && last.spd >= 0 ? last.spd : null;
  const dt = last ? Math.min(1.5, Math.max(0, (t - last.t) / 1000)) : 0;
  const v = stage.targetKmh / 3.6;
  const tnav0 = rs && rs.aheadSec != null && v > 0 ? rs.aheadSec + (((spd ?? 0) - v) * dt) / v : null;
  const fz = useRef(null);
  if (fim && !fz.current) fz.current = { tnav: Number.isFinite(tnav0) ? tnav0 : null, elapsed: rs && Number.isFinite(rs.elapsed) ? rs.elapsed : null };
  if (!fim) fz.current = null;
  const tnav = fim && fz.current ? fz.current.tnav : (Number.isFinite(tnav0) ? tnav0 : null);
  const fx = tnav != null ? faixaDe(Number(tnav.toFixed(cfg.tnavDec)), cfg) : { bg: '#000', fg: '#fff' };
  // próxima referência (tulipa) e fim do trecho
  const [br, setBr] = useState(null); // índice da referência em consulta (null = segue o GPS)
  useEffect(() => { if (br == null) return; const id = setTimeout(() => setBr(null), 40000); return () => clearTimeout(id); }, [br]);
  const troca = Math.max(0, Number(cfg.rbTroca) || 0);
  const iAt = tul.length ? Math.max(0, tul.findIndex((e) => e.d >= globalDist - troca)) : -1;
  const iAtual = iAt < 0 ? -1 : (tul.findIndex((e) => e.d >= globalDist - troca) < 0 ? tul.length - 1 : iAt);
  const prox = iAtual >= 0 ? tul.find((e, i) => i >= iAtual && e.d - globalDist > -0.5) : null;
  const regRef = prox ? Math.max(0, prox.d - globalDist) : null;
  const prox2 = prox ? tul.find((e) => e.d > prox.d + 0.5) : null;
  const regRef2 = prox2 ? prox2.d - globalDist : null;
  const gi = classe ? grupoIdx(classe, grupos) : 0;
  const trsN = trs && trs.length ? trs : null;
  let trIdx = -1;
  if (trsN) trsN.forEach((t, i) => { if (t.d0 <= globalDist + 1.5) trIdx = i; });
  const dFim = tul.length ? tul[tul.length - 1].d : 0;
  const resolve = (t) => (t ? (t.t === 'D' ? { tipo: 'D', min: t.min, kmh: 0 } : { tipo: 'V', kmh: (t.v && (t.v[gi] ?? t.v[0])) || 0 }) : null);
  const trAtual = trsN ? resolve(trsN[Math.max(0, trIdx)]) : stage.idx >= 0 ? rot.trechos[stage.idx] : null;
  const trProx = trsN ? resolve(trsN[Math.max(0, trIdx) + 1]) : stage.idx >= 0 ? rot.trechos[stage.idx + 1] : null;
  const regTrc0 = trsN ? (stage.idx >= 0 ? Math.max(0, (trIdx + 1 < trsN.length ? trsN[trIdx + 1].d0 : dFim) - globalDist) : null) : (rs && rs.remain != null ? rs.remain : null);
  const regTrc = Number.isFinite(regTrc0) ? regTrc0 : null;
  const placa = (tr) => (tr ? (tr.tipo === 'D' ? { tx: `D${tr.min}'`, d: true } : { tx: String(Math.round(tr.kmh)), d: false }) : null);
  const rb = cfg.rb;
  const zO = trsN ? zeroOff(trsN, globalDist) : 0;
  const iShow = br != null && tul.length ? Math.max(0, Math.min(tul.length - 1, br)) : iAtual;
  const linhasRb = montarRb(tul, iShow, rb).map((l) => (trsN && l.e.d != null ? { ...l, e: { ...l.e, d: l.e.d - zeroOff(trsN, l.e.d) } } : l));
  const d = {
    cfg, spd, tnav, fx, odoM: odoM - zO, factor, aferRef, onAfer: () => confirma('Aferir hodômetro', `Você está na referência ${aferRef ? aferRef.n : ''} (km ${aferRef ? aferRef.kmShow.toFixed(3) : ''}). Ajuste o hodômetro até bater com o km da tulipa e confirme. O app recalcula o W%.`, onAfer), regRef, regRef2, regTrc, pa: placa(trAtual), pp: placa(trProx), clock: last ? last.t : t, acc: last ? last.acc : null,
    trN: trsN ? (stage.idx >= 0 && trIdx >= 0 ? `${trIdx + 1}/${trsN.length}` : null) : stage.idx >= 0 ? `${stage.idx + 1}/${rot.trechos.length}` : null, fim: !!fim, refN: iAtual >= 0 ? `${iAtual + 1}/${tul.length}` : null,
    kmAcum: globalDist - zO, trs: trsN, rbBr: br != null,
    onRbTap: () => setBr(iAtual >= 0 ? iAtual : 0), onRbPrev: () => setBr((b) => Math.max(0, (b ?? 0) - 1)), onRbNext: () => setBr((b) => Math.min(tul.length - 1, (b ?? 0) + 1)), onRbSair: () => setBr(null),
    onRbAqui: () => { const e = tul[iShow]; if (e && onEstouAqui) onEstouAqui(e.d); setBr(null); }, bat: bat, elapsed: fim && fz.current ? fz.current.elapsed : rs && Number.isFinite(rs.elapsed) ? rs.elapsed : null, rbLinhas: iShow >= 0 ? linhasRb : null, classe, grupos, edit: false, onAdj, onPc,
  };
  // Espelho para o celular do piloto (mesma conta): publica os valores a cada 2 s.
  const espRef = useRef(null);
  espRef.current = {
    spd: spd ?? null, tnav: tnav ?? null, odoM: Number.isFinite(odoM) ? odoM : 0, regRef: regRef ?? null, regRef2: regRef2 ?? null, regTrc: regTrc ?? null,
    pa: d.pa || null, pp: d.pp || null, acc: d.acc ?? null, trN: d.trN || null, refN: d.refN || null, kmAcum: d.kmAcum ?? 0,
    bat: d.bat ?? -1, elapsed: d.elapsed ?? null, iAtual, aviso: aviso || '', fim: !!fim,
  };
  useEffect(() => { const id = setInterval(() => { publicarEspelho(espRef.current).catch(() => {}); }, 2000); return () => clearInterval(id); }, []);
  const confirma = (tit, msg, fn) => { setMenu(false); Alert.alert(tit, msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: fn }]); };

  return (
    <Modal visible animationType="fade" onRequestClose={() => setMenu(true)}><Seguro>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 26 }}>
        {aviso ? <View style={{ backgroundColor: '#c0392b', padding: 6 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800', fontSize: 16 }}>{aviso}</Text></View> : null}
        <View style={{ height: TOPO, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 10, backgroundColor: '#111' }}>
          <Text style={{ flex: 1, color: '#777', fontSize: 12 }} numberOfLines={1}>{lay.nome}</Text>
          <TouchableOpacity onPress={() => setMenu((m) => !m)} style={{ padding: 8 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>⋮</Text></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }} onLayout={(e) => setCv({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {lay.items.map((it) => (
            <View key={it.id} style={{ position: 'absolute', left: it.x * cv.w, top: it.y * cv.h, width: it.w * cv.w, height: it.h * cv.h }}>
              <Bloco tipo={it.tipo} d={d} w={it.w * cv.w} h={it.h * cv.h} />
            </View>
          ))}
          {cont != null && cont > 0 && cont <= 10 ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={cv.w} height={cv.h}>
                <SvgText x={cv.w / 2} y={cv.h / 2 + Math.min(cv.w, cv.h) * 0.3} fontSize={Math.min(cv.w, cv.h) * 0.85} fontWeight="bold" fill="none" stroke="#ffe600" strokeWidth={Math.max(4, Math.min(cv.w, cv.h) * 0.02)} textAnchor="middle">{String(Math.ceil(cont))}</SvgText>
              </Svg>
            </View>
          ) : null}
        </View>
        {fim && onEncerrar ? (
          <TouchableOpacity style={{ position: 'absolute', left: 12, right: 12, bottom: 24, backgroundColor: '#c0392b', borderRadius: 12, paddingVertical: 18, alignItems: 'center', elevation: 6 }} onPress={() => confirma('Encerrar a prova', 'Confirma que você terminou a prova? O T.NAV para e você volta à tela da prova.', onEncerrar)}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>ENCERRAR PROVA</Text>
          </TouchableOpacity>
        ) : null}
        {menu && (
          <View style={{ position: 'absolute', top: 26 + TOPO, right: 10, zIndex: 9, backgroundColor: '#fff', borderRadius: 8, padding: 6, elevation: 8 }}>
            {aferRef ? <TouchableOpacity style={{ padding: 12 }} onPress={() => confirma('Aferir hodômetro', `Referência ${aferRef.n} · km ${aferRef.kmShow.toFixed(3)}. Confirma aferir agora? O app recalcula o W%.`, onAfer)}><Text style={{ fontSize: 16, color: '#000', fontWeight: '800' }}>AFERIR agora (W% {(factor * 1000).toFixed(2)})</Text></TouchableOpacity> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
              <TouchableOpacity style={{ padding: 10 }} onPress={() => onW && onW(-1)}><Text style={{ fontSize: 18, color: '#000' }}>−1</Text></TouchableOpacity>
              <TouchableOpacity style={{ padding: 10 }} onPress={() => onW && onW(-0.1)}><Text style={{ fontSize: 18, color: '#000' }}>−0,1</Text></TouchableOpacity>
              <Text style={{ fontSize: 16, color: '#000', fontWeight: '800', paddingHorizontal: 6 }}>W% {(factor * 1000).toFixed(2)}</Text>
              <TouchableOpacity style={{ padding: 10 }} onPress={() => onW && onW(0.1)}><Text style={{ fontSize: 18, color: '#000' }}>+0,1</Text></TouchableOpacity>
              <TouchableOpacity style={{ padding: 10 }} onPress={() => onW && onW(1)}><Text style={{ fontSize: 18, color: '#000' }}>+1</Text></TouchableOpacity>
            </View>
            {podeDesfazer ? <TouchableOpacity style={{ padding: 12 }} onPress={() => confirma('Desfazer aferição', 'Voltar ao W% e ao hodômetro de antes da última aferição?', onDesfazer)}><Text style={{ fontSize: 16, color: '#c0392b', fontWeight: '800' }}>Desfazer última aferição</Text></TouchableOpacity> : null}
            <TouchableOpacity style={{ padding: 12 }} onPress={() => confirma('Zerar odômetro', 'Zerar o odômetro (GPS) agora? Não altera o T.NAV nem a posição no roadbook.', onZerar)}><Text style={{ fontSize: 16, color: '#000' }}>Zerar odômetro</Text></TouchableOpacity>
            {onIniciarAgora ? <TouchableOpacity style={{ padding: 12 }} onPress={() => confirma('Iniciar agora', 'Iniciar o trecho 1 agora, sem esperar a hora da largada?', onIniciarAgora)}><Text style={{ fontSize: 16, color: '#000' }}>Iniciar trecho agora</Text></TouchableOpacity> : null}
            <TouchableOpacity style={{ padding: 12 }} onPress={() => confirma('Sair da tela de prova', 'Voltar ao menu? O trecho e o GPS continuam.', onClose)}><Text style={{ fontSize: 16, color: '#000' }}>Sair da tela de prova</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => setMenu(false)}><Text style={{ fontSize: 16, color: '#666' }}>Fechar menu</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </Seguro></Modal>
  );
}

// ---------- Modo piloto: espelho do navegador (mesma conta de e-mail) ----------
export function PilotoTela({ cfg, tul, classe, grupos, onPersonalizar, onClose }) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const [t, setT] = useState(Date.now());
  const [esp, setEsp] = useState(null);
  const [menu, setMenu] = useState(false);
  const [cv, setCv] = useState({ w: width, h: 600 });
  const recv = useRef(0);
  const lay = getLayout(true);
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 500); return () => clearInterval(id); }, []);
  useEffect(() => ouvirEspelho((e) => { recv.current = Date.now(); setEsp(e); }, () => {}), []);
  useEffect(() => {
    ScreenOrientation.lockAsync(lay.orient === 'h' ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); };
  }, [lay.orient]);
  const idade = recv.current ? (t - recv.current) / 1000 : null;
  const e = esp || {};
  const fx = e.tnav != null ? faixaDe(Number(e.tnav.toFixed(cfg.tnavDec)), cfg) : { bg: '#000', fg: '#fff' };
  const rb = cfg.rb;
  const iA = e.iAtual != null ? e.iAtual : -1;
  const linhas = iA >= 0 && tul[iA] ? montarRb(tul, iA, rb) : [];
  const d = {
    cfg, spd: e.spd ?? null, tnav: e.tnav ?? null, fx, odoM: e.odoM || 0, regRef: e.regRef ?? null, regRef2: e.regRef2 ?? null, regTrc: e.regTrc ?? null,
    pa: e.pa || null, pp: e.pp || null, clock: t, acc: e.acc ?? null, trN: e.trN, refN: e.refN, kmAcum: e.kmAcum || 0, bat: e.bat ?? -1, elapsed: e.elapsed ?? null,
    rbLinhas: linhas.length ? linhas : null, classe, grupos, edit: false, fim: !!e.fim, onAdj: () => {}, onPc: () => {},
  };
  const aviso = !esp ? 'Aguardando o navegador… (mesma conta de e-mail, com internet)' : idade != null && idade > 8 ? `Sem sincronismo com o navegador há ${Math.round(idade)} s` : '';
  return (
    <Modal visible animationType="fade" onRequestClose={() => setMenu(true)}><Seguro>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 26 }}>
        {aviso ? <View style={{ backgroundColor: '#c0392b', padding: 6 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800', fontSize: 15 }}>{aviso}</Text></View> : null}
        <View style={{ height: TOPO, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 10, backgroundColor: '#111' }}>
          <Text style={{ flex: 1, color: '#777', fontSize: 12 }} numberOfLines={1}>Piloto · {lay.nome}</Text>
          <TouchableOpacity onPress={() => setMenu((m) => !m)} style={{ padding: 8 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>⋮</Text></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }} onLayout={(ev) => setCv({ w: ev.nativeEvent.layout.width, h: ev.nativeEvent.layout.height })}>
          {lay.items.map((it) => (
            <View key={it.id} style={{ position: 'absolute', left: it.x * cv.w, top: it.y * cv.h, width: it.w * cv.w, height: it.h * cv.h }}>
              <Bloco tipo={it.tipo} d={d} w={it.w * cv.w} h={it.h * cv.h} />
            </View>
          ))}
        </View>
        {menu && (
          <View style={{ position: 'absolute', top: 26 + TOPO, right: 10, zIndex: 9, backgroundColor: '#fff', borderRadius: 8, padding: 6, elevation: 8 }}>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => { setMenu(false); onPersonalizar(); }}><Text style={{ fontSize: 16, color: '#000' }}>Personalizar tela</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => { setMenu(false); Alert.alert('Sair do modo piloto', 'Voltar ao menu?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', onPress: onClose }]); }}><Text style={{ fontSize: 16, color: '#000' }}>Sair do modo piloto</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => setMenu(false)}><Text style={{ fontSize: 16, color: '#666' }}>Fechar menu</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </Seguro></Modal>
  );
}

// ---------- Personalização (antes da prova) ----------
function Opc({ st, on, tx, onPress }) { return <TouchableOpacity style={[st.chip, { paddingHorizontal: 12, paddingVertical: 8 }, on && { backgroundColor: '#ff7a2e' }]} onPress={onPress}><Text style={[st.btn2Tx, on && { color: '#0c1014' }]}>{tx}</Text></TouchableOpacity>; }
function Num({ st, v, on, w = 56 }) { return <TextInput style={[st.input, { minWidth: w }]} defaultValue={String(v)} keyboardType="numbers-and-punctuation" onEndEditing={(e) => on(num(e.nativeEvent.text))} />; }
function Lin({ st, tx, children }) { return <View style={st.line}><Text style={st.k}>{tx}</Text>{children}</View>; }
export function NavConfig({ st, visible, onClose, piloto }) {
  const [c, setC] = useState(loadNav);
  const [L, setL] = useState(loadLayouts);
  const [edit, setEdit] = useState(null);
  const [nomeNovo, setNomeNovo] = useState('');
  const [orN, setOrN] = useState('v');
  const sk = piloto ? 'selP' : 'sel';
  const gravaL = (n) => { saveLayouts(n); setL(n); };
  const meus = L.list.filter((x) => !!x.piloto === !!piloto);
  const todos = [padraoDe('v', piloto), padraoDe('h', piloto), ...meus];
  const atualL = todos.find((x) => x.id === L[sk]) || todos[0];
  const copia = (nome, orient) => ({ id: novoId(), nome, piloto: !!piloto, orient, items: padraoDe(orient, piloto).items.map((x, i) => ({ ...x, id: 'n' + i })) });
  const alterar = () => {
    if (atualL.id === 'padrao' || atualL.id === 'padraoh') {
      const novo = copia('Meu layout', atualL.orient);
      gravaL({ ...L, [sk]: novo.id, list: [...L.list, novo] });
      setEdit(novo);
    } else setEdit(atualL);
  };
  const criar = () => {
    const nome = nomeNovo.trim();
    if (!nome) return Alert.alert('Falta o nome', 'Dê um nome para o novo layout.');
    const novo = copia(nome, orN);
    gravaL({ ...L, [sk]: novo.id, list: [...L.list, novo] });
    setNomeNovo(''); setEdit(novo);
  };
  const apagarL = (x) => Alert.alert('Apagar layout', `Apagar "${x.nome}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => gravaL({ ...L, [sk]: L[sk] === x.id ? 'padrao' : L[sk], list: L.list.filter((y) => y.id !== x.id) }) }]);
  const up = (fn) => { const n = JSON.parse(JSON.stringify(c)); fn(n); saveNav(n); setC(n); };
  return (
    <Tela visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0c1014', paddingTop: 8 }}>
        <Text style={[st.tip, { paddingHorizontal: 12 }]}>Personalizar a tela da prova</Text>
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
          <View style={st.card}>
            <Text style={st.tip}>Layout da tela</Text>
            <Text style={st.tipTx}>Cada layout é uma tela montada por você: blocos que você arrasta e redimensiona. Toque para escolher o usado na prova.</Text>
            {todos.map((x) => (
              <View key={x.id} style={[st.line, { alignItems: 'center', paddingVertical: 8 }]}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => gravaL({ ...L, [sk]: x.id })}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#4fc3f7', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>{L[sk] === x.id ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#4fc3f7' }} /> : null}</View>
                  <Text style={st.v}>{x.nome} · {x.orient === 'h' ? 'horizontal' : 'vertical'}{x.id.startsWith('padrao') ? ' (original)' : ''}</Text>
                </TouchableOpacity>
                {!x.id.startsWith('padrao') && <TouchableOpacity onPress={() => apagarL(x)}><Text style={{ color: '#ff5252', fontWeight: '700' }}>apagar</Text></TouchableOpacity>}
              </View>
            ))}
            <TouchableOpacity style={[st.btn, { marginTop: 8, marginBottom: 0 }]} onPress={alterar}><Text style={st.btnTx}>ALTERAR LAYOUT</Text></TouchableOpacity>
            <TextInput style={st.field} value={nomeNovo} onChangeText={setNomeNovo} placeholder="Nome do novo layout" placeholderTextColor="#666" />
            <View style={[st.row, { marginTop: 6 }]}>{[['v', 'Vertical'], ['h', 'Horizontal']].map(([k, t]) => <TouchableOpacity key={k} style={[st.btn2, orN === k && { backgroundColor: '#ff7a2e' }]} onPress={() => setOrN(k)}><Text style={[st.btn2Tx, orN === k && { color: '#0c1014' }]}>{t}</Text></TouchableOpacity>)}</View>
            <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={criar}><Text style={st.btn2Tx}>+ CRIAR NOVO LAYOUT</Text></TouchableOpacity>
          </View>
          <View style={st.card}>
            <Text style={st.tip}>T.NAV</Text>
            <Text style={st.tipTx}>Mais (+) = adiantado, menos (−) = atrasado, em segundos.</Text>
            <View style={[st.row, { marginTop: 6 }]}>
              {[0, 1, 2].map((d) => <Opc st={st} key={d} on={c.tnavDec === d} tx={`${d} casa${d === 1 ? '' : 's'}`} onPress={() => up((o) => { o.tnavDec = d; return o; })} />)}
            </View>
            <Text style={st.tip}>Cores por faixa de segundos (fora das faixas: fundo preto, letra branca)</Text>
            {c.faixas.map((f, i) => (
              <View key={i} style={[st.line, { alignItems: 'center' }]}>
                <Num st={st} v={f.a} on={(v) => up((o) => { o.faixas[i].a = v; return o; })} />
                <Text style={st.k}>até</Text>
                <Num st={st} v={f.b} on={(v) => up((o) => { o.faixas[i].b = v; return o; })} />
                <TouchableOpacity onPress={() => up((o) => { o.faixas[i].bg = CORES[(CORES.indexOf(o.faixas[i].bg) + 1) % CORES.length]; return o; })} style={{ width: 44, height: 34, borderRadius: 6, backgroundColor: f.bg, borderWidth: 1, borderColor: '#888' }} />
                <TouchableOpacity onPress={() => up((o) => { o.faixas.splice(i, 1); return o; })}><Text style={{ color: '#ff5252', fontWeight: '700' }}>remover</Text></TouchableOpacity>
              </View>
            ))}
            <View style={[st.row, { marginTop: 6, marginBottom: 0 }]}>
              <TouchableOpacity style={st.btn2} onPress={() => up((o) => { o.faixas.push({ a: -1, b: 1, bg: '#43a047' }); return o; })}><Text style={st.btn2Tx}>Adicionar faixa</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn2} onPress={() => up((o) => { o.faixas = NAV_PADRAO.faixas; return o; })}><Text style={st.btn2Tx}>Padrão</Text></TouchableOpacity>
            </View>
            <Text style={st.tipTx}>Toque no quadrado para trocar a cor. Vale a primeira faixa que contém o valor.</Text>
          </View>
          {[['ref', 'REG REF (até a próxima referência)'], ['trc', 'PRÓX. TRECHO (distância até o próximo trecho)'], ['odo', 'ODÔMETRO (GPS)']].map(([k, nome]) => (
            <View key={k} style={st.card}>
              <Text style={st.tip}>{nome}</Text>
              <View style={[st.row, { marginTop: 6 }]}>
                <Opc st={st} on={c[k].un === 'm'} tx="metros" onPress={() => up((o) => { o[k].un = 'm'; return o; })} />
                <Opc st={st} on={c[k].un === 'km'} tx="km" onPress={() => up((o) => { o[k].un = 'km'; o[k].dec = 3; return o; })} />
              </View>
              <View style={st.row}>
                {[0, 1, 2, 3].map((d) => <Opc st={st} key={d} on={c[k].dec === d} tx={`${d} casas`} onPress={() => up((o) => { o[k].dec = d; return o; })} />)}
              </View>
            </View>
          ))}
          <View style={st.card}>
            <Text style={st.tip}>Barra regressiva (REG REF)</Text>
            <Text style={st.tipTx}>A janela vai se preenchendo de cor conforme os metros diminuem, e fica cheia em zero. Depois a próxima referência já aparece vazia.</Text>
            <Lin st={st} tx="Ativar a barra"><Switch value={!!c.barra.on} onValueChange={(v) => up((o) => { o.barra.on = v; return o; })} /></Lin>
            <Text style={st.tipTx}>Começa a preencher quando faltar (metros):</Text>
            <View style={[st.row, { marginTop: 6 }]}>
              {[50, 100, 150, 200].map((m) => <Opc st={st} key={m} on={c.barra.ini === m} tx={`${m} m`} onPress={() => up((o) => { o.barra.ini = m; return o; })} />)}
            </View>
            <Lin st={st} tx="Outro valor (m)"><Num st={st} v={c.barra.ini} on={(v) => up((o) => { o.barra.ini = Math.max(10, Math.min(1000, Math.round(v))); return o; })} /></Lin>
            <Lin st={st} tx="Cor da barra"><TouchableOpacity onPress={() => up((o) => { o.barra.cor = CORES[(CORES.indexOf(o.barra.cor) + 1) % CORES.length]; return o; })} style={{ width: 44, height: 34, borderRadius: 6, backgroundColor: c.barra.cor, borderWidth: 1, borderColor: '#888' }} /></Lin>
          </View>
          <View style={st.card}>
            <Text style={st.tip}>Roadbook na tela</Text>
            <Lin st={st} tx="Trocar tulipa após passar (m) — 0 = na hora"><Num st={st} v={c.rbTroca || 0} on={(v) => up((o) => { o.rbTroca = Math.max(0, Math.min(100, Math.round(v))); return o; })} /></Lin>
            <Lin st={st} tx="Tulipas anteriores (0 a 4)"><Num st={st} v={c.rb.ant} on={(v) => up((o) => { o.rb.ant = Math.max(0, Math.min(4, Math.round(v))); return o; })} /></Lin>
            <Lin st={st} tx="Tulipas seguintes (0 a 8)"><Num st={st} v={c.rb.prox} on={(v) => up((o) => { o.rb.prox = Math.max(0, Math.min(8, Math.round(v))); return o; })} /></Lin>
            <Text style={st.tipTx}>A janela do roadbook é dividida entre as tulipas nessa proporção (30 a 150):</Text>
            <Lin st={st} tx="Anterior"><Num st={st} v={c.rb.pAnt} on={(v) => up((o) => { o.rb.pAnt = Math.max(30, Math.min(150, v)); return o; })} /></Lin>
            <Lin st={st} tx="Atual (a principal)"><Num st={st} v={c.rb.pAtual} on={(v) => up((o) => { o.rb.pAtual = Math.max(30, Math.min(150, v)); return o; })} /></Lin>
            {Array.from({ length: Math.min(8, c.rb.prox) }, (_, i) => i).map((i) => <Lin key={i} st={st} tx={`Seguinte ${i + 1}`}><Num st={st} v={c.rb.pProx[i] ?? 40} on={(v) => up((o) => { o.rb.pProx[i] = Math.max(30, Math.min(150, v)); return o; })} /></Lin>)}
          </View>
          <TouchableOpacity style={[st.btn, { marginTop: 4 }]} onPress={onClose}><Text style={st.btnTx}>Pronto</Text></TouchableOpacity>
        </ScrollView>
      </View>
      {edit && <Erro onClose={() => setEdit(null)}><LayoutEditor layout={edit} cfg={c} piloto={piloto} onSalvar={(lay) => gravaL({ ...L, list: L.list.map((y) => (y.id === lay.id ? lay : y)) })} onClose={() => setEdit(null)} /></Erro>}
    </Tela>
  );
}
