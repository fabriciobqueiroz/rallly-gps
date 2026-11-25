// Menu "Dataloggers" (estilo Kraken): lista de gravações deste celular, mapa e qualidade dos dados.
import { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { COR, Cab } from './Pos';
import MapaWeb from './MapaWeb';
import { haversine } from './store';

const p2 = (x) => String(x).padStart(2, '0');
const hora = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const data = (ms) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
const hms = (s) => { const t = Math.max(0, Math.round(s)); return `${p2(Math.floor(t / 3600))}:${p2(Math.floor((t % 3600) / 60))}:${p2(t % 60)}`; };
const fm = (n, c = 1) => Number(n).toFixed(c).replace('.', ',');

// pts: [{t(ms), lat, lon, acc?, spd?}] → métricas de qualidade
export function qualidade(pts) {
  const acc = pts.map((p) => p.acc).filter((a) => a != null && a >= 0);
  const lacunas = [];
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i].t - pts[i - 1].t) / 1000;
    if (dt > 2.5) lacunas.push({ ini: pts[i - 1].t, fim: pts[i].t, seg: dt });
    const d = haversine(pts[i - 1], pts[i]);
    if (d > 1) km += d;
  }
  const dur = pts.length > 1 ? (pts[pts.length - 1].t - pts[0].t) / 1000 : 0;
  return {
    n: pts.length, dur, km: km / 1000,
    melhor: acc.length ? Math.min(...acc) : null,
    pior: acc.length ? Math.max(...acc) : null,
    media: acc.length ? acc.reduce((a, b) => a + b, 0) / acc.length : null,
    lacunas, perdidos: lacunas.reduce((a, l) => a + Math.round(l.seg) - 1, 0),
  };
}

function Linha({ k, v, cor }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COR.linha }}>
      <Text style={{ color: COR.tx2, fontSize: 15 }}>{k}</Text>
      <Text style={{ color: cor || COR.tx, fontSize: 15, fontWeight: '600' }}>{v}</Text>
    </View>
  );
}

function Mapa({ item, onVoltar }) {
  const coords = useMemo(() => item.pts.map((p) => [p.lat, p.lon]), [item]);
  const q = useMemo(() => qualidade(item.pts), [item]);
  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <Cab titulo="Mapa" onVoltar={onVoltar} />
      <View style={{ flex: 1, paddingHorizontal: 10 }}>
        <MapaWeb coords={coords} rc="#2ecc40" rw={4} sat me={null} height={480} />
        <Text style={{ color: COR.tx2, textAlign: 'center' }}>{fm(q.km, 2)} km · {hms(q.dur)} · {q.n} pontos</Text>
      </View>
    </View>
  );
}

function Qualidade({ item, onVoltar }) {
  const q = useMemo(() => qualidade(item.pts), [item]);
  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <Cab titulo="Qualidade dos dados" onVoltar={onVoltar} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <Text style={{ color: COR.azulTx, fontSize: 16, fontWeight: '600', marginTop: 14 }}>Precisão</Text>
        <Linha k="Melhor" v={q.melhor != null ? `${fm(q.melhor)} m` : '—'} />
        <Linha k="Média" v={q.media != null ? `${fm(q.media)} m` : '—'} />
        <Linha k="Pior" v={q.pior != null ? `${fm(q.pior)} m` : '—'} cor={q.pior > 15 ? COR.verm : undefined} />
        <Text style={{ color: COR.azulTx, fontSize: 16, fontWeight: '600', marginTop: 22 }}>Gravação</Text>
        <Linha k="Pontos" v={String(q.n)} />
        <Linha k="Duração" v={hms(q.dur)} />
        <Linha k="Distância" v={`${fm(q.km, 2)} km`} />
        <Text style={{ color: COR.azulTx, fontSize: 16, fontWeight: '600', marginTop: 22 }}>Interrupções na gravação</Text>
        {q.lacunas.length === 0 ? <Text style={{ color: COR.verde, marginTop: 12, fontSize: 15 }}>Nenhuma interrupção.</Text> : (
          <>
            <Linha k="Total" v={`${q.lacunas.length} (≈ ${q.perdidos} s sem ponto)`} cor={COR.verm} />
            {q.lacunas.slice(0, 40).map((l, i) => <Linha key={i} k={`${hms((l.ini - item.pts[0].t) / 1000)}`} v={`${Math.round(l.seg)} s`} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// lista: [{key, ev, cat, num, sinc, tot, em, pts}]
export default function Dataloggers({ lista, onVoltar, onCompartilhar }) {
  const [sel, setSel] = useState(null);
  const [tela, setTela] = useState(null);
  const itens = [...lista].sort((a, b) => b.em - a.em);
  return (
    <Modal visible animationType="slide" onRequestClose={tela ? () => setTela(null) : onVoltar}>
      <View style={{ flex: 1, backgroundColor: COR.fundo }}>
        {tela === 'mapa' && sel ? <Mapa item={sel} onVoltar={() => setTela(null)} />
          : tela === 'qual' && sel ? <Qualidade item={sel} onVoltar={() => setTela(null)} />
          : (
            <>
              <Cab titulo="Dataloggers" onVoltar={onVoltar} />
              <ScrollView contentContainerStyle={{ padding: 14 }}>
                {itens.length === 0 ? <Text style={{ color: COR.tx2, textAlign: 'center', marginTop: 40 }}>Nenhum datalogger neste celular ainda. Grave um percurso e finalize a prova.</Text> : null}
                {itens.map((d) => {
                  const ok = d.sinc >= d.tot && d.tot > 0;
                  return (
                    <TouchableOpacity key={d.key} activeOpacity={0.8} onPress={() => setSel(d)} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
                      <Text style={{ color: COR.tx, fontSize: 16, fontWeight: '600' }}>{d.ev}{d.num ? ` · #${d.num}` : ''}</Text>
                      {d.cat ? <Text style={{ color: COR.tx2, fontSize: 14, marginTop: 2 }}>{d.cat}</Text> : null}
                      <Text style={{ color: ok ? COR.verde : COR.verm, fontSize: 14, marginTop: 6 }}>Sincronizado: {d.sinc} / {d.tot}</Text>
                      <Text style={{ color: COR.tx2, fontSize: 13, marginTop: 4 }}>{hora(d.em)}  {data(d.em)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        {sel && !tela ? (
          <Modal transparent animationType="fade" onRequestClose={() => setSel(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => setSel(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 30 }}>
                {[['Ver no mapa', () => setTela('mapa')], ['Verificar qualidade dos dados', () => setTela('qual')], ['Compartilhar', () => { const s = sel; setSel(null); onCompartilhar(s); }]].map(([t, f]) => (
                  <TouchableOpacity key={t} onPress={f} style={{ paddingVertical: 18, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: COR.linha }}>
                    <Text style={{ color: COR.tx, fontSize: 16 }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
}
