// Desenho de tulipa (cruzamento com a seta do caminho) e lista do roadbook.
import { Text, View } from 'react-native';
import { grupoIdx, comContinuacao, rotNeutro } from './rally';
import { DesenhoSvg } from './Desenho';
import Svg, { Circle, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

const km2 = (m) => (m / 1000).toFixed(3).replace('.', ',');

export function Tulipa({ e, size = 96 }) {
  if (e.dw && e.dw.length) return <DesenhoSvg items={e.dw} size={size} />;
  const c = 50, R = 40;
  const b = e.b || [];
  const base = e.i >= 0 && b[e.i] != null ? b[e.i] : 180;
  const rot = (x) => x - base + 180; // a rua de onde você vem sempre aponta para baixo
  const pt = (ang, r) => { const a = (ang * Math.PI) / 180; return [c + r * Math.sin(a), c - r * Math.cos(a)]; };
  const round = e.ty === 'roundabout' || e.ty === 'rotary' || e.ty === 'roundabout turn';
  const out = e.o >= 0 && b[e.o] != null ? rot(b[e.o]) : null;
  let arrow = null;
  if (out != null) {
    const [tx, ty] = pt(out, R + 4);
    const [bx, by] = pt(out, R - 12);
    const nx = -(ty - by) / 16, ny = (tx - bx) / 16; // normal à direção da seta
    arrow = `${tx},${ty} ${bx + nx * 7},${by + ny * 7} ${bx - nx * 7},${by - ny * 7}`;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x="0" y="0" width="100" height="100" rx="8" fill="#ffffff" />
      {b.map((ang, j) => {
        const [x, y] = pt(rot(ang), R);
        const isIn = j === e.i, isOut = j === e.o;
        return <Line key={j} x1={c} y1={c} x2={x} y2={y} stroke={isIn || isOut ? '#111' : '#666'} strokeWidth={isIn || isOut ? 7 : 2} strokeLinecap="round" />;
      })}
      {round && <Circle cx={c} cy={c} r="13" fill="#fff" stroke="#111" strokeWidth="3" />}
      {round && e.ex ? <SvgText x={c} y={c + 5} fontSize="15" fontWeight="bold" fill="#111" textAnchor="middle">{String(e.ex)}</SvgText> : null}
      {arrow && <Polygon points={arrow} fill="#111" />}
      <Circle cx={c} cy={c + R - 2} r="4" fill="#d32f2f" />
    </Svg>
  );
}

const LABEL = { L: 'LARGADA', C: 'CHEGADA' };
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Texto do tipo do trecho que começa neste ponto (V por classe, ou D com tempo).
export function rotuloNx(nx, classe, grupos) {
  if (!nx) return null;
  if (nx.t === 'D') return { txt: `D ${nx.min}'`, cor: '#ffe600', fg: '#000' };
  if (Array.isArray(nx.v)) {
    if (classe) return { txt: `V ${nx.v[grupoIdx(classe, grupos)] ?? nx.v[0]}`, cor: '#2e7d32', fg: '#fff' };
    return { txt: 'V ' + nx.v.map((x, i) => `${String.fromCharCode(65 + i)} ${x}`).join(' · '), cor: '#2e7d32', fg: '#fff' };
  }
  const v = classe === 'AMADOR' ? nx.ka : classe ? nx.kg : null;
  return { txt: v != null ? `V ${v}` : `V ${nx.kg} · A ${nx.ka}`, cor: '#2e7d32', fg: '#fff' };
}

// O PC (cronometragem) é do organizador: o competidor só vê os pontos com neutro.
export const tulComp = (tul) => tul.filter((e) => e.t !== 'P' || e.nt > 0);

const hms = (sec) => { const x = Math.max(0, sec); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), r = x - h * 3600 - m * 60; return `${h}:${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`; };

export function Entrada({ e, st, destaque, faltam, classe, grupos, org }) {
  const neuDw = e.t === 'P' && e.nt > 0 && !!((e.dw && e.dw.length) || Array.isArray(e.b));
  const marcador = e.t !== 'T' && !neuDw;
  const soNeutro = e.t === 'P' && e.nt > 0 && !org;
  const nx = rotuloNx(e.nx, classe, grupos);
  const gi = classe ? grupoIdx(classe, grupos) : 0;
  const tm = e.tm ? e.tm[gi] ?? e.tm[0] : null;
  const velBox = e.nx ? (
    <View style={{ borderWidth: 2, borderColor: '#f5f5f5', borderRadius: 6, paddingVertical: 2, width: 58, alignItems: 'center' }}>
      {e.nx.t === 'D' ? (<><Text style={{ color: '#ffe600', fontWeight: '900', fontSize: 16 }}>D</Text><Text style={{ color: '#ffe600', fontWeight: '800', fontSize: 13 }}>{e.nx.min}'</Text></>) : (<>
        <Text style={{ color: '#f5f5f5', fontWeight: '900', fontSize: 16 }}>V</Text>
        <Text style={{ color: '#f5f5f5', fontWeight: '900', fontSize: 20 }}>{Array.isArray(e.nx.v) ? (classe ? e.nx.v[gi] ?? e.nx.v[0] : e.nx.v[0]) : (classe === 'AMADOR' ? e.nx.ka : e.nx.kg)}</Text>
        <Text style={{ color: '#f5f5f5', fontWeight: '700', fontSize: 11 }}>Km/h</Text></>)}
    </View>
  ) : <View style={{ width: 58 }} />;
  const colKm = (
    <View style={{ width: 66, alignItems: 'flex-end', paddingRight: 8 }}>
      <Text style={{ color: '#a8a8a8', fontSize: 11 }}>{km2(e.p)}</Text>
      <Text style={{ color: '#f5f5f5', fontWeight: '900', fontSize: 18 }}>{km2(e.dz ?? e.d)}</Text>
      {e.zero ? <Text style={{ color: '#000', backgroundColor: '#ffe600', fontWeight: '900', fontSize: 14, paddingHorizontal: 6, marginTop: 2 }}>0.000 · ZERE</Text> : null}
      {faltam != null && <Text style={{ color: '#ffb300', fontWeight: '800', fontSize: 11 }}>faltam {Math.max(0, Math.round(faltam))} m</Text>}
    </View>
  );
  const colTempo = tm != null ? (
    <View style={{ width: 82, alignItems: 'center' }}>
      <Text style={{ color: '#f5f5f5', fontWeight: '800', fontSize: 13 }}>{hms(tm)}</Text>
      <Text style={{ color: '#a8a8a8', fontSize: 11 }}>{e.tl || (neuDw ? 'N' : 'T' + e.tn)}</Text>
    </View>
  ) : null;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#262b32', backgroundColor: neuDw ? '#3b1d4a' : undefined, paddingVertical: 6, borderLeftWidth: destaque ? 4 : 0, borderLeftColor: '#ff7a2e', paddingLeft: destaque ? 8 : 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {colKm}
        {marcador ? (
          <View style={{ flex: 1, gap: 4 }}>
            {soNeutro ? (
              <View style={{ backgroundColor: '#6a1b9a', borderRadius: 10, padding: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>NEUTRO · PARE {mmss(e.nt)}</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: e.t === 'C' ? '#c0392b' : '#37474f', borderRadius: 10, padding: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{e.t === 'P' ? (e.nt > 0 && e.pn == null ? 'NEUTRO' : `PC ${e.pn ?? e.n}`) : LABEL[e.t]}</Text>
              </View>
            )}
            {e.nt > 0 && !soNeutro && (
              <View style={{ backgroundColor: '#c0392b', borderRadius: 10, padding: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>N · PARE {mmss(e.nt)}</Text>
              </View>
            )}
            {nx && (
              <View style={{ backgroundColor: nx.cor, borderRadius: 10, padding: 8 }}>
                <Text style={{ color: nx.fg, fontWeight: '800' }}>{nx.txt}</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', marginRight: 8 }}>
              <Tulipa e={e} size={destaque ? 100 : 76} />
              {e.rn != null && <Text style={{ color: '#a8a8a8', fontSize: 11 }}>{e.rn}</Text>}
            </View>
            {neuDw ? <View style={{ backgroundColor: '#6a1b9a', borderRadius: 10, padding: 8, width: 78, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>N</Text><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{rotNeutro(e.nt)}</Text><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{e.nt < 60 ? 'Seg' : 'min'}</Text></View> : velBox}
            <View style={{ width: 6 }} />
            {colTempo}
            {e.nm ? <View style={{ flex: 1, backgroundColor: '#ffe600', borderRadius: 6, padding: 6, marginLeft: 6, alignSelf: 'stretch', justifyContent: 'center' }}><Text style={{ color: '#000', fontWeight: '900', fontSize: 14, textAlign: 'center' }}>{e.nm}</Text></View> : null}
          </>
        )}
      </View>
      {!marcador && e.nm ? <Text style={{ color: '#f5f5f5', marginTop: 4, marginLeft: 66, fontSize: 13 }}>{e.nm}</Text> : null}
    </View>
  );
}

// Lista completa. 'dist' = posição atual no percurso (m); null = só pré-visualização.
export function Roadbook({ st, tul: tul0, dist, classe, grupos, org }) {
  const tul = comContinuacao(org ? tul0 : tulComp(tul0));
  const atual = dist == null ? -1 : tul.findIndex((e) => e.d >= dist - 15);
  return (
    <View>
      {tul.map((e, i) => (
        <Entrada key={i} org={org} e={e} st={st} classe={classe} grupos={grupos} destaque={i === atual} faltam={i === atual ? e.d - dist : null} />
      ))}
    </View>
  );
}
