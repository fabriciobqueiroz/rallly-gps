// Tela do navegador (durante a prova) e tela de personalização (antes da prova).
// Durante a prova nada é editável, só os botões de correção (+10 m, -10 m, PC) e o menu ⋮.
import { zeroOff } from './rally';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Share, Switch, Vibration, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Tela from './Tela';
import * as Battery from 'expo-battery';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ouvirEspelho, publicarEspelho } from './firebase';
import { grupoIdx } from './rally';
import Svg, { Text as SvgText } from 'react-native-svg';
import { useKeepAwake } from 'expo-keep-awake';
import { loadJson, saveJson } from './persist';
import { setFiltroGps } from './store';
import { Bloco, FMT_DIST, fmtCodigo, fmtDist, fmtTnav, faixaDe } from './Blocos';
import Erro from './Erro';
import Seguro from './Seguro';
import LayoutEditor, { TOPO } from './LayoutEditor';
import { COR } from './Pos';
import { bipe, falar, vozesPt } from './Som';
import { useBotoeira } from './Botoeira';
import { getLayout, loadLayouts, novoId, padraoDe, saveLayouts } from './NavLayout';

export { fmtDist, fmtTnav, faixaDe };

export const NAV_PADRAO = {
  tiles: { odo: true, tnav: true, vel: true, regref: true, atual: true, prox: true, regtrc: true, pm: true, bat: true, rb: true },
  tnavDec: 1,
  tn: { adi: { bg: '#1e88e5', fg: '#ffffff' }, no: { bg: '#f5e50f', fg: '#000000' }, atr: { bg: '#e53935', fg: '#ffffff' }, limAdi: 3, limAtr: 3, fmt: 'sd', bipe: false, bipeAdi: [1.5, 10], bipeAtr: [0.5, 10], paleta: [] },
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
  barraRef: { on: true, ini: 100, aqui: 50, cor: '#e53935' },
  barraTrc: { on: true, ini: 100, cor: '#00b3d6' },
  odoCor: { fg: '#ffffff', bg: '#000000' },
  trans: { dist: 0, tempo: 0, prox: 0 },
  gps: { vmin: 3, dmin: 0 },
  bot: { inc: 1, vol: { up: 'inc', down: 'dec' }, comp: { pri: 'lap', sec: 'w', incr: 'inc', decr: 'dec', inv: false }, logg: { pri: 'aqui', sec: 'w', incr: 'inc', decr: 'dec' } },
  som: { bipeRef: true, bipeTrc: true, falaTrc: true, vel: 1, voz: null, volBipe: 1, volFala: 1, dist: { 10: { d: true, a: false, m: false }, 20: { d: false, a: false, m: false }, 30: { d: false, a: false, m: false }, 50: { d: false, a: false, m: false }, 100: { d: true, a: false, m: false }, 200: { d: false, a: false, m: false }, 300: { d: false, a: false, m: false } } },
  refs: { ocultar3: false, parcial: true, fmtP: 'k3' },
};
export const loadNav = () => {
  const c = loadJson('navcfg', {});
  if (c && c.tnavDec > 2) c.tnavDec = 2;
  if (c && c.barra && !c.barraRef) { c.barraRef = { on: c.barra.on, ini: c.barra.ini, aqui: 50, cor: c.barra.cor }; c.barraTrc = { on: c.barra.on, ini: c.barra.ini, cor: '#00b3d6' }; }
  if (c && !c.trans && Number(c.rbTroca) > 0) c.trans = { dist: Number(c.rbTroca), tempo: 0, prox: 0 };
  return { ...NAV_PADRAO, ...c, trans: { ...NAV_PADRAO.trans, ...(c.trans || {}) }, gps: { ...NAV_PADRAO.gps, ...(c.gps || {}) }, bot: { ...NAV_PADRAO.bot, ...(c.bot || {}), vol: { ...NAV_PADRAO.bot.vol, ...((c.bot && c.bot.vol) || {}) }, comp: { ...NAV_PADRAO.bot.comp, ...((c.bot && c.bot.comp) || {}) }, logg: { ...NAV_PADRAO.bot.logg, ...((c.bot && c.bot.logg) || {}) } }, barraRef: { ...NAV_PADRAO.barraRef, ...(c.barraRef || {}) }, barraTrc: { ...NAV_PADRAO.barraTrc, ...(c.barraTrc || {}) }, odoCor: { ...NAV_PADRAO.odoCor, ...(c.odoCor || {}) }, refs: { ...NAV_PADRAO.refs, ...(c.refs || {}) }, som: { ...NAV_PADRAO.som, ...(c.som || {}), dist: { ...NAV_PADRAO.som.dist, ...((c.som && c.som.dist) || {}) } }, tn: { ...NAV_PADRAO.tn, ...(c.tn || {}) }, tiles: { ...NAV_PADRAO.tiles, ...(c.tiles || {}) }, ref: { ...NAV_PADRAO.ref, ...(c.ref || {}) }, trc: { ...NAV_PADRAO.trc, ...(c.trc || {}) }, odo: { ...NAV_PADRAO.odo, ...(c.odo || {}) }, rb: { ...NAV_PADRAO.rb, ...(c.rb || {}) }, barra: { ...NAV_PADRAO.barra, ...(c.barra || {}) } };
};
export const saveNav = (c) => { setFiltroGps(c.gps); saveJson('navcfg', c); };
try { setFiltroGps(loadNav().gps); } catch {}

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
  const [kp, setKp] = useState(null); // teclado numérico: { tipo: 'ref' | 'trc', v: '' }
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
  const bipeRef = useRef(0);
  useEffect(() => {
    const t = cfg.tn;
    if (!t || !t.bipe || fim || !Number.isFinite(tnav)) return;
    const k = -tnav; // negativo = adiantado
    const agora = Date.now();
    if (k <= -t.bipeAdi[0] && k >= -t.bipeAdi[1] && agora - bipeRef.current > 3000) { bipeRef.current = agora; bipe('adi', cfg.som.volBipe); }
    else if (k >= t.bipeAtr[0] && k <= t.bipeAtr[1] && agora - bipeRef.current > 3000) { bipeRef.current = agora; bipe('atr', cfg.som.volBipe); }
  }, [tnav == null ? null : Math.round(tnav)]);
  const fx = tnav != null ? faixaDe(-Number(tnav.toFixed(cfg.tnavDec)), cfg) : { bg: '#000', fg: '#fff' };
  // próxima referência (tulipa) e fim do trecho
  const [br, setBr] = useState(null); // índice da referência em consulta (null = segue o GPS)
  useEffect(() => { if (br == null) return; const id = setTimeout(() => setBr(null), 40000); return () => clearTimeout(id); }, [br]);
  // Transição de referências: a referência que acabou de passar continua em destaque até uma das condições (as que estão acima de 0) ser atendida.
  const tr = cfg.trans || { dist: 0, tempo: 0, prox: 0 };
  const ib = tul.length ? tul.findIndex((e) => e.d >= globalDist) : -1;
  const passou = useRef({ ib: null, t: 0 });
  useEffect(() => { passou.current = { ib, t: Date.now() }; }, [ib]);
  const segura = ib > 0 && (tr.dist > 0 || tr.tempo > 0 || tr.prox > 0)
    && !((tr.dist > 0 && globalDist - tul[ib - 1].d >= tr.dist) || (tr.tempo > 0 && passou.current.ib === ib && t - passou.current.t >= tr.tempo * 1000) || (tr.prox > 0 && tul[ib].d - globalDist <= tr.prox));
  const iAtual = !tul.length ? -1 : ib < 0 ? tul.length - 1 : segura ? ib - 1 : ib;
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
  const regTrc0 = trsN ? Math.max(0, (trIdx + 1 < trsN.length ? trsN[trIdx + 1].d0 : dFim) - globalDist) : (rs && rs.remain != null ? rs.remain : null);
  const regTrc = Number.isFinite(regTrc0) ? regTrc0 : null;
  // Alertas sonoros: mudança de referência e de trecho, fala do trecho e avisos por distância antes da referência.
  const som = cfg.som;
  const ant = useRef({ ref: null, trc: null, regRef: null });
  useEffect(() => {
    if (fim) return;
    if (ant.current.ref != null && iAtual >= 0 && iAtual !== ant.current.ref && som.bipeRef) bipe('ref', som.volBipe);
    ant.current.ref = iAtual; ant.current.regRef = null;
  }, [iAtual]);
  useEffect(() => {
    if (fim) return;
    if (ant.current.trc != null && trIdx >= 0 && trIdx !== ant.current.trc) {
      if (som.bipeTrc) bipe('trc', som.volBipe);
      if (som.falaTrc) setTimeout(() => falar(`Trecho ${trIdx + 1}. ${Math.round(stage.targetKmh)} quilômetros por hora.`, { vel: som.vel, vol: som.volFala, voz: som.voz }), som.bipeTrc ? 600 : 0);
    }
    ant.current.trc = trIdx;
  }, [trIdx]);
  useEffect(() => {
    if (fim || regRef == null) return;
    const p = ant.current.regRef;
    ant.current.regRef = regRef;
    if (p == null || !prox) return;
    Object.keys(som.dist).forEach((k) => {
      const lim = Number(k), o = som.dist[k];
      if (p > lim && regRef <= lim && (o.d || (o.a && prox.afer))) bipe('dist', som.volBipe);
    });
  }, [regRef == null ? null : Math.round(regRef)]);
  const placa = (tr) => (tr ? (tr.tipo === 'D' ? { tx: `D${tr.min}'`, d: true } : { tx: String(Math.round(tr.kmh)), d: false }) : null);
  const rb = cfg.rb;
  const zO = trsN ? zeroOff(trsN, globalDist) : 0;
  const iShow = br != null && tul.length ? Math.max(0, Math.min(tul.length - 1, br)) : iAtual;
  const linhasRb = montarRb(tul, iShow, rb).map((l) => (trsN && l.e.d != null ? { ...l, e: { ...l.e, d: l.e.d - zeroOff(trsN, l.e.d) } } : l));
  const d = {
    cfg, spd, tnav, fx, odoM: odoM - zO, adj: stage && stage.adjust, factor, aferRef, onAfer: () => confirma('Aferir hodômetro', `Você está na referência ${aferRef ? aferRef.n : ''} (km ${aferRef ? aferRef.kmShow.toFixed(3) : ''}). Ajuste o hodômetro até bater com o km da tulipa e confirme. O app recalcula o W%.`, onAfer), regRef, regRef2, regTrc, pa: placa(trAtual), pp: placa(trProx), ntProx: (tul.find((e) => e.t === 'P' && e.nt > 0 && e.d >= globalDist - 15) || {}).nt || null, clock: last ? last.t : t, acc: last ? last.acc : null,
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
  const irPara = () => {
    const n = parseInt(kp.v, 10);
    if (!Number.isFinite(n)) return;
    let idx = -1;
    if (kp.tipo === 'ref') idx = tul.findIndex((e, i) => (e.rn != null ? e.rn === n : i + 1 === n));
    else if (trsN && trsN[n - 1]) idx = tul.findIndex((e) => e.d >= trsN[n - 1].d0 - 0.5);
    if (idx < 0) { Alert.alert(kp.tipo === 'ref' ? 'Referência não encontrada' : 'Trecho não encontrado', `Não existe ${kp.tipo === 'ref' ? 'a referência' : 'o trecho'} ${n} nesta prova.`); return; }
    setKp(null); setBr(idx);
  };
  const confirma = (tit, msg, fn) => { setMenu(false); Alert.alert(tit, msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: fn }]); };

  // Botoeira: volume + e volume − (celular ou fone com fio) executam as ações escolhidas em Configurações > Botoeira.
  useBotoeira(!fim, (dir) => {
    const b = cfg.bot, acao = dir === 'up' ? b.vol.up : b.vol.down, inc = Number(b.inc) || 1;
    Vibration.vibrate(30);
    if (acao === 'inc') onAdj && onAdj(inc);
    else if (acao === 'dec') onAdj && onAdj(-inc);
    else if (acao === 'w') onW && onW(dir === 'up' ? 0.1 : -0.1);
    else if (acao === 'aqui') { const e = tul[iShow]; if (e && onEstouAqui) onEstouAqui(e.d); }
    else if (acao === 'afer') { if (aferRef && d.onAfer) d.onAfer(); }
  });
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
        {kp && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 10, backgroundColor: '#0c1014', padding: 14, justifyContent: 'center' }}>
            <View style={{ backgroundColor: '#000', borderRadius: 16, borderWidth: 1, borderColor: '#262b32', paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#ff7a2e', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>{kp.tipo === 'ref' ? 'IR PARA REFERÊNCIA' : 'IR PARA TRECHO'}</Text>
              <Text style={{ color: '#fff', fontSize: 64, fontWeight: '900', minHeight: 80 }}>{kp.v || ' '}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'ESC', '0', '⌫'].map((k) => (
                <TouchableOpacity key={k} onPress={() => setKp((o) => (k === 'ESC' ? null : k === '⌫' ? { ...o, v: o.v.slice(0, -1) } : { ...o, v: (o.v + k).slice(0, 3) }))}
                  style={{ width: '31.5%', height: 74, marginBottom: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'ESC' ? '#ef5350' : k === '⌫' ? '#fff200' : '#f5f5f5' }}>
                  <Text style={{ color: '#000', fontSize: k.length > 1 ? 24 : 34, fontWeight: '900' }}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={irPara} style={{ height: 70, borderRadius: 14, backgroundColor: '#00d672', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#000', fontSize: 30, fontWeight: '900' }}>OK</Text></TouchableOpacity>
          </View>
        )}
        {menu && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 9 }}>
            <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setMenu(false)} />
            <View style={{ backgroundColor: '#151a21', borderTopWidth: 2, borderTopColor: '#ff7a2e', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 12 }}>
              <Text style={{ color: '#ff7a2e', textAlign: 'center', fontWeight: '900', fontSize: 14, letterSpacing: 1, marginBottom: 8 }}>MENU</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1b212a', borderRadius: 12, borderWidth: 1, borderColor: '#262b32', marginBottom: 8 }}>
                {[['−1', -1], ['−0,1', -0.1]].map(([t, v]) => <TouchableOpacity key={t} style={{ padding: 12 }} onPress={() => onW && onW(v)}><Text style={{ fontSize: 18, color: '#fff', fontWeight: '800' }}>{t}</Text></TouchableOpacity>)}
                <Text style={{ fontSize: 16, color: '#ff7a2e', fontWeight: '900', paddingHorizontal: 8 }}>W% {(factor * 1000).toFixed(2)}</Text>
                {[['+0,1', 0.1], ['+1', 1]].map(([t, v]) => <TouchableOpacity key={t} style={{ padding: 12 }} onPress={() => onW && onW(v)}><Text style={{ fontSize: 18, color: '#fff', fontWeight: '800' }}>{t}</Text></TouchableOpacity>)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  ['⌖', aferRef ? 'AFERIR' : 'AFER (sem ref.)', () => (aferRef ? confirma('Aferir hodômetro', `Referência ${aferRef.n} · km ${aferRef.kmShow.toFixed(3)}. Confirma aferir agora? O app recalcula o W%.`, onAfer) : (setMenu(false), Alert.alert('Aferição', 'Chegue perto de uma referência marcada como AFER (até 80 m) para aferir.'))), !aferRef],
                  ...(podeDesfazer ? [['↶', 'Desfazer aferição', () => confirma('Desfazer aferição', 'Voltar ao W% e ao hodômetro de antes da última aferição?', onDesfazer)]] : []),
                  ['⟳', 'Zerar odômetro', () => confirma('Zerar odômetro', 'Zerar o odômetro (GPS) agora? Não altera o T.NAV nem a posição no roadbook.', onZerar)],
                  ...(onIniciarAgora ? [['▶', 'Iniciar trecho agora', () => confirma('Iniciar agora', 'Iniciar o trecho 1 agora, sem esperar a hora da largada?', onIniciarAgora)]] : []),
                  ['#', 'Ir p/ referência', () => { setMenu(false); setKp({ tipo: 'ref', v: '' }); }],
                  ['⇥', 'Ir p/ trecho', () => { setMenu(false); setKp({ tipo: 'trc', v: '' }); }],
                  ['⎋', 'Sair da tela', () => confirma('Sair da tela de prova', 'Voltar ao menu? O trecho e o GPS continuam.', onClose)],
                  ['✕', 'Fechar', () => setMenu(false)],
                ].map(([ic, t, f, off]) => (
                  <TouchableOpacity key={t} onPress={f} style={{ width: '31.5%', backgroundColor: '#1b212a', borderWidth: 1, borderColor: '#262b32', borderRadius: 12, paddingVertical: 12, marginBottom: 8, alignItems: 'center', opacity: off ? 0.55 : 1 }}>
                    <Text style={{ color: '#ff7a2e', fontSize: 24, fontWeight: '900' }}>{ic}</Text>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
  const fx = e.tnav != null ? faixaDe(-Number(e.tnav.toFixed(cfg.tnavDec)), cfg) : { bg: '#000', fg: '#fff' };
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
function Opc({ st, on, tx, onPress }) { return <TouchableOpacity style={[st.chip, { paddingHorizontal: 12, paddingVertical: 8 }, on && { backgroundColor: COR.azul }]} onPress={onPress}><Text style={[st.btn2Tx, on && { color: '#fff' }]}>{tx}</Text></TouchableOpacity>; }
function Num({ st, v, on, w = 56 }) { return <TextInput style={[st.input, { minWidth: w }]} defaultValue={String(v)} keyboardType="numbers-and-punctuation" onEndEditing={(e) => on(num(e.nativeEvent.text))} />; }
function Lin({ st, tx, children }) { return <View style={st.line}><Text style={st.k}>{tx}</Text>{children}</View>; }
// ---------- Página T.Nav (igual ao Kraken): três estados, cores, limites, formato e bipes ----------
const PALETA = ['#ff0000', '#e53935', '#f8838d', '#e91e63', '#f08ad8', '#9c27b0', '#5e35b1', '#3949ab', '#039be5', '#81d4fa', '#00acc1', '#18ffff', '#a5d6ff', '#00897b', '#00e676', '#76ff03', '#ffee00', '#ffb300', '#fb8c00', '#ff6d00', '#ff5722', '#9e9e9e', '#ffffff', '#000000'];
const PADROES = { adi: { bg: '#1e88e5', fg: '#ffffff' }, no: { bg: '#f5e50f', fg: '#000000' }, atr: { bg: '#e53935', fg: '#ffffff' } };
const NOMES = { adi: 'Adiantado', no: 'No tempo', atr: 'Atrasado' };
const FORMATOS = [['dec', 'Décimos', 'Ex: 10s = +100'], ['s', 'Segundos', 'Ex: 10s = +10'], ['sd', 'Segundos com decimal', 'Ex: 10s = +10.0'], ['cm', 'Centésimo de minuto (min/100)', 'Ex: 3s = +5. Homenagem a Sandro Hoffmann.']];
const fnum = (v) => String(v).replace(',', '.');
function Cx3({ bg, fg, v, w = 100, h = 62, small }) {
  return (
    <View style={{ width: w, height: h, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ position: 'absolute', top: 2, color: fg, fontSize: 9 }}>T.NAV</Text>
      <Text style={{ color: fg, fontWeight: '800', fontSize: small ? 22 : 30, marginTop: 8 }}>{v}</Text>
    </View>
  );
}
function Cartao({ titulo, children, onClose, rodape, comX }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 18 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 6, padding: 18, maxHeight: '92%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}><Text style={{ color: COR.tx, fontSize: 21, fontWeight: '500', flex: 1 }}>{titulo}</Text>{comX ? <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={{ color: COR.tx, fontSize: 24 }}>✕</Text></TouchableOpacity> : null}</View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {rodape}
        </View>
      </View>
    </Modal>
  );
}
const Salvar = ({ onPress, onCancel }) => (
  <View style={{ marginTop: 12 }}>
    {onCancel ? <TouchableOpacity onPress={onCancel} style={{ alignSelf: 'flex-end', padding: 8 }}><Text style={{ color: COR.azulTx, fontWeight: '600' }}>Cancelar</Text></TouchableOpacity> : null}
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: COR.azul, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}><Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 0.5 }}>SALVAR</Text></TouchableOpacity>
  </View>
);
function TNavPagina({ c, up }) {
  const t = c.tn;
  const [dlg, setDlg] = useState(null); // {k:'estado',e,tmp} | {k:'cor',e,campo,tmp} | {k:'lim',e,v} | {k:'fmt',v} | {k:'bipe',e,a,b}
  const [hex, setHex] = useState('');
  const dec = c.tnavDec;
  const lbl = (v) => fmtTnav(v, dec, 'sd');
  const campos = [['adi', -t.limAdi], ['no', 0], ['atr', t.limAtr]];
  const Linha = ({ tx, val, onPress, children }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.6 : 1} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COR.linha }}>
      <Text style={{ color: COR.tx, fontSize: 16, flex: 1 }}>{tx}</Text>{val != null ? <Text style={{ color: COR.tx2, fontSize: 15 }}>{val}</Text> : children}
    </TouchableOpacity>
  );
  const fm = FORMATOS.find((f) => f[0] === t.fmt) || FORMATOS[2];
  const salvarT = (patch) => up((o) => { Object.assign(o.tn, patch); return o; });
  return (
    <View>
      <Text style={{ color: COR.tx, fontSize: 15, lineHeight: 21, marginBottom: 10 }}>Toque em um estado para mudar as cores, ou no limite dele para mudar quando a cor troca. Os limites de cor não mudam durante a prova.</Text>
      <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          {campos.map(([e, v]) => <TouchableOpacity key={e} onPress={() => setDlg({ k: 'estado', e, tmp: { ...t[e] } })}><Cx3 bg={t[e].bg} fg={t[e].fg} v={fmtTnav(v, dec, 'sd')} w={104} /></TouchableOpacity>)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4, marginBottom: 2 }}>
          <TouchableOpacity onPress={() => setDlg({ k: 'lim', e: 'adi', v: String(t.limAdi) })} style={{ borderWidth: 1, borderColor: COR.tx2, borderRadius: 12, paddingHorizontal: 8, marginRight: 70 }}><Text style={{ color: COR.tx, fontSize: 12 }}>{lbl(-t.limAdi)} seg</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setDlg({ k: 'lim', e: 'atr', v: String(t.limAtr) })} style={{ borderWidth: 1, borderColor: COR.tx2, borderRadius: 12, paddingHorizontal: 8 }}><Text style={{ color: COR.tx, fontSize: 12 }}>{lbl(t.limAtr)} seg</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>{campos.map(([e]) => <Text key={e} style={{ width: 104, textAlign: 'center', color: COR.tx, fontSize: 12 }}>{NOMES[e]}</Text>)}</View>
        <View style={{ marginTop: 6 }}>
          <Linha tx="Formato do TNav" val={fm[1] === 'Segundos com decimal' ? 'Seg c/ decimal' : fm[1]} onPress={() => setDlg({ k: 'fmt', v: t.fmt })} />
          <Linha tx="Bipes adiantado e atrasado" onPress={() => salvarT({ bipe: !t.bipe })}>
            <View style={{ width: 22, height: 22, borderWidth: 2, borderColor: t.bipe ? COR.azul : '#78909c', backgroundColor: t.bipe ? COR.azul : 'transparent', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>{t.bipe ? <Text style={{ color: '#fff', fontSize: 14, lineHeight: 16 }}>✓</Text> : null}</View>
          </Linha>
          <Linha tx={'Limite bipe\nadiantado'} val={`de ${Number(t.bipeAdi[0]).toFixed(1)} a ${Number(t.bipeAdi[1]).toFixed(1)} seg`} onPress={() => setDlg({ k: 'bipe', e: 'bipeAdi', a: String(t.bipeAdi[0]), b: String(t.bipeAdi[1]), ti: 'Limite bipe adiantado', la: 'Início adiantado', lb: 'Fim adiantado' })} />
          <Linha tx={'Limite bipe\natrasado'} val={`de ${Number(t.bipeAtr[0]).toFixed(1)} a ${Number(t.bipeAtr[1]).toFixed(1)} seg`} onPress={() => setDlg({ k: 'bipe', e: 'bipeAtr', a: String(t.bipeAtr[0]), b: String(t.bipeAtr[1]), ti: 'Limite bipe atrasado', la: 'Início atrasado', lb: 'Fim atrasado' })} />
        </View>
        <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 8 }}>Os bipes por enquanto são vibrações curtas: uma ao estar adiantado e duas ao estar atrasado, dentro da faixa escolhida.</Text>
      </View>
      {dlg && dlg.k === 'estado' && (
        <Cartao titulo={NOMES[dlg.e]} onClose={() => setDlg(null)} rodape={<Salvar onCancel={() => setDlg(null)} onPress={() => { salvarT({ [dlg.e]: dlg.tmp }); setDlg(null); }} />}>
          <View style={{ alignItems: 'center', marginVertical: 8 }}><Cx3 bg={dlg.tmp.bg} fg={dlg.tmp.fg} v={fmtTnav(dlg.e === 'adi' ? -t.limAdi : dlg.e === 'atr' ? t.limAtr : 0, dec, 'sd')} w={190} h={110} /></View>
          {[['bg', 'Cor do fundo'], ['fg', 'Cor do texto']].map(([campo, nm]) => (
            <Linha key={campo} tx={nm} onPress={() => setDlg({ ...dlg, k: 'cor', campo, voltar: dlg })}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 22, height: 22, backgroundColor: dlg.tmp[campo], borderWidth: 1, borderColor: '#90a4ae', borderRadius: 3 }} /><Text style={{ color: COR.tx2, fontSize: 20, marginLeft: 10 }}>›</Text></View>
            </Linha>
          ))}
        </Cartao>
      )}
      {dlg && dlg.k === 'cor' && (() => {
        const extras = t.paleta || [];
        const cores = [...PALETA, ...extras];
        const atual = dlg.tmp[dlg.campo];
        const volta = (cor) => setDlg({ ...dlg.voltar, tmp: { ...dlg.voltar.tmp, [dlg.campo]: cor } });
        return (
          <Cartao titulo={dlg.campo === 'bg' ? 'Cor do fundo' : 'Cor do texto'} onClose={() => setDlg(dlg.voltar)} rodape={<Salvar onCancel={() => setDlg(dlg.voltar)} onPress={() => setDlg(dlg.voltar ? { ...dlg.voltar, tmp: { ...dlg.voltar.tmp, [dlg.campo]: atual } } : null)} />}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, backgroundColor: atual, borderRadius: 4, borderWidth: 1, borderColor: '#90a4ae' }} />
              <TouchableOpacity onPress={() => setDlg({ ...dlg, tmp: { ...dlg.tmp, [dlg.campo]: PADROES[dlg.e][dlg.campo] } })} style={{ marginLeft: 14, borderWidth: 1, borderColor: COR.linha, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 14, height: 14, backgroundColor: PADROES[dlg.e][dlg.campo], marginRight: 8, borderWidth: 1, borderColor: '#90a4ae' }} /><Text style={{ color: COR.tx2, fontSize: 13 }}>Usar cor padrão</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: COR.tx, fontWeight: '600', marginBottom: 8 }}>Paleta</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cores.map((cor, i) => (
                <TouchableOpacity key={cor + i} onPress={() => setDlg({ ...dlg, tmp: { ...dlg.tmp, [dlg.campo]: cor } })}
                  onLongPress={i >= PALETA.length ? () => salvarT({ paleta: extras.filter((x) => x !== cor) }) : undefined}
                  style={{ width: '18%', aspectRatio: 1, backgroundColor: cor, margin: '1%', borderRadius: 4, borderWidth: atual === cor ? 3 : 1, borderColor: atual === cor ? '#0d47a1' : '#cfd8dc' }} />
              ))}
              <View style={{ width: '18%', aspectRatio: 1, margin: '1%', borderRadius: 4, borderWidth: 1, borderColor: '#cfd8dc', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COR.tx2, fontSize: 22 }}>+</Text></View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <TextInput value={hex} onChangeText={setHex} placeholder="Nova cor, ex: #ff8800" placeholderTextColor="#90a4ae" autoCapitalize="none" style={{ flex: 1, borderWidth: 1, borderColor: COR.linha, borderRadius: 4, padding: 8, color: COR.tx }} />
              <TouchableOpacity onPress={() => { const h = hex.trim().toLowerCase(); if (!/^#[0-9a-f]{6}$/.test(h)) return Alert.alert('Cor inválida', 'Use o formato #rrggbb.'); salvarT({ paleta: [...extras.filter((x) => x !== h), h] }); setDlg({ ...dlg, tmp: { ...dlg.tmp, [dlg.campo]: h } }); setHex(''); }} style={{ paddingHorizontal: 14 }}><Text style={{ color: COR.azulTx, fontWeight: '700' }}>ADD</Text></TouchableOpacity>
            </View>
            <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 8 }}>Toque e segure uma cor que você adicionou para removê-la da paleta.</Text>
          </Cartao>
        );
      })()}
      {dlg && dlg.k === 'lim' && (
        <Cartao titulo={dlg.e === 'adi' ? 'Limite cor adiantado' : 'Limite cor atrasado'} onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { const v = Math.max(0, Math.min(60, parseFloat(fnum(dlg.v)))); if (isNaN(v)) return Alert.alert('Valor inválido', 'Digite os segundos, por exemplo 0.2.'); salvarT({ [dlg.e === 'adi' ? 'limAdi' : 'limAtr']: v }); setDlg(null); }} />}>
          <Text style={{ color: COR.azulTx, fontSize: 12 }}>Segundos</Text>
          <TextInput value={dlg.v} onChangeText={(v) => setDlg({ ...dlg, v })} keyboardType="decimal-pad" autoFocus style={{ borderWidth: 2, borderColor: COR.azul, borderRadius: 4, padding: 10, fontSize: 18, color: COR.tx }} />
        </Cartao>
      )}
      {dlg && dlg.k === 'fmt' && (
        <Cartao titulo="Formato do TNav" onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { salvarT({ fmt: dlg.v }); setDlg(null); }} />}>
          {FORMATOS.map(([k, nm, ex]) => (
            <TouchableOpacity key={k} onPress={() => setDlg({ ...dlg, v: k })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: dlg.v === k ? COR.azul : '#90a4ae', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>{dlg.v === k ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: COR.azul }} /> : null}</View>
              <View style={{ flex: 1 }}><Text style={{ color: COR.tx, fontSize: 16 }}>{nm}</Text><Text style={{ color: COR.tx2, fontSize: 12 }}>{ex}</Text></View>
            </TouchableOpacity>
          ))}
        </Cartao>
      )}
      {dlg && dlg.k === 'bipe' && (
        <Cartao titulo={dlg.ti} onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { const a = parseFloat(fnum(dlg.a)), b = parseFloat(fnum(dlg.b)); if (isNaN(a) || isNaN(b) || a < 0 || b <= a) return Alert.alert('Valores inválidos', 'O início deve ser menor que o fim.'); salvarT({ [dlg.e]: [a, b] }); setDlg(null); }} />}>
          <Text style={{ color: COR.azulTx, fontSize: 12 }}>{dlg.la}</Text>
          <TextInput value={dlg.a} onChangeText={(v) => setDlg({ ...dlg, a: v })} keyboardType="decimal-pad" autoFocus style={{ borderWidth: 2, borderColor: COR.azul, borderRadius: 4, padding: 10, fontSize: 18, color: COR.tx, marginBottom: 10 }} />
          <Text style={{ color: COR.tx2, fontSize: 12 }}>{dlg.lb}</Text>
          <TextInput value={dlg.b} onChangeText={(v) => setDlg({ ...dlg, b: v })} keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: COR.linha, borderRadius: 4, padding: 10, fontSize: 18, color: COR.tx }} />
        </Cartao>
      )}
    </View>
  );
}

// ---------- Página Odômetro (igual ao Kraken) ----------
const FMT4 = [['k3', '0.001', '1 m com ponto'], ['k2', '0.01', '10 m com ponto'], ['m1', '1 m', '1 m sem ponto'], ['m10', '10 m', '10 m sem ponto']];
function PaletaCor({ titulo, atual, padrao, extras, onExtras, onSalvar, onCancel }) {
  const [cor, setCor] = useState(atual);
  const [hex, setHex] = useState('');
  const cores = [...PALETA, ...extras];
  return (
    <Cartao titulo={titulo} onClose={onCancel} rodape={<Salvar onCancel={onCancel} onPress={() => onSalvar(cor)} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 40, height: 40, backgroundColor: cor, borderRadius: 4, borderWidth: 1, borderColor: '#90a4ae' }} />
        <TouchableOpacity onPress={() => setCor(padrao)} style={{ marginLeft: 14, borderWidth: 1, borderColor: COR.linha, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 14, height: 14, backgroundColor: padrao, marginRight: 8, borderWidth: 1, borderColor: '#90a4ae' }} /><Text style={{ color: COR.tx2, fontSize: 13 }}>Usar cor padrão</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: COR.tx, fontWeight: '600', marginBottom: 8 }}>Paleta</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cores.map((x, i) => (
          <TouchableOpacity key={x + i} onPress={() => setCor(x)} onLongPress={i >= PALETA.length ? () => onExtras(extras.filter((y) => y !== x)) : undefined}
            style={{ width: '18%', aspectRatio: 1, backgroundColor: x, margin: '1%', borderRadius: 4, borderWidth: cor === x ? 3 : 1, borderColor: cor === x ? '#0d47a1' : '#cfd8dc' }} />
        ))}
        <View style={{ width: '18%', aspectRatio: 1, margin: '1%', borderRadius: 4, borderWidth: 1, borderColor: '#cfd8dc', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COR.tx2, fontSize: 22 }}>+</Text></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <TextInput value={hex} onChangeText={setHex} placeholder="Nova cor, ex: #ff8800" placeholderTextColor="#90a4ae" autoCapitalize="none" style={{ flex: 1, borderWidth: 1, borderColor: COR.linha, borderRadius: 4, padding: 8, color: COR.tx }} />
        <TouchableOpacity onPress={() => { const h = hex.trim().toLowerCase(); if (!/^#[0-9a-f]{6}$/.test(h)) return Alert.alert('Cor inválida', 'Use o formato #rrggbb.'); onExtras([...extras.filter((y) => y !== h), h]); setCor(h); setHex(''); }} style={{ paddingHorizontal: 14 }}><Text style={{ color: COR.azulTx, fontWeight: '700' }}>ADD</Text></TouchableOpacity>
      </View>
      <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 8 }}>Toque e segure uma cor que você adicionou para removê-la da paleta.</Text>
    </Cartao>
  );
}
// Prévia do regressivo: ▶ anima a contagem até zero, ↻ volta ao início.
function PrevReg({ label, fmt, bar, ini }) {
  const [m, setM] = useState(ini * 0.5);
  const [run, setRun] = useState(false);
  useEffect(() => { setM(ini * 0.5); setRun(false); }, [ini]);
  useEffect(() => {
    if (!run) return undefined;
    let v = ini;
    setM(v);
    const id = setInterval(() => { v -= ini / 50; if (v <= 0) { v = 0; setRun(false); } setM(v); }, 100);
    return () => clearInterval(id);
  }, [run]);
  const fill = bar.on ? Math.min(1, Math.max(0, 1 - m / Math.max(1, ini))) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <View style={{ flex: 1, height: 64, backgroundColor: '#000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(fill * 100)}%`, backgroundColor: bar.cor }} />
        <Text style={{ position: 'absolute', top: 1, color: '#fff', fontSize: 9 }}>{label}</Text>
        <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', marginTop: 8 }}>{fmtDist(m, fmt)}</Text>
      </View>
      <TouchableOpacity onPress={() => (m <= 0 ? (setM(ini * 0.5), setRun(false)) : setRun(true))} style={{ paddingHorizontal: 16 }}><Text style={{ color: COR.tx, fontSize: 22 }}>{m <= 0 ? '↻' : '▶'}</Text></TouchableOpacity>
    </View>
  );
}
function OdoPagina({ c, up }) {
  const [dlg, setDlg] = useState(null);
  const extras = (c.tn && c.tn.paleta) || [];
  const setExtras = (l) => up((o) => { o.tn.paleta = l; return o; });
  const Sec = ({ t }) => <Text style={{ color: COR.tx, fontSize: 15, marginTop: 16, marginBottom: 6 }}>{t}</Text>;
  const Box = ({ children }) => <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12 }}>{children}</View>;
  const Lin = ({ tx, val, onPress, children }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.6 : 1} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COR.linha }}>
      <Text style={{ color: COR.tx, fontSize: 15, flex: 1, paddingRight: 8 }}>{tx}</Text>{val != null ? <Text style={{ color: COR.tx2, fontSize: 15 }}>{val}</Text> : children}
    </TouchableOpacity>
  );
  const Chk = ({ tx, on, set }) => (
    <Lin tx={tx} onPress={() => set(!on)}>
      <View style={{ width: 22, height: 22, borderWidth: 2, borderColor: on ? COR.azul : '#78909c', backgroundColor: on ? COR.azul : 'transparent', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>{on ? <Text style={{ color: '#fff', fontSize: 14, lineHeight: 16 }}>✓</Text> : null}</View>
    </Lin>
  );
  const Cor = ({ tx, cor, onPress }) => <Lin tx={tx} onPress={onPress}><View style={{ width: 24, height: 24, backgroundColor: cor, borderWidth: 1, borderColor: '#78909c', borderRadius: 3 }} /></Lin>;
  const fm = (cfgO) => { const k = fmtCodigo(cfgO); return k === 'k3' ? '0.001' : k === 'k2' ? '0.01' : k === 'm1' ? '1 m' : '10 m'; };
  const abrirFmt = (titulo, getO, setO, so2) => setDlg({ k: 'fmt', titulo, v: fmtCodigo(getO), opcoes: so2 ? FMT4.slice(0, 2) : FMT4, setO });
  const abrirNum = (titulo, texto, ini, onOk) => setDlg({ k: 'num', titulo, texto, v: String(ini), onOk });
  const abrirCor = (titulo, atual, padrao, onOk) => setDlg({ k: 'cor', titulo, atual, padrao, onOk });
  return (
    <View>
      <Sec t="Odômetro" />
      <Box>
        <View style={{ paddingVertical: 8 }}>
          <View style={{ height: 70, backgroundColor: c.odoCor.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ position: 'absolute', top: 2, color: c.odoCor.fg, fontSize: 9 }}>ODÔMETRO (GPS)</Text>
            <Text style={{ color: c.odoCor.fg, fontSize: 44, fontWeight: '800', marginTop: 8 }}>{fmtDist(12345, c.odo)}</Text>
          </View>
        </View>
        <Lin tx="Odômetro principal" val={fm(c.odo)} onPress={() => abrirFmt('Odômetro principal', c.odo, (k) => up((o) => { o.odo = { ...FMT_DIST[k] }; return o; }), true)} />
        <Cor tx="Cor do texto do odômetro principal" cor={c.odoCor.fg} onPress={() => abrirCor('Cor do texto do odômetro principal', c.odoCor.fg, '#ffffff', (x) => up((o) => { o.odoCor.fg = x; return o; }))} />
        <Cor tx="Cor de fundo do odômetro principal" cor={c.odoCor.bg} onPress={() => abrirCor('Cor de fundo do odômetro principal', c.odoCor.bg, '#000000', (x) => up((o) => { o.odoCor.bg = x; return o; }))} />
      </Box>
      <Sec t="Odômetro das referências" />
      <Box>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ borderWidth: 1, borderColor: '#78909c', paddingHorizontal: 6, paddingVertical: 2, alignItems: 'flex-end' }}>
            {c.refs.parcial ? <Text style={{ color: COR.tx, fontSize: 12 }}>{fmtDist(125, FMT_DIST[c.refs.fmtP])}</Text> : null}
            <Text style={{ color: COR.tx, fontSize: 24, fontWeight: '800' }}>{c.refs.ocultar3 ? '12,34' : '12,345'}</Text>
          </View>
          <Text style={{ flex: 1, color: COR.tx, fontSize: 14, marginLeft: 12 }}>Odômetro da referência e acima dele, o parcial desde a referência anterior.</Text>
        </View>
        <Chk tx="Ocultar 3ª casa decimal" on={c.refs.ocultar3} set={(v) => up((o) => { o.refs.ocultar3 = v; return o; })} />
        <Chk tx="Exibir odômetro parcial" on={c.refs.parcial} set={(v) => up((o) => { o.refs.parcial = v; return o; })} />
        <Lin tx="Formato do odômetro parcial" val={fm(FMT_DIST[c.refs.fmtP])} onPress={() => abrirFmt('Formato do odômetro parcial', FMT_DIST[c.refs.fmtP], (k) => up((o) => { o.refs.fmtP = k; return o; }))} />
      </Box>
      <Sec t="Regressivo de referência" />
      <Box>
        <PrevReg label="REG REF" fmt={c.ref} bar={c.barraRef} ini={c.barraRef.ini} />
        <Lin tx="Formato" val={fm(c.ref)} onPress={() => abrirFmt('Regressivo de referência', c.ref, (k) => up((o) => { o.ref = { ...FMT_DIST[k] }; return o; }))} />
        <Chk tx="Exibir barra regressiva de referência" on={c.barraRef.on} set={(v) => up((o) => { o.barraRef.on = v; return o; })} />
        <Cor tx="Cor da barra regressiva de referência" cor={c.barraRef.cor} onPress={() => abrirCor('Cor da barra regressiva de referência', c.barraRef.cor, '#e53935', (x) => up((o) => { o.barraRef.cor = x; return o; }))} />
        <Lin tx="Distância antes da referência" val={`${c.barraRef.ini} m`} onPress={() => abrirNum('Distância antes da referência', 'Define a distância antes da referência (em metros) para iniciar a exibição da barra regressiva.', c.barraRef.ini, (v) => up((o) => { o.barraRef.ini = v; return o; }))} />
        <Lin tx="Distância da barra regressiva no Estou Aqui" val={`${c.barraRef.aqui} m`} onPress={() => abrirNum('Distância da barra regressiva no Estou Aqui', 'Define a distância da barra regressiva (em metros) quando você usa o Estou Aqui.', c.barraRef.aqui, (v) => up((o) => { o.barraRef.aqui = v; return o; }))} />
      </Box>
      <Sec t="Regressivo de trecho" />
      <Box>
        <PrevReg label="REG TRC" fmt={c.trc} bar={c.barraTrc} ini={c.barraTrc.ini} />
        <Lin tx="Formato" val={fm(c.trc)} onPress={() => abrirFmt('Regressivo de trecho', c.trc, (k) => up((o) => { o.trc = { ...FMT_DIST[k] }; return o; }))} />
        <Chk tx="Exibir barra regressiva de trecho" on={c.barraTrc.on} set={(v) => up((o) => { o.barraTrc.on = v; return o; })} />
        <Cor tx="Cor da barra regressiva de trecho" cor={c.barraTrc.cor} onPress={() => abrirCor('Cor da barra regressiva de trecho', c.barraTrc.cor, '#00b3d6', (x) => up((o) => { o.barraTrc.cor = x; return o; }))} />
        <Lin tx="Distância antes da mudança de trecho" val={`${c.barraTrc.ini} m`} onPress={() => abrirNum('Distância antes da mudança de trecho', 'Define a distância antes da mudança de trecho (em metros) para iniciar a exibição da barra regressiva.', c.barraTrc.ini, (v) => up((o) => { o.barraTrc.ini = v; return o; }))} />
      </Box>
      <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 10 }}>A distância do Estou Aqui fica salva, mas ainda não muda a barra na prova.</Text>
      {dlg && dlg.k === 'fmt' && (
        <Cartao titulo={dlg.titulo} onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { dlg.setO(dlg.v); setDlg(null); }} />}>
          {dlg.opcoes.map(([k, nm, ex]) => (
            <TouchableOpacity key={k} onPress={() => setDlg({ ...dlg, v: k })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: dlg.v === k ? COR.azul : '#90a4ae', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>{dlg.v === k ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: COR.azul }} /> : null}</View>
              <View><Text style={{ color: COR.tx, fontSize: 16 }}>{nm}</Text><Text style={{ color: COR.tx2, fontSize: 12 }}>{ex}</Text></View>
            </TouchableOpacity>
          ))}
        </Cartao>
      )}
      {dlg && dlg.k === 'num' && (
        <Cartao titulo={dlg.titulo} onClose={() => setDlg(null)} rodape={<Salvar onCancel={() => setDlg(null)} onPress={() => { const v = Math.round(parseFloat(String(dlg.v).replace(',', '.'))); if (isNaN(v) || v < 10 || v > 500) return Alert.alert('Valor inválido', 'Digite um valor entre 10 e 500 m.'); dlg.onOk(v); setDlg(null); }} />}>
          <Text style={{ color: COR.tx, fontSize: 14, marginBottom: 10 }}>{dlg.texto}</Text>
          <Text style={{ color: COR.azulTx, fontSize: 12 }}>Valor m</Text>
          <TextInput value={dlg.v} onChangeText={(v) => setDlg({ ...dlg, v })} keyboardType="number-pad" autoFocus style={{ borderWidth: 2, borderColor: COR.azul, borderRadius: 4, padding: 10, fontSize: 18, color: COR.tx }} />
          <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 4 }}>Entre 10 e 500 m</Text>
        </Cartao>
      )}
      {dlg && dlg.k === 'cor' && <PaletaCor titulo={dlg.titulo} atual={dlg.atual} padrao={dlg.padrao} extras={extras} onExtras={setExtras} onCancel={() => setDlg(null)} onSalvar={(x) => { dlg.onOk(x); setDlg(null); }} />}
    </View>
  );
}

// ---------- Página Alertas sonoros (igual ao Kraken) ----------
const DIST_ALERTA = [10, 20, 30, 50, 100, 200, 300];
const VELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
function BarraVol({ v, onChange }) {
  const [w, setW] = useState(1);
  const set = (x) => onChange(Math.max(0, Math.min(1, Math.round((x / w) * 20) / 20)));
  return (
    <View onLayout={(e) => setW(Math.max(1, e.nativeEvent.layout.width))} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => set(e.nativeEvent.locationX)} onResponderMove={(e) => set(e.nativeEvent.locationX)} style={{ flex: 1, height: 26, justifyContent: 'center' }}>
      <View pointerEvents="none"><View style={{ height: 4, backgroundColor: '#cfd8dc' }}><View style={{ width: `${v * 100}%`, height: 4, backgroundColor: COR.azul }} /></View>
        <View style={{ position: 'absolute', left: `${v * 100}%`, marginLeft: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: COR.azul }} /></View>
    </View>
  );
}
function SomPagina({ c, up }) {
  const so = c.som;
  const [dlg, setDlg] = useState(null);
  const [vozes, setVozes] = useState(null);
  const set = (patch) => up((o) => { Object.assign(o.som, patch); return o; });
  const Box = ({ children }) => <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12 }}>{children}</View>;
  const Lin = ({ tx, val, onPress, children, first }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.6 : 1} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: first ? 0 : 1, borderTopColor: COR.linha }}>
      <Text style={{ color: COR.tx, fontSize: 15, flex: 1, paddingRight: 8 }}>{tx}</Text>{val != null ? <Text style={{ color: COR.tx2, fontSize: 15 }}>{val}</Text> : children}
    </TouchableOpacity>
  );
  const Cx = ({ on }) => <View style={{ width: 22, height: 22, borderWidth: 2, borderColor: on ? COR.azul : '#78909c', backgroundColor: on ? COR.azul : 'transparent', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>{on ? <Text style={{ color: '#fff', fontSize: 14, lineHeight: 16 }}>✓</Text> : null}</View>;
  const Chk = ({ tx, on, onPress, first }) => <Lin tx={tx} onPress={onPress} first={first}><Cx on={on} /></Lin>;
  useEffect(() => { if (dlg && dlg.k === 'voz' && vozes == null) vozesPt().then(setVozes); }, [dlg]);
  const teste = () => falar('Atenção. Próxima referência em cem metros. Trecho dois, trinta e seis quilômetros por hora.', { vel: so.vel, vol: so.volFala, voz: so.voz });
  const setDist = (k, campo) => up((o) => { o.som.dist[k][campo] = !o.som.dist[k][campo]; return o; });
  return (
    <View>
      <Text style={{ color: COR.tx, fontSize: 15, marginBottom: 6 }}>Alertas sonoros</Text>
      <Box>
        <Chk first tx="Bipe na mudança de Ref" on={so.bipeRef} onPress={() => { set({ bipeRef: !so.bipeRef }); if (!so.bipeRef) bipe('ref', so.volBipe); }} />
        <Chk tx="Bipe na mudança de Trecho" on={so.bipeTrc} onPress={() => { set({ bipeTrc: !so.bipeTrc }); if (!so.bipeTrc) bipe('trc', so.volBipe); }} />
        <Chk tx="Bipes adiantado e atrasado" on={c.tn.bipe} onPress={() => up((o) => { o.tn.bipe = !o.tn.bipe; return o; })} />
        <Chk tx="Fala na mudança Trecho" on={so.falaTrc} onPress={() => set({ falaTrc: !so.falaTrc })} />
        <Lin tx="Velocidade da fala" val={`${so.vel.toFixed(2)}x`} onPress={() => setDlg({ k: 'vel', v: so.vel })} />
        <Lin tx="Voz da navegação" onPress={() => setDlg({ k: 'voz' })}><View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#00c853', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text></View><Text style={{ color: COR.tx2, fontSize: 20, marginLeft: 8 }}>›</Text></View></Lin>
      </Box>
      <Text style={{ color: COR.tx, fontSize: 15, marginTop: 12, marginBottom: 4 }}>Volume</Text>
      <Box>
        {[['Bipes', 'volBipe', 'dist'], ['Fala', 'volFala', null]].map(([nm, k, snd]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ width: 52, color: COR.tx, fontSize: 13 }}>{nm}</Text>
            <BarraVol v={so[k]} onChange={(v) => set({ [k]: v })} />
            <Text style={{ width: 44, textAlign: 'right', color: COR.tx2, fontSize: 12 }}>{Math.round(so[k] * 100)}%</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => bipe('dist', so.volBipe)} style={{ marginRight: 16 }}><Text style={{ color: COR.azulTx, fontSize: 13 }}>▶ testar bipe</Text></TouchableOpacity>
          <TouchableOpacity onPress={teste}><Text style={{ color: COR.azulTx, fontSize: 13 }}>▶ testar fala</Text></TouchableOpacity>
        </View>
      </Box>
      <Text style={{ color: COR.tx, fontSize: 15, marginTop: 12, marginBottom: 4 }}>Avisos por distância antes da referência</Text>
      <Box>
        {DIST_ALERTA.map((m, i) => (
          <View key={m} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: COR.linha }}>
            <Text style={{ width: 62, color: COR.tx, fontSize: 14 }}>{m} m</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row' }}>
                {[['d', 'Distância'], ['a', 'Afer']].map(([cp, nm]) => (
                  <TouchableOpacity key={cp} onPress={() => setDist(m, cp)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 22, paddingVertical: 4 }}><Cx on={so.dist[m][cp]} /><Text style={{ color: COR.tx, fontSize: 12, marginLeft: 6 }}>{nm}</Text></TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setDist(m, 'm')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}><Cx on={so.dist[m].m} /><Text style={{ color: COR.tx, fontSize: 12, marginLeft: 6 }}>Marcação</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </Box>
      <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 10 }}>Distância avisa antes de qualquer referência e Afer só antes de referência de aferição. Marcação fica salva, mas ainda não tem efeito. O volume do sistema é o do próprio celular.</Text>
      {dlg && dlg.k === 'vel' && (
        <Cartao titulo="Velocidade da fala" onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { set({ vel: dlg.v }); setDlg(null); }} />}>
          {VELS.map((x) => (
            <TouchableOpacity key={x} onPress={() => setDlg({ ...dlg, v: x })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: dlg.v === x ? COR.azul : '#90a4ae', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>{dlg.v === x ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: COR.azul }} /> : null}</View>
              <Text style={{ color: COR.tx, fontSize: 16 }}>{x.toFixed(2)}x</Text>
            </TouchableOpacity>
          ))}
        </Cartao>
      )}
      {dlg && dlg.k === 'voz' && (
        <Cartao titulo="Voz da navegação" onClose={() => setDlg(null)} rodape={<Salvar onPress={() => setDlg(null)} />}>
          <View style={{ backgroundColor: '#e3f6ec', borderWidth: 1, borderColor: '#9ad9b5', borderRadius: 10, padding: 14 }}>
            <Text style={{ color: '#0b8a43', fontSize: 20, fontWeight: '500' }}>✓  Voz pronta</Text>
            <Text style={{ color: COR.tx, fontSize: 15, marginTop: 8 }}>A navegação vai falar mesmo sem sinal de internet.</Text>
            <TouchableOpacity onPress={teste} style={{ backgroundColor: '#0b9a4a', borderRadius: 4, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}><Text style={{ color: '#fff', fontWeight: '700' }}>🔊  Ouvir teste</Text></TouchableOpacity>
          </View>
          <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 12, marginBottom: 4 }}>Vozes em português deste celular</Text>
          <TouchableOpacity onPress={() => { set({ voz: null }); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: !so.voz ? COR.azul : '#90a4ae', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{!so.voz ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COR.azul }} /> : null}</View>
            <Text style={{ color: COR.tx, fontSize: 15 }}>Padrão do celular</Text>
          </TouchableOpacity>
          {vozes == null ? <Text style={{ color: COR.tx2 }}>Procurando vozes…</Text> : vozes.map((vz) => (
            <TouchableOpacity key={vz.identifier} onPress={() => set({ voz: vz.identifier })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: so.voz === vz.identifier ? COR.azul : '#90a4ae', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{so.voz === vz.identifier ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COR.azul }} /> : null}</View>
              <View style={{ flex: 1 }}><Text style={{ color: COR.tx, fontSize: 15 }}>{vz.name}</Text><Text style={{ color: COR.tx2, fontSize: 11 }}>{vz.language}{vz.quality ? ` · ${vz.quality}` : ''}</Text></View>
            </TouchableOpacity>
          ))}
        </Cartao>
      )}
    </View>
  );
}

// ---------- Página Transição de referências (igual ao Kraken) ----------
function TransPagina({ c, up }) {
  const t = c.trans;
  const [dlg, setDlg] = useState(null);
  const itens = [
    ['dist', 'Distância da ref atual', 'm', 'Distância da referência atual', (v) => `Referência atual se mantém visível até que se afaste dela por ${v} m`, 'Distância (metros)', 1000],
    ['tempo', 'Tempo máx de transição', 's', 'Tempo máximo de transição', (v) => `Referência atual se mantém visível por no máximo ${v} segundos`, 'Tempo (segundos)', 600],
    ['prox', 'Distância p/ próxima ref', 'm', 'Distância para a próxima referência', (v) => `Referência atual se mantém visível até que a próxima referência se aproxime em menos de ${v} m`, 'Distância (metros)', 1000],
  ];
  return (
    <View>
      <Text style={{ color: COR.tx, fontSize: 15, marginBottom: 2 }}>Transição de referências</Text>
      <Text style={{ color: COR.tx, fontSize: 15, lineHeight: 21, marginBottom: 8 }}>A referência atual será mantida até que uma das condições abaixo seja atendida.</Text>
      <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12 }}>
        {itens.map(([k, nm, un, ti, tx, lb, max], i) => (
          <TouchableOpacity key={k} onPress={() => setDlg({ k, v: String(t[k]), ti, tx, lb, max })} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: i ? 1 : 0, borderTopColor: COR.linha }}>
            <Text style={{ color: COR.tx, fontSize: 15, fontWeight: '500' }}>{nm}</Text><Text style={{ color: COR.tx, fontSize: 15 }}>{t[k]} {un}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 10 }}>Valor 0 desliga a condição. Com as três em 0, a referência troca na hora em que você passa por ela.</Text>
      {dlg && (
        <Cartao titulo={dlg.ti} onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { const v = Math.round(parseFloat(String(dlg.v).replace(',', '.'))); if (isNaN(v) || v < 0 || v > dlg.max) return Alert.alert('Valor inválido', `Digite um valor entre 0 e ${dlg.max}.`); up((o) => { o.trans[dlg.k] = v; return o; }); setDlg(null); }} />}>
          <Text style={{ color: COR.tx, fontSize: 15, marginBottom: 10 }}>{dlg.tx(String(parseInt(dlg.v, 10) || 0))}</Text>
          <Text style={{ color: COR.azulTx, fontSize: 12 }}>{dlg.lb}</Text>
          <TextInput value={dlg.v} onChangeText={(v) => setDlg({ ...dlg, v })} keyboardType="number-pad" autoFocus style={{ borderWidth: 2, borderColor: COR.azul, borderRadius: 4, padding: 10, fontSize: 18, color: COR.tx }} />
        </Cartao>
      )}
    </View>
  );
}

// ---------- Página Botoeira (igual ao Kraken): o que cada botão físico faz ----------
const ACOES = [['nada', 'Nada'], ['inc', 'Incrementar'], ['dec', 'Decrementar'], ['lap', 'Lap'], ['w', 'Ajuste fino W%'], ['aqui', 'Estou aqui (Botoeira)'], ['afer', 'AFER Visual'], ['odoreg', 'Odômetro Regressivo']];
const nomeAcao = (k) => (ACOES.find((a) => a[0] === k) || ACOES[0])[1];
function BotPagina({ c, up }) {
  const b = c.bot;
  const [dlg, setDlg] = useState(null);
  const Sec = ({ t }) => <Text style={{ color: COR.tx, fontSize: 15, marginTop: 14, marginBottom: 6 }}>{t}</Text>;
  const Lin = ({ tx, val, onPress, first, children }) => (
    <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: first ? 0 : 1, borderTopColor: COR.linha }}>
      <Text style={{ color: COR.tx, fontSize: 15, fontWeight: '500', flex: 1, paddingRight: 8 }}>{tx}</Text>{val != null ? <Text style={{ color: COR.tx, fontSize: 15 }}>{val}</Text> : children}
    </TouchableOpacity>
  );
  const grupo = (g) => [['pri', 'Primário'], ['sec', 'Secundário'], ['incr', 'Incremento'], ['decr', 'Decremento']].map(([k, nm], i) => (
    <Lin key={k} first={false} tx={nm} val={nomeAcao(b[g][k])} onPress={() => setDlg({ k: 'acao', g, c: k, ti: nm, v: b[g][k] })} />
  ));
  return (
    <View>
      <Sec t="Botões de volume (celular e fone com fio)" />
      <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12 }}>
        <Lin first tx="Distância de Inc/Dec" val={`${b.inc} m`} onPress={() => setDlg({ k: 'inc', v: String(b.inc) })} />
        <Lin tx="Volume +" val={nomeAcao(b.vol.up)} onPress={() => setDlg({ k: 'acao', g: 'vol', c: 'up', ti: 'Volume +', v: b.vol.up })} />
        <Lin tx="Volume −" val={nomeAcao(b.vol.down)} onPress={() => setDlg({ k: 'acao', g: 'vol', c: 'down', ti: 'Volume −', v: b.vol.down })} />
      </View>
      <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 6 }}>Funciona com a tela da prova aberta. O volume do celular fica fixo durante a prova e volta ao normal ao sair.</Text>
      <Sec t="Botões (sensor Bluetooth)" />
      <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12 }}>
        {grupo('comp')}
        <Lin tx="Inverter direção do Estou Aqui" onPress={() => up((o) => { o.bot.comp.inv = !o.bot.comp.inv; return o; })}>
          <View style={{ width: 22, height: 22, borderWidth: 2, borderColor: b.comp.inv ? COR.azul : '#78909c', backgroundColor: b.comp.inv ? COR.azul : 'transparent', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }}>{b.comp.inv ? <Text style={{ color: '#fff', fontSize: 14, lineHeight: 16 }}>✓</Text> : null}</View>
        </Lin>
      </View>
      <Sec t="Botões (logger GPS)" />
      <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12 }}>{grupo('logg')}</View>
      <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 10 }}>Os botões de sensor Bluetooth e de logger GPS ficam salvos, mas ainda não têm efeito: o app ainda não recebe esses aparelhos.</Text>
      {dlg && dlg.k === 'acao' && (
        <Cartao comX titulo={dlg.ti} onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { up((o) => { o.bot[dlg.g][dlg.c] = dlg.v; return o; }); setDlg(null); }} />}>
          {ACOES.map(([k, nm]) => (
            <TouchableOpacity key={k} onPress={() => setDlg({ ...dlg, v: k })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: dlg.v === k ? COR.azul : '#90a4ae', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>{dlg.v === k ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: COR.azul }} /> : null}</View>
              <Text style={{ color: COR.tx, fontSize: 16 }}>{nm}</Text>
            </TouchableOpacity>
          ))}
        </Cartao>
      )}
      {dlg && dlg.k === 'inc' && (
        <Cartao titulo="Insira o incremento do botão" onClose={() => setDlg(null)} rodape={<Salvar onPress={() => { const v = parseFloat(String(dlg.v).replace(',', '.')); if (isNaN(v) || v <= 0 || v > 100) return Alert.alert('Valor inválido', 'Digite um valor entre 0,1 e 100 m.'); up((o) => { o.bot.inc = v; return o; }); setDlg(null); }} />}>
          <Text style={{ color: COR.azulTx, fontSize: 12 }}>Incremento (m)</Text>
          <TextInput value={dlg.v} onChangeText={(v) => setDlg({ ...dlg, v })} keyboardType="decimal-pad" autoFocus style={{ borderWidth: 2, borderColor: COR.azul, borderRadius: 4, padding: 10, fontSize: 18, color: COR.tx }} />
        </Cartao>
      )}
    </View>
  );
}

// ---------- Página GPS (igual ao Kraken): filtros do odômetro ----------
function GpsPagina({ c, up }) {
  const g = c.gps;
  const [dlg, setDlg] = useState(null);
  const itens = [
    ['vmin', 'Velocidade mínima', 'km/h', 30, 'Velocidade mínima', 'Velocidade mínima (em km/h) reportada pelo GPS do celular para o odômetro registrar movimento. Abaixo desse valor, a velocidade é tratada como ruído. Aumente se o odômetro estiver avançando com o veículo parado.', 'Valor km/h'],
    ['dmin', 'Distância mínima entre pontos', 'm', 50, 'Distância mínima entre pontos', 'Distância mínima (em metros) entre o último ponto válido do GPS do celular e o ponto atual para registrar movimento. Abaixo desse valor, a variação é tratada como ruído. Aumente se o odômetro estiver avançando com o veículo parado.', 'Valor m'],
  ];
  return (
    <View>
      <Text style={{ color: COR.tx, fontSize: 15, marginBottom: 2 }}>Filtro do odômetro GPS (celular)</Text>
      <Text style={{ color: COR.tx, fontSize: 15, lineHeight: 21, marginBottom: 8 }}>Define quando uma variação do GPS do celular é considerada movimento real. Variações abaixo desses limites são tratadas como ruído, evitando que o odômetro avance com o veículo parado.</Text>
      <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12 }}>
        {itens.map(([k, nm, un, max, ti, tx, lb], i) => (
          <TouchableOpacity key={k} onPress={() => setDlg({ k, v: String(g[k]), un, max, ti, tx, lb })} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: i ? 1 : 0, borderTopColor: COR.linha }}>
            <Text style={{ color: COR.tx, fontSize: 15, fontWeight: '500', flex: 1, paddingRight: 8 }}>{nm}</Text><Text style={{ color: COR.tx, fontSize: 15 }}>{g[k]} {un}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 10 }}>O padrão do app é 3 km/h e 0 m. Se o odômetro andar com o carro parado, aumente a velocidade mínima.</Text>
      {dlg && (
        <Cartao titulo={dlg.ti} onClose={() => setDlg(null)} rodape={<Salvar onCancel={() => setDlg(null)} onPress={() => { const v = parseFloat(String(dlg.v).replace(',', '.')); if (isNaN(v) || v < 0 || v > dlg.max) return Alert.alert('Valor inválido', `Digite um valor entre 0 e ${dlg.max} ${dlg.un}.`); up((o) => { o.gps[dlg.k] = v; return o; }); setDlg(null); }} />}>
          <Text style={{ color: COR.tx, fontSize: 15, marginBottom: 10 }}>{dlg.tx}</Text>
          <Text style={{ color: COR.azulTx, fontSize: 12 }}>{dlg.lb}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: COR.azul, borderRadius: 4, paddingHorizontal: 10 }}>
            <TextInput value={dlg.v} onChangeText={(v) => setDlg({ ...dlg, v })} keyboardType="decimal-pad" autoFocus selectTextOnFocus style={{ flex: 1, paddingVertical: 10, fontSize: 18, color: COR.tx }} />
            <Text style={{ color: COR.tx2, fontSize: 15 }}>{dlg.un}</Text>
          </View>
          <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 4 }}>Entre 0 e {dlg.max} {dlg.un}</Text>
        </Cartao>
      )}
    </View>
  );
}

export function NavConfig({ st: st0, visible, onClose, piloto }) {
  const st = { ...st0,
    card: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COR.linha },
    tip: { color: COR.tx, fontWeight: '700', marginBottom: 6 }, tipTx: { color: COR.tx2, lineHeight: 22 },
    k: { color: COR.tx2, flex: 1 }, v: { color: COR.tx, fontWeight: '700' },
    input: { ...st0.input, color: COR.tx, borderColor: COR.linha }, field: { ...st0.field, color: COR.tx, borderColor: COR.linha },
    btn: { ...st0.btn, backgroundColor: COR.azul, borderRadius: 4, padding: 14 }, btnTx: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
    btn2: { ...st0.btn2, borderColor: COR.azulTx, borderRadius: 4 }, btn2Tx: { color: COR.azulTx, fontWeight: '700', fontSize: 13 },
    chip: { ...st0.chip, borderColor: COR.azulTx, borderRadius: 16 } };
  const [pag, setPag] = useState(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [impOpen, setImpOpen] = useState(false);
  const [impTx, setImpTx] = useState('');
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
  const exportar = () => Share.share({ message: JSON.stringify({ rally: 'layout', nome: atualL.nome, orient: atualL.orient, piloto: !!piloto, items: atualL.items }), title: 'Layout ' + atualL.nome }).catch(() => {});
  const importar = () => {
    try {
      const o = JSON.parse(impTx.trim());
      if (o.rally !== 'layout' || !Array.isArray(o.items)) throw new Error('x');
      const novo = { id: novoId(), nome: String(o.nome || 'Importado').slice(0, 30), piloto: !!piloto, orient: o.orient === 'h' ? 'h' : 'v', items: o.items.map((x, i) => ({ ...x, id: 'i' + i })) };
      gravaL({ ...L, [sk]: novo.id, list: [...L.list, novo] }); setImpOpen(false); setImpTx('');
    } catch { Alert.alert('Layout inválido', 'Cole o texto completo do layout exportado.'); }
  };
  const Lista = ({ ori, titulo }) => { const l = todos.filter((x) => (x.orient === 'h') === (ori === 'h')); return l.length ? (
    <View>
      <Text style={{ color: COR.tx2, fontSize: 13, marginTop: 10, marginBottom: 4 }}>{titulo}</Text>
      {l.map((x) => (
        <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COR.linha }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => gravaL({ ...L, [sk]: x.id })}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: L[sk] === x.id || (!L[sk] && x.id === 'padrao') ? COR.azul : '#90a4ae', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{L[sk] === x.id || (!L[sk] && x.id === 'padrao') ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: COR.azul }} /> : null}</View>
            <View><Text style={{ color: COR.tx, fontSize: 16 }}>{x.nome}</Text><Text style={{ color: COR.tx2, fontSize: 12 }}>Original: {piloto ? 'Piloto' : 'Navegador'}{x.id.startsWith('padrao') ? '' : ' · meu layout'}</Text></View>
          </TouchableOpacity>
          {!x.id.startsWith('padrao') && <TouchableOpacity onPress={() => apagarL(x)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: COR.tx2, fontSize: 20 }}>🗑</Text></TouchableOpacity>}
        </View>
      ))}
    </View>) : null; };
  const pagLayout = (
    <View>
      <Lista ori="v" titulo="Vertical" /><Lista ori="h" titulo="Horizontal" />
      <TouchableOpacity style={[st.btn, { marginTop: 16 }]} onPress={() => { setPag(null); onClose(); }}><Text style={st.btnTx}>✓  SELECIONAR</Text></TouchableOpacity>
      <TouchableOpacity style={st.btn} onPress={alterar}><Text style={st.btnTx}>✎  ALTERAR LAYOUT</Text></TouchableOpacity>
      <TouchableOpacity style={st.btn} onPress={() => setNovoOpen(true)}><Text style={st.btnTx}>+  CRIAR NOVO LAYOUT</Text></TouchableOpacity>
      <TouchableOpacity style={[st.btn, { backgroundColor: '#cfd8dc' }]} onPress={exportar}><Text style={[st.btnTx, { color: COR.tx2 }]}>⇪  EXPORTAR LAYOUT</Text></TouchableOpacity>
      <TouchableOpacity style={st.btn} onPress={() => setImpOpen(true)}><Text style={st.btnTx}>⇩  IMPORTAR LAYOUT</Text></TouchableOpacity>
    </View>
  );
  const itensMenu = [
    ['bot', '⌨', 'Botoeira', 'Configurações dos botões físicos'],
    ['gps', '⌖', 'GPS', 'Filtros do odômetro por GPS'],
    ['layout', '▦', 'Layout da tela', 'Escolher, criar, alterar, exportar e importar'],
    ['tnav', '⏱', 'T.Nav', 'Cores, formato e bipes adiantado e atrasado'],
    ['odo', '◔', 'Odômetro', 'Formatos e barras regressivas'],
    ['som', '🔊', 'Alertas sonoros', 'Bipes, voz, volume e avisos por distância'],
    ['trans', '⇅', 'Transição de referências', 'Quando a referência atual deixa de ficar em destaque'],
    ['rb', '☰', 'Roadbook na tela', 'Tulipas anteriores, seguintes e transição'],
  ];
  const titulos = { layout: 'Layout da tela', tnav: 'T.Nav', odo: 'Odômetro', barra: 'Barra regressiva', rb: 'Roadbook na tela' };
  const voltar = () => (pag ? setPag(null) : onClose());
  return (
    <Tela visible={visible} onRequestClose={voltar}>
      <View style={{ flex: 1, backgroundColor: COR.fundo }}>
        <View style={{ paddingTop: 40, paddingBottom: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.fundo }}>
          <TouchableOpacity onPress={voltar} style={{ position: 'absolute', left: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 8 }}><Text style={{ color: COR.azulTx, fontSize: 30, lineHeight: 30 }}>‹</Text></TouchableOpacity>
          <Text style={{ color: COR.tx, fontSize: 18, fontWeight: '500' }}>{pag ? (pag === 'layout' ? 'Layout da tela' : 'Configurações') : 'Configurações'}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
          {!pag && itensMenu.map(([k, ic, t, d]) => (
            <TouchableOpacity key={k} onPress={() => setPag(k)} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#d6f1f8', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Text style={{ color: COR.azulTx, fontSize: 20 }}>{ic}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: COR.tx, fontSize: 17, fontWeight: '500' }}>{t}</Text><Text style={{ color: COR.tx2, fontSize: 14 }}>{d}</Text></View>
              <Text style={{ color: COR.tx2, fontSize: 24 }}>›</Text>
            </TouchableOpacity>
          ))}
          {pag === 'layout' && pagLayout}
          {pag === 'tnav' && <TNavPagina c={c} up={up} />}
          {pag === 'odo' && <OdoPagina c={c} up={up} />}
          {pag === 'som' && <SomPagina c={c} up={up} />}
          {pag === 'trans' && <TransPagina c={c} up={up} />}
          {pag === 'bot' && <BotPagina c={c} up={up} />}
          {pag === 'gps' && <GpsPagina c={c} up={up} />}
          {pag === 'rb' && (<View>
          <View style={st.card}>
            <Text style={st.tip}>Roadbook na tela</Text>
            <Lin st={st} tx="Tulipas anteriores (0 a 4)"><Num st={st} v={c.rb.ant} on={(v) => up((o) => { o.rb.ant = Math.max(0, Math.min(4, Math.round(v))); return o; })} /></Lin>
            <Lin st={st} tx="Tulipas seguintes (0 a 8)"><Num st={st} v={c.rb.prox} on={(v) => up((o) => { o.rb.prox = Math.max(0, Math.min(8, Math.round(v))); return o; })} /></Lin>
            <Text style={st.tipTx}>A janela do roadbook é dividida entre as tulipas nessa proporção (30 a 150):</Text>
            <Lin st={st} tx="Anterior"><Num st={st} v={c.rb.pAnt} on={(v) => up((o) => { o.rb.pAnt = Math.max(30, Math.min(150, v)); return o; })} /></Lin>
            <Lin st={st} tx="Atual (a principal)"><Num st={st} v={c.rb.pAtual} on={(v) => up((o) => { o.rb.pAtual = Math.max(30, Math.min(150, v)); return o; })} /></Lin>
            {Array.from({ length: Math.min(8, c.rb.prox) }, (_, i) => i).map((i) => <Lin key={i} st={st} tx={`Seguinte ${i + 1}`}><Num st={st} v={c.rb.pProx[i] ?? 40} on={(v) => up((o) => { o.rb.pProx[i] = Math.max(30, Math.min(150, v)); return o; })} /></Lin>)}
          </View>
          </View>)}
          {!pag && <Text style={{ color: COR.tx2, textAlign: 'center', fontSize: 12, marginTop: 6 }}>As mudanças são salvas na hora.</Text>}
        </ScrollView>
      </View>
      <Modal visible={novoOpen} transparent animationType="fade" onRequestClose={() => setNovoOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 6, padding: 20 }}>
            <Text style={{ color: COR.tx, fontSize: 20, fontWeight: '500', marginBottom: 10 }}>Novo layout</Text>
            <Text style={{ color: COR.tx2, fontSize: 12 }}>Layout base</Text><Text style={{ color: COR.tx, fontSize: 15, marginBottom: 8 }}>{atualL.nome}</Text>
            <Text style={{ color: COR.tx2, fontSize: 12 }}>Função</Text><Text style={{ color: COR.tx, fontSize: 15, marginBottom: 8 }}>{piloto ? 'Piloto' : 'Navegador'}</Text>
            <Text style={{ color: COR.tx2, fontSize: 12, marginBottom: 4 }}>Orientação</Text>
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>{[['v', 'Vertical'], ['h', 'Horizontal']].map(([k, t]) => <Opc st={st} key={k} on={orN === k} tx={t} onPress={() => setOrN(k)} />)}</View>
            <TextInput style={{ borderWidth: 2, borderColor: COR.azul, borderRadius: 4, padding: 10, fontSize: 16, color: COR.tx }} value={nomeNovo} onChangeText={setNomeNovo} placeholder="Nome do layout" placeholderTextColor="#90a4ae" autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity onPress={() => setNovoOpen(false)} style={{ padding: 10 }}><Text style={{ color: COR.azulTx, fontWeight: '700' }}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { if (!nomeNovo.trim()) return Alert.alert('Falta o nome', 'Dê um nome para o novo layout.'); setNovoOpen(false); criar(); }} style={{ padding: 10 }}><Text style={{ color: COR.azulTx, fontWeight: '700' }}>CRIAR</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={impOpen} transparent animationType="fade" onRequestClose={() => setImpOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 6, padding: 20 }}>
            <Text style={{ color: COR.tx, fontSize: 20, fontWeight: '500', marginBottom: 10 }}>Importar layout</Text>
            <TextInput style={{ borderWidth: 1, borderColor: COR.linha, borderRadius: 4, padding: 10, minHeight: 110, color: COR.tx, textAlignVertical: 'top' }} value={impTx} onChangeText={setImpTx} placeholder="Cole aqui o layout exportado" placeholderTextColor="#90a4ae" multiline />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity onPress={() => setImpOpen(false)} style={{ padding: 10 }}><Text style={{ color: COR.azulTx, fontWeight: '700' }}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity onPress={importar} style={{ padding: 10 }}><Text style={{ color: COR.azulTx, fontWeight: '700' }}>IMPORTAR</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {edit && <Erro onClose={() => setEdit(null)}><LayoutEditor layout={edit} cfg={c} piloto={piloto} onSalvar={(lay) => gravaL({ ...L, list: L.list.map((y) => (y.id === lay.id ? lay : y)) })} onClose={() => setEdit(null)} /></Erro>}
    </Tela>
  );
}
