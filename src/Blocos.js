// Blocos visuais da tela de prova. Usados na prova (dados reais) e no editor de layout (dados de exemplo).
import { Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Tulipa, rotuloNx } from './Tulipa';
import { DesenhoSvg } from './Desenho';
import { fmtDur } from './rally';

const fgDe = (bg) => (['#f5e50f', '#fb8c00', '#ffffff', '#43a047'].includes(bg) ? '#000' : '#fff');
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
const p2 = (x) => String(x).padStart(2, '0');
const hms = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };

export function LinhaRb({ e, pct, atual, w, classe, grupos }) {
  const h = Math.round((w * 0.46 * pct) / 100), k = Math.max(0.6, pct / 100);
  const bg = atual ? '#f5e50f' : '#fff';
  if (e.t !== 'T') {
    const mm = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
    const txt = e.t === 'P' ? (e.nt > 0 ? `NEUTRO · PARE ${mm(e.nt)}` : `PC ${e.n}`) : e.t === 'L' ? 'LARGADA' : 'CHEGADA';
    const nx = rotuloNx(e.nx, classe, grupos);
    return (
      <View style={{ backgroundColor: e.t === 'C' ? '#c0392b' : e.t === 'P' && e.nt > 0 ? '#6a1b9a' : '#37474f', paddingVertical: 6 * k, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
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

function Placa({ tipo, pl, w, h }) {
  if (!pl) return <Text style={{ color: '#fff', fontSize: 22 }}>—</Text>;
  const s = Math.max(20, Math.min(w - 8, h - 18));
  if (pl.d) return <View style={{ backgroundColor: '#f5e50f', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: '#000', fontSize: s * 0.45, fontWeight: '800' }}>{pl.tx}</Text></View>;
  if (tipo === 'atual') {
    return <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: '#fff', borderWidth: s * 0.1, borderColor: '#2f3df0', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#222', fontSize: s * 0.42, fontWeight: '800' }}>{pl.tx}</Text></View>;
  }
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Polygon points="4,4 96,4 96,66 50,97 4,66" fill="#fff" stroke="#f4511e" strokeWidth="9" />
      </Svg>
      <Text style={{ color: '#222', fontSize: s * 0.38, fontWeight: '800', marginTop: -s * 0.06 }}>{pl.tx}</Text>
    </View>
  );
}

export function Bloco({ tipo, d, w, h }) {
  const cfg = d.cfg;
  // Barra regressiva: a janela enche da esquerda para a direita a partir de 'ini' metros e fica cheia em zero.
  const barra = (m) => (cfg.barra && cfg.barra.on && m != null ? Math.min(1, Math.max(0, 1 - m / Math.max(1, cfg.barra.ini))) : null);
  const Cx = ({ label, bg = '#000', fg = '#fff', v, children, fill, fillCor }) => {
    const lh = label ? Math.min(12, h * 0.22) : 0;
    const fs = Math.max(10, Math.min((h - lh) * 0.68, w * 0.4, 140));
    return (
      <View style={{ width: w, height: h, backgroundColor: bg, borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {fill != null ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(fill * 100)}%`, backgroundColor: fillCor }} /> : null}
        {label ? <Text style={{ position: 'absolute', top: 1, color: fg, fontSize: lh }} numberOfLines={1}>{label}</Text> : null}
        <View style={{ width: '94%', alignItems: 'center', marginTop: lh }}>
          {v != null ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.3} style={{ color: fg, fontWeight: '800', fontSize: fs, textAlign: 'center' }}>{v}</Text> : children}
        </View>
      </View>
    );
  };
  const Btn = ({ tx, bg, fg = '#000', on }) => (
    <TouchableOpacity activeOpacity={0.7} disabled={d.edit} onPress={on} style={{ width: w, height: h, backgroundColor: bg, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: Math.max(12, Math.min(h * 0.5, w * 0.4)), fontWeight: '800' }}>{tx}</Text>
    </TouchableOpacity>
  );
  switch (tipo) {
    case 'tnav': return <Cx label="T.NAV" bg={d.fx.bg} fg={d.fx.fg} v={Number.isFinite(d.tnav) ? fmtTnav(d.tnav, cfg.tnavDec) : '—'} />;
    case 'regref': return <Cx label="REG REF" fill={barra(d.regRef)} fillCor={cfg.barra.cor} v={Number.isFinite(d.regRef) ? fmtDist(d.regRef, cfg.ref) : '—'} />;
    case 'regref2': return <Cx label="PRÓXIMA REF" fill={barra(d.regRef2)} fillCor={cfg.barra.cor} v={Number.isFinite(d.regRef2) ? fmtDist(d.regRef2, cfg.ref) : '—'} />;
    case 'regtrc': return <Cx label="PRÓX. TRECHO" fill={barra(d.regTrc)} fillCor={cfg.barra.cor} v={Number.isFinite(d.regTrc) ? fmtDist(d.regTrc, cfg.trc) : '—'} />;
    case 'vel': return <Cx label="VELOCIDADE (GPS)" v={Number.isFinite(d.spd) ? Math.round(d.spd * 3.6) : '—'} />;
    case 'odo': return <Cx label="ODÔMETRO (GPS)" v={fmtDist(Number.isFinite(d.odoM) ? d.odoM : 0, (d.cfg && d.cfg.odo) || { un: 'km', dec: 3 })} />;
    case 'relogio': return <Cx label="RELÓGIO GPS" v={hms(d.clock)} />;
    case 'prec': return <Cx label="PRECISÃO GPS" v={d.acc != null ? `${Math.round(d.acc)} m` : '—'} />;
    case 'trcn': return <Cx label="TRECHO" v={d.trN || '—'} />;
    case 'refn': return <Cx label="REFERÊNCIA" v={d.refN || '—'} />;
    case 'kmac': return <Cx label="KM ACUMULADO" v={((Number.isFinite(d.kmAcum) ? d.kmAcum : 0) / 1000).toFixed(3)} />;
    case 'cron': return <Cx label="TEMPO DO TRECHO" v={Number.isFinite(d.elapsed) ? fmtDur(d.elapsed) : '—'} />;
    case 'atual': return <Cx label="ATUAL"><Placa tipo="atual" pl={d.pa} w={w} h={h} /></Cx>;
    case 'prox': return <Cx label="PRÓXIMO"><Placa tipo="prox" pl={d.pp} w={w} h={h} /></Cx>;
    case 'bat': return (
      <View style={{ width: w, height: h, borderWidth: 2, borderColor: '#fff', borderRadius: 6, justifyContent: 'center', backgroundColor: '#000' }}>
        {d.bat >= 0 ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(d.bat * 100)}%`, backgroundColor: d.bat > 0.3 ? '#1b9e57' : '#e53935' }} /> : null}
        <Text style={{ color: '#fff', fontSize: Math.max(11, Math.min(h * 0.6, 28)), fontWeight: '800', textAlign: 'center' }}>{d.bat >= 0 ? Math.round(d.bat * 100) + '%' : '—'}</Text>
      </View>
    );
    case 'p10': return <Btn tx="+10" bg="#9e9e9e" on={() => d.onAdj(10)} />;
    case 'm10': return <Btn tx="−10" bg="#9e9e9e" on={() => d.onAdj(-10)} />;
    case 'p1': return <Btn tx="+1" bg="#9e9e9e" on={() => d.onAdj(1)} />;
    case 'm1': return <Btn tx="−1" bg="#9e9e9e" on={() => d.onAdj(-1)} />;
    case 'pc': return <Btn tx="PC" bg="#2e7d32" fg="#fff" on={d.onPc} />;
    case 'rb': return (
      <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: '#000' }}>
        {d.fim ? <View style={{ backgroundColor: '#c0392b', paddingVertical: 6, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>FIM DA PROVA</Text></View> : null}
        {d.rbLinhas ? d.rbLinhas.map((l) => <LinhaRb key={l.key} e={l.e} pct={l.pct} atual={l.atual} w={w} classe={d.classe} grupos={d.grupos} />)
          : <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#999' }}><Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>ROADBOOK</Text><Text style={{ color: '#555', fontSize: 12 }}>as tulipas aparecem aqui</Text></View>}
      </View>
    );
    default: return <Cx label={(tipo || '').toUpperCase()} v="em breve" fg="#9e9e9e" />;
  }
}
