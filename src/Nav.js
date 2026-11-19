// Tela do navegador (durante a prova) e tela de personalização (antes da prova).
// Durante a prova nada é editável, só os botões de correção (+10 m, -10 m, PC) e o menu ⋮.
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as Battery from 'expo-battery';
import { useKeepAwake } from 'expo-keep-awake';
import { Tulipa, rotuloNx } from './Tulipa';
import { DesenhoSvg } from './Desenho';
import { loadJson, saveJson } from './persist';
import { fmtDur } from './rally';

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
  rb: { ant: 1, prox: 2, pAnt: 60, pAtual: 100, pProx: [80, 60, 50] },
};
export const loadNav = () => {
  const c = loadJson('navcfg', {});
  return { ...NAV_PADRAO, ...c, tiles: { ...NAV_PADRAO.tiles, ...(c.tiles || {}) }, ref: { ...NAV_PADRAO.ref, ...(c.ref || {}) }, trc: { ...NAV_PADRAO.trc, ...(c.trc || {}) }, rb: { ...NAV_PADRAO.rb, ...(c.rb || {}) } };
};
export const saveNav = (c) => saveJson('navcfg', c);

const CORES = ['#f5e50f', '#e53935', '#1e88e5', '#43a047', '#fb8c00', '#000000', '#ffffff'];
const fgDe = (bg) => (['#f5e50f', '#fb8c00', '#ffffff', '#43a047'].includes(bg) ? '#000' : '#fff');
const num = (s) => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? 0 : v; };

export function fmtDist(m, c) {
  const v = Math.max(0, m);
  return c.un === 'km' ? (v / 1000).toFixed(c.dec).replace('.', ',') : v.toFixed(c.dec).replace('.', ',');
}
export function fmtTnav(sec, dec) {
  const a = Math.abs(sec).toFixed(dec).replace('.', ',');
  return (sec >= 0 ? '+' : '−') + a;
}
export function faixaDe(sec, cfg) {
  const f = cfg.faixas.find((x) => sec >= x.a && sec <= x.b);
  return f ? { bg: f.bg, fg: fgDe(f.bg) } : { bg: '#000', fg: '#fff' };
}

function Box({ label, children, bg = '#000', fg = '#fff', style, lc }) {
  return (
    <View style={[{ backgroundColor: bg, borderWidth: 1, borderColor: '#444', padding: 4, alignItems: 'center', justifyContent: 'center' }, style]}>
      {label ? <Text style={{ color: lc || fg, fontSize: 11 }}>{label}</Text> : null}
      {children}
    </View>
  );
}

function LinhaRb({ e, pct, atual, w, classe, grupos }) {
  const h = Math.round((w * 0.46 * pct) / 100), k = Math.max(0.6, pct / 100);
  const bg = atual ? '#f5e50f' : '#fff';
  if (e.t !== 'T') {
    const txt = e.t === 'P' ? `PC ${e.n}${e.nt > 0 ? ' · NEUTRO' : ''}` : e.t === 'L' ? 'LARGADA' : 'CHEGADA';
    const nx = rotuloNx(e.nx, classe, grupos);
    return (
      <View style={{ backgroundColor: e.t === 'C' ? '#c0392b' : '#37474f', paddingVertical: 6 * k, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 * k }}>{txt}  {fmtDist(e.d, { un: 'km', dec: 3 })}</Text>
        {nx ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 * k }}>{nx.txt}</Text> : null}
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: bg, flexDirection: 'row', height: h, borderBottomWidth: 1, borderBottomColor: '#999' }}>
      <View style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 2 }}>
        <Text style={{ color: '#000', fontSize: 12 * k, textAlign: 'right' }}>{fmtDist(e.p, { un: 'km', dec: 3 })}</Text>
        <Text style={{ color: '#000', fontSize: 26 * k, fontWeight: '800' }}>{fmtDist(e.d, { un: 'km', dec: 3 })}</Text>
        {e.nm ? <Text style={{ color: '#000', fontSize: 11 * k }} numberOfLines={2}>{e.nm}</Text> : null}
      </View>
      <View style={{ width: h, height: h }}>
        {e.dw && e.dw.length ? <DesenhoSvg items={e.dw} size={h} /> : <Tulipa e={e} size={h} />}
      </View>
    </View>
  );
}

export function NavTela({ cfg, stage, rs, last, globalDist, odoM, tul, rot, classe, grupos, aviso, onAdj, onPc, onZerar, onClose }) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const [t, setT] = useState(Date.now());
  const [menu, setMenu] = useState(false);
  const bat = Battery.useBatteryLevel();
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 200); return () => clearInterval(id); }, []);
  const T = cfg.tiles;
  const sc = Math.min(1.2, width / 380);
  // velocidade real e T.NAV com extrapolação até o instante atual (o GPS chega ~1 vez por segundo)
  const spd = last && last.spd != null && last.spd >= 0 ? last.spd : null;
  const dt = last ? Math.min(1.5, Math.max(0, (t - last.t) / 1000)) : 0;
  const v = stage.targetKmh / 3.6;
  const tnav = rs && rs.aheadSec != null && v > 0 ? rs.aheadSec + (((spd ?? 0) - v) * dt) / v : null;
  const fx = tnav != null ? faixaDe(Number(tnav.toFixed(cfg.tnavDec)), cfg) : { bg: '#000', fg: '#fff' };
  // próxima referência (tulipa) e fim do trecho
  const iAt = tul.length ? Math.max(0, tul.findIndex((e) => e.d >= globalDist - 15)) : -1;
  const iAtual = iAt < 0 ? -1 : (tul.findIndex((e) => e.d >= globalDist - 15) < 0 ? tul.length - 1 : iAt);
  const prox = iAtual >= 0 ? tul.find((e, i) => i >= iAtual && e.d - globalDist > 0) : null;
  const regRef = prox ? prox.d - globalDist : null;
  const trAtual = stage.idx >= 0 ? rot.trechos[stage.idx] : null;
  const trProx = stage.idx >= 0 ? rot.trechos[stage.idx + 1] : null;
  const regTrc = rs && rs.remain != null ? rs.remain : null;
  const placa = (tr) => (tr ? (tr.tipo === 'D' ? { tx: `D${tr.min}'`, d: true } : { tx: String(Math.round(tr.kmh)), d: false }) : null);
  const pa = placa(trAtual), pp = placa(trProx);
  const wR = width * 0.62;
  const rb = cfg.rb;
  const linhasRb = [];
  if (T.rb && iAtual >= 0) {
    for (let k = rb.ant; k >= 1; k--) if (tul[iAtual - k]) linhasRb.push({ e: tul[iAtual - k], pct: rb.pAnt, key: 'a' + k });
    linhasRb.push({ e: tul[iAtual], pct: rb.pAtual, atual: true, key: 'c' });
    for (let k = 1; k <= rb.prox; k++) if (tul[iAtual + k]) linhasRb.push({ e: tul[iAtual + k], pct: rb.pProx[k - 1] ?? 50, key: 'p' + k });
  }
  const confirma = (tit, msg, fn) => { setMenu(false); Alert.alert(tit, msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: fn }]); };

  return (
    <Modal visible animationType="fade" onRequestClose={() => setMenu(true)}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 26 }}>
        {aviso ? <View style={{ backgroundColor: '#c0392b', padding: 6 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800', fontSize: 16 }}>{aviso}</Text></View> : null}
        {(T.odo || T.tnav) && (
          <View style={{ flexDirection: 'row' }}>
            {T.odo && <Box label="ODÔMETRO (GPS)" style={{ flex: 1.1, height: 118 * sc }}><Text style={{ color: '#fff', fontSize: 46 * sc, fontWeight: '800' }}>{(odoM / 1000).toFixed(3)}</Text></Box>}
            {T.tnav && (
              <Box label="T.NAV" bg={fx.bg} fg={fx.fg} style={{ flex: 1, height: 118 * sc }}>
                <Text style={{ color: fx.fg, fontSize: 52 * sc, fontWeight: '800' }}>{tnav != null ? fmtTnav(tnav, cfg.tnavDec) : '—'}</Text>
                <TouchableOpacity onPress={() => setMenu((m) => !m)} style={{ position: 'absolute', top: 2, right: 4, padding: 8 }}><Text style={{ color: fx.fg, fontSize: 26, fontWeight: '900' }}>⋮</Text></TouchableOpacity>
              </Box>
            )}
          </View>
        )}
        {menu && (
          <View style={{ position: 'absolute', top: 70, right: 10, zIndex: 9, backgroundColor: '#fff', borderRadius: 8, padding: 6, elevation: 8 }}>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => confirma('Zerar odômetro', 'Zerar o odômetro (GPS) agora? Não altera o T.NAV nem a posição no roadbook.', onZerar)}><Text style={{ fontSize: 16, color: '#000' }}>Zerar odômetro</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => confirma('Sair da tela de prova', 'Voltar ao menu? O trecho e o GPS continuam.', onClose)}><Text style={{ fontSize: 16, color: '#000' }}>Sair da tela de prova</Text></TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => setMenu(false)}><Text style={{ fontSize: 16, color: '#666' }}>Fechar menu</Text></TouchableOpacity>
          </View>
        )}
        {(T.vel || T.regref || T.atual) && (
          <View style={{ flexDirection: 'row' }}>
            {T.vel && <Box label="VELOCIDADE" style={{ flex: 1, height: 96 * sc }}><Text style={{ color: '#fff', fontSize: 40 * sc, fontWeight: '800' }}>{spd != null ? Math.round(spd * 3.6) : '—'}</Text></Box>}
            {T.regref && <Box label="REG REF" style={{ flex: 1, height: 96 * sc }}><Text style={{ color: '#fff', fontSize: 40 * sc, fontWeight: '800' }}>{regRef != null ? fmtDist(regRef, cfg.ref) : '—'}</Text></Box>}
            {T.atual && (
              <Box label="ATUAL" style={{ flex: 1, height: 96 * sc }}>
                {pa ? <View style={{ backgroundColor: pa.d ? '#f5e50f' : '#fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 }}><Text style={{ color: '#000', fontSize: 26 * sc, fontWeight: '800' }}>{pa.d ? pa.tx : `V ${pa.tx}`}</Text></View> : <Text style={{ color: '#fff', fontSize: 30 }}>—</Text>}
              </Box>
            )}
          </View>
        )}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: width - wR }}>
            {(T.prox || T.regtrc) && (
              <View>
                {T.prox && (
                  <Box label="PRÓXIMO" style={{ height: 84 * sc }}>
                    {pp ? <View style={{ backgroundColor: pp.d ? '#f5e50f' : '#fff', borderColor: '#1a237e', borderWidth: pp.d ? 0 : 4, borderRadius: pp.d ? 6 : 30, minWidth: 48, height: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: '#000', fontSize: 20 * sc, fontWeight: '800' }}>{pp.tx}</Text></View> : <Text style={{ color: '#fff', fontSize: 24 }}>—</Text>}
                  </Box>
                )}
                {T.regtrc && <Box label="REG TRC" style={{ height: 70 * sc }}><Text style={{ color: '#fff', fontSize: 28 * sc, fontWeight: '800' }}>{regTrc != null ? fmtDist(regTrc, cfg.trc) : '—'}</Text></Box>}
              </View>
            )}
            {T.pm && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 2, gap: 4 }}>
                <TouchableOpacity style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: '#9e9e9e', borderRadius: 8, paddingVertical: 18 * sc, alignItems: 'center' }} onPress={() => onAdj(10)}><Text style={{ fontSize: 24 * sc, fontWeight: '800', color: '#000' }}>+10</Text></TouchableOpacity>
                <TouchableOpacity style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: '#9e9e9e', borderRadius: 8, paddingVertical: 18 * sc, alignItems: 'center' }} onPress={() => onAdj(-10)}><Text style={{ fontSize: 24 * sc, fontWeight: '800', color: '#000' }}>-10</Text></TouchableOpacity>
                <TouchableOpacity style={{ flexBasis: '100%', backgroundColor: '#2e7d32', borderRadius: 8, paddingVertical: 14 * sc, alignItems: 'center' }} onPress={onPc}><Text style={{ fontSize: 22 * sc, fontWeight: '800', color: '#fff' }}>PC</Text></TouchableOpacity>
              </View>
            )}
            {T.bat && bat >= 0 && (
              <View style={{ margin: 2, borderWidth: 2, borderColor: '#fff', borderRadius: 6, height: 40 * sc, justifyContent: 'center' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(bat * 100)}%`, backgroundColor: bat > 0.3 ? '#1b9e57' : '#e53935' }} />
                <Text style={{ color: '#fff', fontSize: 22 * sc, fontWeight: '800', textAlign: 'center' }}>{Math.round(bat * 100)}%</Text>
              </View>
            )}
          </View>
          <View style={{ width: wR, overflow: 'hidden' }}>
            {linhasRb.map((l) => <LinhaRb key={l.key} e={l.e} pct={l.pct} atual={l.atual} w={wR} classe={classe} grupos={grupos} />)}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Personalização (antes da prova) ----------
function Lin({ st, tx, children }) { return <View style={st.line}><Text style={st.k}>{tx}</Text>{children}</View>; }
const NOMES = { odo: 'Odômetro (GPS)', tnav: 'T.NAV', vel: 'Velocidade', regref: 'REG REF', atual: 'Atual (média do trecho)', prox: 'Próximo (média)', regtrc: 'REG TRC', pm: 'Botões +10 / −10 / PC', bat: 'Bateria', rb: 'Roadbook' };

export function NavConfig({ st, visible, onClose }) {
  const [c, setC] = useState(loadNav);
  const up = (fn) => setC((o) => { const n = fn(JSON.parse(JSON.stringify(o))); saveNav(n); return n; });
  const Opc = ({ on, tx, onPress }) => <TouchableOpacity style={[st.btn2, { flex: 0, paddingHorizontal: 12, paddingVertical: 8 }, on && { backgroundColor: '#ff7a2e' }]} onPress={onPress}><Text style={[st.btn2Tx, on && { color: '#0c1014' }]}>{tx}</Text></TouchableOpacity>;
  const Num = ({ v, on, w = 56 }) => <TextInput style={[st.input, { minWidth: w }]} defaultValue={String(v)} keyboardType="numbers-and-punctuation" onEndEditing={(e) => on(num(e.nativeEvent.text))} />;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0c1014', paddingTop: 36 }}>
        <Text style={[st.tip, { paddingHorizontal: 12 }]}>Personalizar a tela da prova</Text>
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
          <View style={st.card}>
            <Text style={st.tip}>Janelas na tela</Text>
            {Object.keys(NOMES).map((k) => (
              <Lin key={k} st={st} tx={NOMES[k]}><Switch value={!!c.tiles[k]} onValueChange={(v) => up((o) => { o.tiles[k] = v; return o; })} /></Lin>
            ))}
          </View>
          <View style={st.card}>
            <Text style={st.tip}>T.NAV</Text>
            <Text style={st.tipTx}>Mais (+) = adiantado, menos (−) = atrasado, em segundos.</Text>
            <View style={[st.row, { marginTop: 6 }]}>
              {[0, 1, 2].map((d) => <Opc key={d} on={c.tnavDec === d} tx={`${d} casa${d === 1 ? '' : 's'}`} onPress={() => up((o) => { o.tnavDec = d; return o; })} />)}
            </View>
            <Text style={st.tip}>Cores por faixa de segundos (fora das faixas: fundo preto, letra branca)</Text>
            {c.faixas.map((f, i) => (
              <View key={i} style={[st.line, { alignItems: 'center' }]}>
                <Num v={f.a} on={(v) => up((o) => { o.faixas[i].a = v; return o; })} />
                <Text style={st.k}>até</Text>
                <Num v={f.b} on={(v) => up((o) => { o.faixas[i].b = v; return o; })} />
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
          {[['ref', 'REG REF (até a próxima referência)'], ['trc', 'REG TRC (até o fim do trecho)']].map(([k, nome]) => (
            <View key={k} style={st.card}>
              <Text style={st.tip}>{nome}</Text>
              <View style={[st.row, { marginTop: 6 }]}>
                <Opc on={c[k].un === 'm'} tx="metros" onPress={() => up((o) => { o[k].un = 'm'; return o; })} />
                <Opc on={c[k].un === 'km'} tx="km" onPress={() => up((o) => { o[k].un = 'km'; o[k].dec = 3; return o; })} />
              </View>
              <View style={st.row}>
                {[0, 1, 2, 3].map((d) => <Opc key={d} on={c[k].dec === d} tx={`${d} casas`} onPress={() => up((o) => { o[k].dec = d; return o; })} />)}
              </View>
            </View>
          ))}
          <View style={st.card}>
            <Text style={st.tip}>Roadbook na tela</Text>
            <Lin st={st} tx="Tulipas anteriores (0 a 2)"><Num v={c.rb.ant} on={(v) => up((o) => { o.rb.ant = Math.max(0, Math.min(2, Math.round(v))); return o; })} /></Lin>
            <Lin st={st} tx="Tulipas seguintes (0 a 3)"><Num v={c.rb.prox} on={(v) => up((o) => { o.rb.prox = Math.max(0, Math.min(3, Math.round(v))); return o; })} /></Lin>
            <Text style={st.tipTx}>Tamanho em % do original (30 a 150):</Text>
            <Lin st={st} tx="Anterior"><Num v={c.rb.pAnt} on={(v) => up((o) => { o.rb.pAnt = Math.max(30, Math.min(150, v)); return o; })} /></Lin>
            <Lin st={st} tx="Atual (a principal)"><Num v={c.rb.pAtual} on={(v) => up((o) => { o.rb.pAtual = Math.max(30, Math.min(150, v)); return o; })} /></Lin>
            {[0, 1, 2].map((i) => <Lin key={i} st={st} tx={`Seguinte ${i + 1}`}><Num v={c.rb.pProx[i]} on={(v) => up((o) => { o.rb.pProx[i] = Math.max(30, Math.min(150, v)); return o; })} /></Lin>)}
          </View>
          <TouchableOpacity style={[st.btn, { marginTop: 4 }]} onPress={onClose}><Text style={st.btnTx}>Pronto</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
