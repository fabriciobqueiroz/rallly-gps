// Track log: o rastro enviado pelo competidor (datalogger) sobre o percurso levantado pelo organizador.
import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import MapaWeb from './MapaWeb';
import Tela from './Tela';
import { haversine } from './store';
import { ouvirDataloggers, ouvirMeuDatalogger } from './firebase';

const hms = (s) => { const t = Math.max(0, Math.round(s)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

export function decodeDl(d) {
  const n = Math.min((d.t || []).length, (d.la || []).length, (d.lo || []).length);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ t: d.t[i], lat: d.la[i] / 1e5, lon: d.lo[i] / 1e5 });
  return pts;
}

export function TrackMapa({ st, dl, provaMap, onClose }) {
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
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 8 }}>
          <Text style={{ flex: 1, color: '#f5f5f5', fontWeight: '800' }} numberOfLines={2}>Track log · #{dl.numero} {dl.nome}</Text>
          <TouchableOpacity style={st.btn2} onPress={() => setOrig((v) => !v)}><Text style={st.btn2Tx}>{orig ? 'Percurso: SIM' : 'Percurso: NÃO'}</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={onClose}><Text style={st.btn2Tx}>✕</Text></TouchableOpacity>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <MapaWeb wps={provaMap.wps || []} coords={orig ? (provaMap.coords || []) : []} rc="#1e88e5" rw={6} coords2={coords} rc2="#ff7a2e" me={p ? [p.lat, p.lon] : null} height={420} />
        </View>
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <Text style={st.tipTx}>Azul: percurso levantado · Laranja: rastro do competidor · Bolinha: posição no tempo escolhido</Text>
          <Text style={[st.v, { textAlign: 'center', marginVertical: 4 }]}>Tempo {hms(p ? p.t - pts[0].t : 0)} de {hms(dur)} · {km.toFixed(2).replace('.', ',')} km · {pts.length} pontos</Text>
          <View style={[st.row, { marginBottom: 0 }]}>
            <Bt tx="−60 s" sec={-60} /><Bt tx="−10 s" sec={-10} /><Bt tx="+10 s" sec={10} /><Bt tx="+60 s" sec={60} />
          </View>
        </View>
      </View>
    </Tela>
  );
}

// Organizador: lista os dataloggers enviados e abre o rastro de cada um.
export function OrgTrackLog({ st, prova, provaMap }) {
  const [dls, setDls] = useState([]);
  const [sel, setSel] = useState(null);
  useEffect(() => ouvirDataloggers(prova, (l) => setDls([...l].sort((a, b) => Number(a.numero) - Number(b.numero))), () => {}), [prova]);
  return (
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
      {sel && <TrackMapa st={st} dl={sel} provaMap={provaMap} onClose={() => setSel(null)} />}
    </View>
  );
}

// Competidor: o próprio track log, quando o organizador libera.
export function MeuTrackLog({ st, prova, uid, provaMap }) {
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
      {aberto && dl && <TrackMapa st={st} dl={dl} provaMap={provaMap} onClose={() => setAberto(false)} />}
    </View>
  );
}
