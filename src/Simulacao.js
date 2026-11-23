// Simulação da prova: o mapa segue o carro pelo traçado e a tulipa do ponto atual fica visível embaixo.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import MapaWeb from './MapaWeb';
import { Entrada } from './Tulipa';
import { grupoIdx } from './rally';

const R = 6371000;
const dist = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
const hms = (s) => { const p = (x) => String(x).padStart(2, '0'); s = Math.max(0, Math.round(s)); return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; };
const MULTS = [1, 2, 5, 10, 20, 50];

export default function Simulacao({ st, visible, onClose, coords, tul, trs, totalM, grupos, cats }) {
  const { height } = useWindowDimensions();
  const [s, setS] = useState(0);
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [mi, setMi] = useState(2);
  const [classe, setClasse] = useState(cats[0] || '');
  const [org, setOrg] = useState(false);
  const scroll = useRef(null);
  const ys = useRef({});
  const cum = useMemo(() => { const c = [0]; for (let i = 1; i < coords.length; i++) c.push(c[i - 1] + dist(coords[i - 1], coords[i])); return c; }, [coords]);
  const gi = classe ? grupoIdx(classe, grupos) : 0;
  const lista = useMemo(() => (org ? tul : tul.filter((e) => e.t !== 'P' || e.nt > 0)), [tul, org]);

  const velEm = (d) => {
    for (let i = trs.length - 1; i >= 0; i--) {
      if (d >= (trs[i].d0 || 0)) {
        const tr = trs[i];
        const fim = i + 1 < trs.length ? trs[i + 1].d0 : totalM;
        if (tr.t === 'D') return Math.max(5, ((fim - tr.d0) / 1000) / Math.max(0.1, tr.min / 60));
        return Math.max(5, tr.v[gi] ?? tr.v[0] ?? 30);
      }
    }
    return 30;
  };
  const vRef = useRef(velEm); vRef.current = velEm;
  const trechoN = (() => { for (let i = trs.length - 1; i >= 0; i--) if (s >= (trs[i].d0 || 0)) return i + 1; return 1; })();
  const v = velEm(s);

  useEffect(() => {
    if (!play || !visible) return;
    const id = setInterval(() => {
      setS((p) => { const n = p + (vRef.current(p) / 3.6) * MULTS[mi] * 0.25; if (n >= totalM) { setPlay(false); return totalM; } return n; });
      setT((x) => x + 0.25 * MULTS[mi]);
    }, 250);
    return () => clearInterval(id);
  }, [play, mi, visible, totalM]);
  useEffect(() => { if (!visible) { setPlay(false); } }, [visible]);

  // posição no mapa: distância percorrida convertida para o comprimento real da linha desenhada
  const me = useMemo(() => {
    if (coords.length < 2) return null;
    const alvo = Math.min(1, Math.max(0, s / Math.max(1, totalM))) * cum[cum.length - 1];
    let i = 1; while (i < cum.length - 1 && cum[i] < alvo) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const f = Math.min(1, Math.max(0, (alvo - cum[i - 1]) / seg));
    return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f];
  }, [s, coords, cum, totalM]);

  const atual = Math.max(0, lista.findIndex((e) => e.d >= s - 15));
  useEffect(() => { const y = ys.current[atual]; if (y != null && scroll.current) scroll.current.scrollTo({ y: Math.max(0, y - 6), animated: true }); }, [atual, org, visible]);

  const ir = (e) => { setS(Math.max(0, e.d - 60)); };
  const passo = (k) => { const j = Math.max(0, Math.min(lista.length - 1, atual + k)); if (lista[j]) setS(Math.max(0, lista[j].d - 60)); };
  const chip = (on) => [st.chip, { paddingHorizontal: 12, paddingVertical: 6 }, on && { backgroundColor: '#ff7a2e' }];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0c1014', paddingTop: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 6 }}>
          <TouchableOpacity onPress={onClose} style={{ paddingRight: 14 }}><Text style={{ color: '#4fc3f7', fontSize: 26, fontWeight: '800' }}>←</Text></TouchableOpacity>
          <Text style={[st.tip, { flex: 1, marginBottom: 0 }]}>Simular a prova</Text>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{hms(t)}</Text>
        </View>
        <View style={{ paddingHorizontal: 10 }}>
          <MapaWeb coords={coords} wps={[]} me={me} follow height={Math.max(200, Math.round(height * 0.36))} />
        </View>
        <View style={{ paddingHorizontal: 12 }}>
          <View style={st.line}>
            <Text style={st.v}>{(s / 1000).toFixed(3).replace('.', ',')} km · trecho {trechoN} · {Math.round(v)} km/h</Text>
            <Text style={st.tipTx}>{MULTS[mi]}x</Text>
          </View>
          <View style={[st.row, { marginTop: 6 }]}>
            <TouchableOpacity style={[st.btn2, { flex: 2, backgroundColor: play ? '#c0392b' : '#2e7d32' }]} onPress={() => { if (s >= totalM) { setS(0); setT(0); } setPlay(!play); }}><Text style={[st.btn2Tx, { color: '#fff' }]}>{play ? '⏸ Pausar' : '▶ Simular'}</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setMi(Math.max(0, mi - 1))}><Text style={st.btn2Tx}>−</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setMi(Math.min(MULTS.length - 1, mi + 1))}><Text style={st.btn2Tx}>+ rápido</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => { setPlay(false); setS(0); setT(0); }}><Text style={st.btn2Tx}>↺</Text></TouchableOpacity>
          </View>
          <View style={[st.row, { marginTop: 6, flexWrap: 'wrap' }]}>
            <TouchableOpacity style={st.btn2} onPress={() => passo(-1)}><Text style={st.btn2Tx}>▲ tulipa anterior</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => passo(1)}><Text style={st.btn2Tx}>▼ próxima</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {cats.map((c) => <TouchableOpacity key={c} style={chip(classe === c)} onPress={() => setClasse(c)}><Text style={[st.btn2Tx, classe === c && { color: '#0c1014' }]}>{c}</Text></TouchableOpacity>)}
            <TouchableOpacity style={chip(org)} onPress={() => setOrg(!org)}><Text style={[st.btn2Tx, org && { color: '#0c1014' }]}>{org ? 'Visão: organizador' : 'Visão: competidor'}</Text></TouchableOpacity>
          </View>
        </View>
        <ScrollView ref={scroll} style={{ flex: 1, marginTop: 8, paddingHorizontal: 10 }}>
          {lista.map((e, i) => (
            <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => ir(e)} onLayout={(ev) => { ys.current[i] = ev.nativeEvent.layout.y; }}>
              <Entrada e={e} st={st} org={org} classe={classe} grupos={grupos} destaque={i === atual} faltam={i === atual ? e.d - s : null} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 200 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
