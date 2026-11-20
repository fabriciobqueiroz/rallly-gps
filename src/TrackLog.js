// Track log: o rastro enviado pelo competidor (datalogger) sobre o percurso levantado pelo organizador.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MapaWeb from './MapaWeb';
import Tela from './Tela';
import { haversine } from './store';
import { ouvirDataloggers, ouvirMeuDatalogger } from './firebase';
import { GRUPOS_PADRAO, oficialDeTrilha, pcsDoLogger, pontos, resolverTrecho } from './rally';

const clock = (ms) => { const d = new Date(ms); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':'); };
const sg = (s) => `${s >= 0 ? '+' : '−'}${Math.abs(s).toFixed(1).replace('.', ',')} s`;

// Resultado do competidor a partir do datalogger: PCs, previsto x real, diferença e pontos (1 ponto por segundo).
export function calcDl(dl, provaMap, grupos) {
  const larg = dl.tIni || dl.t0;
  let pcs = [];
  try { pcs = oficialDeTrilha(pcsDoLogger(dl), provaMap.wps || [], provaMap.trechos || [], dl.classe, grupos || GRUPOS_PADRAO, larg, provaMap.pcl || []); } catch {}
  const rows = pcs.map((p) => {
    const prev = p.idealTime != null ? p.t0 + p.idealTime * 1000 : null;
    return { n: p.n, trc: p.trecho, km: (p.dist || 0) / 1000, tprova: (p.t - larg) / 1000, tipo: p.tipo, prev, real: p.t, diff: p.diff, pts: p.diff != null && p.tipo !== 'D' ? Math.abs(p.diff) : 0 };
  });
  return { larg, rows, total: pontos(pcs), npcs: pcs.length, zerados: rows.filter((x) => x.diff != null && x.tipo !== 'D' && Math.round(x.diff) === 0).length };
}

function Tabela({ st, dl, provaMap, grupos }) {
  const r = useMemo(() => calcDl(dl, provaMap, grupos), [dl, provaMap, grupos]);
  const C = ({ t, w, c, b }) => <Text style={{ width: w, color: c || '#f5f5f5', fontSize: 12, fontWeight: b ? '800' : '400', textAlign: 'center' }}>{t}</Text>;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={st.v}>#{dl.numero} {dl.nome} · {dl.classe}</Text>
      <Text style={st.tipTx}>Largada: {clock(r.larg)} · Equipe #{dl.numero}</Text>
      <View style={{ flexDirection: 'row', marginTop: 4, borderBottomWidth: 1, borderBottomColor: '#555', paddingBottom: 3 }}><C t="PC" w="8%" b /><C t="Trc" w="8%" b /><C t="KM" w="13%" b /><C t="Ideal" w="19%" b /><C t="Passagem" w="19%" b /><C t="T. Prova" w="19%" b /><C t="Pts" w="14%" b /></View>
      {r.rows.length === 0 && <Text style={st.tipTx}>Nenhum PC identificado no rastro.</Text>}
      {r.rows.map((x) => (
        <View key={x.n} style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#262b32' }}>
          <C t={x.n} w="8%" />
          <C t={x.trc ?? '—'} w="8%" />
          <C t={x.km.toFixed(3).replace('.', ',')} w="13%" />
          <C t={x.prev != null ? clock(x.prev) : '—'} w="19%" />
          <C t={clock(x.real)} w="19%" />
          <C t={hms(x.tprova)} w="19%" />
          <C t={x.diff != null ? (x.tipo === 'D' ? '0' : String(Math.round(x.diff))) : '—'} w="14%" c={x.diff == null ? undefined : x.diff > 0.5 ? '#ff7a2e' : x.diff < -0.5 ? '#4caf50' : undefined} />
        </View>
      ))}
      <View style={{ borderTopWidth: 1.5, borderTopColor: '#888', marginTop: 8, paddingTop: 6 }}>
        <View style={st.line}><Text style={st.v}>Pontos perdidos</Text><Text style={st.v}>{r.total.toFixed(0)}</Text></View>
        <View style={st.line}><Text style={st.v}>Total</Text><Text style={st.v}>{r.total.toFixed(0)}</Text></View>
        <View style={st.line}><Text style={st.v}>Total PC zerado</Text><Text style={st.v}>{r.zerados}</Text></View>
        <Text style={st.tipTx}>{r.npcs} PC identificados</Text>
      </View>
      <Text style={st.tipTx}>Atrasado (+) ou adiantado (−), 1 ponto por segundo. Menos pontos vence.</Text>
    </View>
  );
}

const hms = (s) => { const t = Math.max(0, Math.round(s)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export function decodeDl(d) {
  const n = Math.min((d.t || []).length, (d.la || []).length, (d.lo || []).length);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ t: d.t[i], lat: d.la[i] / 1e5, lon: d.lo[i] / 1e5 });
  return pts;
}

export function TrackMapa({ st, dl, provaMap, grupos, onClose }) {
  const pts = useMemo(() => decodeDl(dl), [dl]);
  const coords = useMemo(() => pts.map((p) => [p.lat, p.lon]), [pts]);
  const [i, setI] = useState(0);
  const [orig, setOrig] = useState(true);
  const km = useMemo(() => { let a = 0; for (let k = 1; k < pts.length; k++) { const d = haversine(pts[k - 1], pts[k]); if (d > 1) a += d; } return a / 1000; }, [pts]);
  const dur = pts.length ? pts[pts.length - 1].t - pts[0].t : 0;
  const passo = (sec) => {
    if (!pts.length) return;
    const alvo = pts[i].t + sec;
    let j = i;
    if (sec > 0) while (j < pts.length - 1 && pts[j].t < alvo) j++; else while (j > 0 && pts[j].t > alvo) j--;
    setI(j);
  };
  const p = pts[i];
  const Bt = ({ tx, sec }) => <TouchableOpacity style={[st.btn2, { flex: 1 }]} onPress={() => passo(sec)}><Text style={st.btn2Tx}>{tx}</Text></TouchableOpacity>;
  return (
    <Tela onRequestClose={onClose}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 8 }}>
          <Text style={{ flex: 1, color: '#f5f5f5', fontWeight: '800' }} numberOfLines={2}>Track log · #{dl.numero} {dl.nome}</Text>
          <TouchableOpacity style={st.btn2} onPress={() => setOrig((v) => !v)}><Text style={st.btn2Tx}>{orig ? 'Percurso: SIM' : 'Percurso: NÃO'}</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={onClose}><Text style={st.btn2Tx}>✕</Text></TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 10 }}>
          <MapaWeb wps={provaMap.wps || []} coords={orig ? (provaMap.coords || []) : []} rc="#1e88e5" rw={6} coords2={coords} rc2="#ff7a2e" me={p ? [p.lat, p.lon] : null} height={340} />
        </View>
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <Text style={st.tipTx}>Azul: percurso levantado · Laranja: rastro do competidor · Bolinha: posição no tempo escolhido</Text>
          <Text style={[st.v, { textAlign: 'center', marginVertical: 4 }]}>Tempo {hms(p ? p.t - pts[0].t : 0)} de {hms(dur)} · {km.toFixed(2).replace('.', ',')} km · {pts.length} pontos</Text>
          <View style={[st.row, { marginBottom: 0 }]}>
            <Bt tx="−60 s" sec={-60} /><Bt tx="−10 s" sec={-10} /><Bt tx="+10 s" sec={10} /><Bt tx="+60 s" sec={60} />
          </View>
          <Tabela st={st} dl={dl} provaMap={provaMap} grupos={grupos} />
        </View>
      </ScrollView>
    </Tela>
  );
}

// Organizador: lista os dataloggers enviados e abre o rastro de cada um.
export function OrgTrackLog({ st, prova, provaMap, grupos, categorias }) {
  const [dls, setDls] = useState([]);
  const [sel, setSel] = useState(null);
  useEffect(() => ouvirDataloggers(prova, (l) => setDls([...l].sort((a, b) => Number(a.numero) - Number(b.numero))), () => {}), [prova]);
  const res = useMemo(() => dls.map((d) => ({ d, ...calcDl(d, provaMap, grupos) })), [dls, provaMap, grupos]);
  const classes = [...new Set(res.map((r) => r.d.classe))];
  return (
    <View>
    <View style={st.card}>
      <Text style={st.tip}>Resultado da prova</Text>
      {res.length === 0 && <Text style={st.tipTx}>Sem datalogger recebido.</Text>}
      {classes.map((c) => (
        <View key={c} style={{ marginTop: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{c}</Text>
          {res.filter((r) => r.d.classe === c).sort((a, b) => (b.npcs - a.npcs) || (a.total - b.total)).map((r, i) => (
            <View key={r.d.numero} style={st.line}>
              <Text style={st.k}>{i + 1}º  #{r.d.numero} {r.d.nome} · {r.npcs} PC</Text>
              <Text style={st.v}>{r.total.toFixed(1).replace('.', ',')} pts</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
    <View style={st.card}>
      <Text style={st.tip}>Track log dos competidores</Text>
      <Text style={st.tipTx}>Toque num competidor para ver o rastro dele sobre o percurso levantado.</Text>
      {dls.length === 0 && <Text style={st.tipTx}>Nenhum datalogger enviado ainda.</Text>}
      {dls.map((d) => (
        <TouchableOpacity key={d.numero} style={[st.line, { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#262b32' }]} onPress={() => setSel(d)}>
          <Text style={st.v}>#{d.numero} {d.nome}</Text>
          <Text style={st.k}>{d.classe} · {(d.t || []).length} pts</Text>
        </TouchableOpacity>
      ))}
      {sel && <TrackMapa st={st} dl={sel} provaMap={provaMap} grupos={grupos} onClose={() => setSel(null)} />}
    </View>
    </View>
  );
}

// Competidor: o próprio track log, quando o organizador libera.
export function MeuTrackLog({ st, prova, uid, provaMap, grupos }) {
  const [dl, setDl] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!uid || !prova) return undefined;
    return ouvirMeuDatalogger(prova, uid, (l) => { setErro(''); setDl(l[0] || null); }, () => setErro('Ainda não liberado pelo organizador.'));
  }, [prova, uid]);
  return (
    <View style={[st.card, { marginTop: 12 }]}>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Track log</Text>
      {dl ? <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={() => setAberto(true)}><Text style={st.btn2Tx}>Ver meu rastro no percurso</Text></TouchableOpacity>
        : <Text style={st.tipTx}>{erro || 'Envie o datalogger para ver o seu rastro.'}</Text>}
      {aberto && dl && <TrackMapa st={st} dl={dl} provaMap={provaMap} grupos={grupos} onClose={() => setAberto(false)} />}
    </View>
  );
}
