// Track log: o rastro enviado pelo competidor (datalogger) sobre o percurso levantado pelo organizador.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MapaWeb from './MapaWeb';
import Tela from './Tela';
import { haversine } from './store';
import { ouvirDataloggers, ouvirMeuDatalogger } from './firebase';
import { GRUPOS_PADRAO, oficialDeTrilha, pcsDoLogger } from './rally';

const clock = (ms) => { const d = new Date(ms); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':'); };
const sg = (s) => `${s >= 0 ? '+' : '−'}${Math.abs(s).toFixed(1).replace('.', ',')} s`;

// Resultado do competidor a partir do datalogger: PCs, previsto x real, diferença e pontos (1 ponto por segundo).
// Regulamento CBA (Art. 21): passagem só vale a ±10 min do ideal; fora disso ou sem passar = pontuação máxima (6.000).
export const JANELA = 600;
// pontos por segundo: 1 (padrão) ou 10 (1 por décimo, CBA). Vale por categoria (lib.escalas); sem escolha, usa lib.escala.
export const escalaDe = (lib, classe) => { const e = lib && ((lib.escalas && classe != null && lib.escalas[classe]) || lib.escala); return e === 'd' ? 10 : 1; };
export function calcDl(dl, provaMap, grupos) {
  const larg = dl.tIni || dl.t0;
  const esc = escalaDe(provaMap.lib, dl.classe), max = JANELA * esc;
  let pcs = [];
  try { pcs = oficialDeTrilha(pcsDoLogger(dl), provaMap.wps || [], provaMap.trechos || [], dl.classe, grupos || GRUPOS_PADRAO, larg, provaMap.pcl || [], provaMap.coords || []); } catch {}
  const legs = provaMap.legs || [], trs = provaMap.trs || [];
  let acc = 0, pcN = 0;
  const cumM = legs.map((l) => (acc += (l || 0) * 1000));
  const rows = pcs.map((p, i) => {
    const prev = p.idealTime != null ? p.t0 + p.idealTime * 1000 : null;
    const neu = !!p.neu;
    if (!neu) pcN++;
    const dAt = cumM[i];
    let k = 0;
    if (dAt != null) trs.forEach((t, j) => { if ((t.d0 || 0) <= dAt + 1.5) k = j; });
    const km = dAt != null && trs[k] ? (dAt - (trs[k].d0 || 0)) / 1000 : (p.dist || 0) / 1000;
    const fora = !neu && !p.miss && p.tipo !== 'D' && p.diff != null && Math.abs(p.diff) > JANELA;
    const falta = !neu && (!!p.miss || fora);
    const pts = neu ? 0 : falta ? max : p.diff != null && p.tipo !== 'D' ? Math.abs(p.diff) * esc : 0;
    return { n: p.n, lab: neu ? 'N' : String(pcN), trc: trs.length ? k + 1 : p.trecho, km, tprova: p.miss ? null : (p.t - larg) / 1000, tipo: p.tipo, neu, miss: !!p.miss, sent: !!p.sent, fora, falta, prev: neu ? null : prev, real: p.miss ? null : p.t, diff: p.diff, pts };
  });
  const validos = rows.filter((x) => !x.neu);
  const passou = validos.filter((x) => !x.falta).length;
  const total = rows.reduce((a, x) => a + x.pts, 0);
  const minimo = Math.floor((validos.length * 2) / 3); // classificado: passou por 2/3 dos PCs (arredondado para baixo)
  return { larg, rows, esc, max, total, npcs: passou, totalPcs: validos.length, minimo, classif: passou >= minimo && validos.length > 0, zerados: validos.filter((x) => !x.falta && x.tipo !== 'D' && x.diff != null && Math.round(x.pts) === 0).length };
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
          <C t={x.lab} w="8%" c={x.neu ? '#ba68c8' : undefined} />
          <C t={x.trc ?? '—'} w="8%" />
          <C t={x.km.toFixed(3).replace('.', ',')} w="13%" />
          <C t={x.prev != null ? clock(x.prev) : '—'} w="19%" />
          <C t={x.real != null ? clock(x.real) : x.sent ? 'SENT.' : '****'} w="19%" c={x.falta ? '#ff5252' : undefined} />
          <C t={x.tprova != null ? hms(x.tprova) : '—'} w="19%" />
          <C t={x.neu ? 'NEUTRO' : x.falta ? String(r.max) : x.tipo === 'D' ? '0' : x.diff != null ? String(Math.round(x.diff * r.esc)) : '—'} w="14%" c={x.falta ? '#ff5252' : x.diff == null ? undefined : x.diff > 0.5 ? '#ff7a2e' : x.diff < -0.5 ? '#4caf50' : undefined} />
        </View>
      ))}
      <View style={{ borderTopWidth: 1.5, borderTopColor: '#888', marginTop: 8, paddingTop: 6 }}>
        <View style={st.line}><Text style={st.v}>Pontos perdidos</Text><Text style={st.v}>{Math.round(r.total)}</Text></View>
        <View style={st.line}><Text style={st.v}>Total</Text><Text style={st.v}>{Math.round(r.total)}</Text></View>
        <View style={st.line}><Text style={st.v}>Total PC zerado</Text><Text style={st.v}>{r.zerados}</Text></View>
        <Text style={st.tipTx}>{r.npcs} de {r.totalPcs} PC válidos. {r.classif ? 'Classificado.' : `NÃO CLASSIFICADO: precisa passar por ${r.minimo} PC (2/3).`} Neutro não pontua.</Text>
        {r.rows.some((x) => x.falta) && <Text style={[st.tipTx, { color: '#ff5252' }]}>**** = não passou ou passou fora de ±10 min · SENT. = passou no sentido contrário: {r.max} pontos.</Text>}
      </View>
      <Text style={st.tipTx}>Atrasado (+) ou adiantado (−), {r.esc === 10 ? '1 ponto por décimo de segundo' : '1 ponto por segundo'}. Menos pontos vence.</Text>
    </View>
  );
}

const hms = (s) => { const t = Math.max(0, Math.round(s)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export function decodeDl(d) {
  const n = Math.min((d.t || []).length, (d.la || []).length, (d.lo || []).length);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ t: d.t[i] / (d.esc === 2 ? 1000 : 1), lat: d.la[i] / (d.esc === 2 ? 1e6 : 1e5), lon: d.lo[i] / (d.esc === 2 ? 1e6 : 1e5) });
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
          <Text style={[st.v, { textAlign: 'center', marginVertical: 4 }]}>Tempo {hms(p ? p.t - pts[0].t : 0)} de {hms(dur)} · {km.toFixed(2).replace('.', ',')} km · {pts.length} leituras de GPS</Text>
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
          {res.filter((r) => r.d.classe === c).sort((a, b) => (Number(b.classif) - Number(a.classif)) || (a.total - b.total)).map((r, i) => (
            <View key={r.d.numero} style={st.line}>
              <Text style={st.k}>{r.classif ? `${i + 1}º` : 'NC'}  #{r.d.numero} {r.d.nome} · {r.npcs}/{r.totalPcs} PC</Text>
              <Text style={st.v}>{Math.round(r.total)} pts</Text>
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
