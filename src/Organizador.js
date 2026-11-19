// Aba do organizador: cria a prova no mapa, monta a planilha (tipos de trecho, classes, neutros) e publica.
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapaWeb from './MapaWeb';
import { calcularRota } from './osrm';
import { entrarOrganizador, salvarProva, ouvirInscritos } from './firebase';
import { loadJson, saveJson } from './persist';
import { Roadbook } from './Tulipa';
import { gruposDe } from './rally';
import Levantamento from './Levantamento';
import { CATS_PADRAO, OrgCategorias, OrgInscricoes, OrgLiberacao, OrgResultados } from './OrgExtras';
import { compartilharPdf } from './pdf';

const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; };
const vs = (v0, dif, ng) => Array.from({ length: ng }, (_, g) => String(Math.round((num(v0, 30) - num(dif, 3) * g) * 10) / 10));
const novoLeg = (dif, ng, nt) => ({ t: 'V', v: vs(30, dif, ng), min: '15', nt: String(nt || 0) });
// Converte os campos de tela em trechos publicáveis (v = média de cada grupo; kg/ka mantidos para versões antigas do app).
const toTrechos = (legs, kms) => legs.map((l, i) => ({ t: l.t, km: kms[i], v: l.v.map((x) => num(x, 30)), kg: num(l.v[0], 30), ka: num(l.v[l.v.length - 1] ?? l.v[0], 27), min: num(l.min, 15), nt: num(l.nt, 0) }));
// Anexa a cada entrada do roadbook o neutro do PC e o tipo do trecho seguinte.
export const comTipos = (tul, trechos) => tul.map((e) => {
  if (e.t === 'L') return { ...e, nx: trechos[0] || null };
  if (e.t === 'P') return { ...e, nt: trechos[e.n - 1]?.nt || 0, nx: trechos[e.n] || null };
  if (e.t === 'C') return { ...e, nt: trechos[e.n - 1]?.nt || 0, nx: null };
  return e;
});

export default function Organizador({ st, prova, provaMap, last, onOrg }) {
  const [org, setOrg] = useState(() => loadJson('org', null));
  const [pin, setPin] = useState('');
  const [wps, setWps] = useState([]);
  const [rota, setRota] = useState({ coords: [], legs: [], tul: [] });
  const [legs, setLegs] = useState([]);
  const [dif, setDif] = useState('3');
  const [busy, setBusy] = useState('');
  const [inscritos, setInscritos] = useState([]);
  const [sec, setSec] = useState('planilha');
  const [refs, setRefs] = useState([]);
  const [manual, setManual] = useState(false);
  const nPend = useRef(new Set());
  const grupos = gruposDe(provaMap.categorias);
  const ng = grupos.length;
  const carregado = useRef(false);
  const logado = org && org.prova === prova.trim().toUpperCase() && !!org.pin;

  useEffect(() => {
    if (logado && !carregado.current && !wps.length && provaMap.wps.length) {
      carregado.current = true;
      setWps(provaMap.wps);
      setRota({ coords: provaMap.coords, legs: provaMap.legs, tul: provaMap.tul });
      setRefs(provaMap.refs || []);
      setManual(provaMap.tul.some((e) => e.man));
      setLegs((provaMap.trechos || []).map((t) => {
        const v = (t.v || [t.kg, t.ka]).map(String);
        while (v.length < ng) v.push(String(num(v[0]) - num(dif, 3) * v.length));
        return { t: t.t, v, min: String(t.min), nt: String(t.nt || 0) };
      }));
    }
  }, [logado, provaMap]);

  useEffect(() => {
    if (!logado || !prova.trim()) return;
    return ouvirInscritos(prova, setInscritos, () => {});
  }, [logado, prova]);

  // Recalcula a rota pelas ruas sempre que os pontos mudam.
  useEffect(() => {
    if (manual) return;
    if (wps.length < 2) { setRota({ coords: [], legs: [], tul: [] }); setLegs([]); return; }
    const t = setTimeout(async () => {
      setBusy('Calculando rota…');
      try {
        const r = await calcularRota(wps);
        setRota(r);
        setLegs((old) => r.legs.map((_, i) => old[i] || novoLeg(num(dif, 3), ng, nPend.current.has(i) ? 60 : 0)));
        setBusy('');
      } catch (e) { setBusy('Rota: ' + String(e?.message || e)); }
    }, 700);
    return () => clearTimeout(t);
  }, [wps, manual]);

  useEffect(() => {
    setLegs((o) => o.map((l) => (l.v.length === ng ? l : { ...l, v: Array.from({ length: ng }, (_, g) => l.v[g] ?? vs(l.v[0], dif, ng)[g]) })));
  }, [ng]);

  // Percurso vindo do levantamento dirigindo: usa o rastro e as tulipas marcadas, sem recalcular pelo OSRM.
  const aplicarLevantamento = ({ wps: w, rota: r, nIdx, refs: rf }) => {
    setManual(true);
    setWps(w); setRota(r); setRefs(rf);
    setLegs(r.legs.map((_, i) => novoLeg(num(dif, 3), ng, nIdx.has(i) ? 60 : 0)));
    setSec('planilha');
  };
  const upd = (i, patch) => setLegs((o) => o.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  // Ao mudar a média Graduado/Moto, o Amador acompanha com a diferença configurada.
  const onV = (i, g, v) => setLegs((o) => o.map((l, j) => (j !== i ? l : { ...l, v: g === 0 ? vs(v, dif, ng).map((x, k) => (k === 0 ? v : x)) : l.v.map((x, k) => (k === g ? v : x)) })));
  const aplicarDif = (v) => { setDif(v); setLegs((o) => o.map((l) => (l.t === 'V' ? { ...l, v: vs(l.v[0], v, ng).map((x, k) => (k === 0 ? l.v[0] : x)) } : l))); };

  const entrar = async () => {
    if (!prova.trim() || !pin.trim()) return Alert.alert('Falta preencher', 'Informe o código da prova (aba Gravar) e um PIN.');
    try {
      const r = await entrarOrganizador(prova, pin.trim());
      if (r === 'negado') return Alert.alert('PIN incorreto', 'Esse código de prova já tem outro organizador.');
      const o = { prova: prova.trim().toUpperCase(), pin: pin.trim() };
      saveJson('org', o); setOrg(o); onOrg && onOrg(o);
      if (r === 'criada') Alert.alert('Prova criada', 'Você é o organizador desta prova. Guarde o PIN.');
    } catch (e) { Alert.alert('Sem conexão', String(e?.message || e)); }
  };
  const sair = () => { saveJson('org', null); setOrg(null); setPin(''); onOrg && onOrg(null); };

  const trechos = toTrechos(legs, rota.legs);
  const tulT = comTipos(rota.tul, trechos);

  const publicar = async () => {
    if (wps.length < 2 || rota.legs.length !== wps.length - 1 || legs.length !== rota.legs.length) return Alert.alert('Falta rota', 'Marque ao menos a largada e a chegada e aguarde o cálculo.');
    try {
      await salvarProva(prova, {
        roteiro: trechos.map((t) => `${t.km.toFixed(3)} ${t.kg}`).join('\n'),
        trechos,
        wps: wps.flatMap((w) => [Math.round(w[0] * 1e6) / 1e6, Math.round(w[1] * 1e6) / 1e6]),
        rota: rota.coords.flatMap((c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]),
        legs: rota.legs.map((k) => Math.round(k * 1000) / 1000),
        tul: JSON.parse(JSON.stringify(tulT)),
        refs,
        publicadoEm: Date.now(),
      });
      Alert.alert('Prova publicada', 'Planilha e roadbook enviados. Os celulares com este código recebem sozinhos.');
    } catch (e) { Alert.alert('Não publicou', String(e?.message || e)); }
  };

  const pdf = async () => {
    try { await compartilharPdf(prova.trim().toUpperCase(), tulT); }
    catch (e) { Alert.alert('Não gerou o PDF', String(e?.message || e)); }
  };

  if (!logado) {
    return (
      <View style={st.card}>
        <Text style={st.tip}>Acesso do organizador</Text>
        <Text style={st.tipTx}>Usa o código da prova digitado na aba Gravar ({prova.trim() || 'vazio'}). O primeiro a entrar com um PIN vira o organizador.</Text>
        <TextInput style={st.field} value={pin} onChangeText={setPin} placeholder="PIN do organizador" placeholderTextColor="#666" secureTextEntry keyboardType="number-pad" />
        <TouchableOpacity style={[st.btn, { marginTop: 10, marginBottom: 0 }]} onPress={entrar}><Text style={st.btnTx}>Entrar como organizador</Text></TouchableOpacity>
      </View>
    );
  }

  const total = rota.legs.reduce((a, b) => a + b, 0);
  const me = last ? [last.lat, last.lon] : null;
  const chip = (on) => [st.btn2, { flex: 0, paddingHorizontal: 14, paddingVertical: 6 }, on && { backgroundColor: '#ff7a2e' }];
  const cats = provaMap.categorias;
  const SEC = [['planilha', 'Planilha'], ['levantar', 'Levantar'], ['categorias', 'Categorias'], ['inscricoes', 'Inscrições'], ['liberacao', 'Liberação'], ['resultados', 'Resultados']];
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {SEC.map(([k, n]) => <TouchableOpacity key={k} style={chip(sec === k)} onPress={() => setSec(k)}><Text style={[st.btn2Tx, sec === k && { color: '#0c1014' }]}>{n}</Text></TouchableOpacity>)}
      </View>
      {sec === 'levantar' && <Levantamento st={st} prova={org.prova} last={last} onAplicar={aplicarLevantamento} />}
      {sec === 'categorias' && <OrgCategorias st={st} prova={org.prova} categorias={cats} />}
      {sec === 'inscricoes' && <OrgInscricoes st={st} prova={org.prova} inscritos={inscritos} categorias={cats} />}
      {sec === 'liberacao' && <OrgLiberacao st={st} prova={org.prova} lib={provaMap.lib || {}} />}
      {sec === 'resultados' && <OrgResultados st={st} prova={org.prova} provaMap={provaMap} grupos={grupos} inscritos={inscritos} categorias={cats} />}
      {sec === 'planilha' && (
        <View>
      <View style={st.card}>
        <Text style={st.tip}>Prova {org.prova} · organizador</Text>
        <Text style={st.tipTx}>Toque no mapa (ou dirija e use os botões abaixo): 1º ponto = largada, depois os PCs, e o último = chegada. O app calcula a rota, gera as tulipas e a planilha de trechos.</Text>
      </View>
      {manual && (
        <View style={st.card}>
          <Text style={st.tip}>Percurso do levantamento</Text>
          <Text style={st.tipTx}>Tulipas e rastro vêm do levantamento dirigindo. Para editar pelo mapa (OSRM), volte ao automático: as tulipas manuais serão perdidas.</Text>
          <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={() => Alert.alert('Voltar ao automático', 'As tulipas do levantamento serão substituídas pelas geradas pelo mapa. Continuar?', [{ text: 'Cancelar' }, { text: 'Voltar', onPress: () => setManual(false) }])}><Text style={st.btn2Tx}>Voltar ao automático (OSRM)</Text></TouchableOpacity>
        </View>
      )}
      <MapaWeb wps={wps} coords={rota.coords} editable={!manual} onTap={(la, lo) => setWps((w) => [...w, [la, lo]])} me={me} height={380} />
      {busy ? <Text style={st.tipTx}>{busy}</Text> : null}
      <View style={st.card}>
        <View style={st.row}>
          <TouchableOpacity style={st.btn2} onPress={() => setWps((w) => w.slice(0, -1))}><Text style={st.btn2Tx}>Desfazer ponto</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => { setWps([]); setLegs([]); }}><Text style={st.btn2Tx}>Limpar tudo</Text></TouchableOpacity>
        </View>
        <View style={st.line}>
          <Text style={st.k}>Diferença entre grupos de média (km/h)</Text>
          <TextInput style={st.input} value={dif} onChangeText={aplicarDif} keyboardType="decimal-pad" />
        </View>
        {legs.map((l, i) => (
          <View key={i} style={{ borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 8 }}>
            <Text style={st.v}>{i === 0 ? 'Largada' : `PC${i}`} → {i === legs.length - 1 ? 'Chegada' : `PC${i + 1}`} · {(rota.legs[i] ?? 0).toFixed(3)} km</Text>
            <View style={[st.row, { marginTop: 6, marginBottom: 6 }]}>
              <TouchableOpacity style={chip(l.t === 'V')} onPress={() => upd(i, { t: 'V' })}><Text style={[st.btn2Tx, l.t === 'V' && { color: '#0c1014' }]}>V média</Text></TouchableOpacity>
              <TouchableOpacity style={chip(l.t === 'D')} onPress={() => upd(i, { t: 'D' })}><Text style={[st.btn2Tx, l.t === 'D' && { color: '#0c1014' }]}>D deslocamento</Text></TouchableOpacity>
            </View>
            {l.t === 'V' ? (
              <View>
                {grupos.map((g, gi) => (
                  <View key={gi} style={st.line}>
                    <Text style={st.k}>Grupo {g.nome} · {g.cats.join(', ') || '—'}</Text>
                    <TextInput style={st.input} value={l.v[gi] ?? ''} onChangeText={(v) => onV(i, gi, v)} keyboardType="decimal-pad" />
                  </View>
                ))}
              </View>
            ) : (
              <View style={st.line}>
                <Text style={st.k}>Tempo limite (min) — não vale pontos</Text>
                <TextInput style={st.input} value={l.min} onChangeText={(v) => upd(i, { min: v })} keyboardType="decimal-pad" />
              </View>
            )}
            <View style={st.line}>
              <Text style={st.k}>Neutro no fim (s parado, 0 = sem)</Text>
              <TextInput style={st.input} value={l.nt} onChangeText={(v) => upd(i, { nt: v })} keyboardType="number-pad" />
            </View>
          </View>
        ))}
        {rota.legs.length > 0 && <Text style={st.tipTx}>Total: {total.toFixed(3)} km · {rota.legs.length} trecho(s)</Text>}
        {rota.tul.length > 0 && <Text style={[st.tip, { marginTop: 8 }]}>Roadbook gerado: {rota.tul.filter((e) => e.t === 'T').length} tulipas</Text>}
        {rota.tul.length > 0 && <Roadbook st={st} tul={tulT} dist={null} grupos={grupos} />}
        <TouchableOpacity style={[st.btn, { marginTop: 10, backgroundColor: '#2e7d32' }]} onPress={publicar}><Text style={[st.btnTx, { color: '#fff' }]}>Publicar prova para os celulares</Text></TouchableOpacity>
        <TouchableOpacity style={[st.btn2, { marginBottom: 8 }]} onPress={pdf}><Text style={st.btn2Tx}>Gerar PDF do roadbook (imprimir)</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={sair}><Text style={st.btn2Tx}>Sair do modo organizador</Text></TouchableOpacity>
      </View>
        </View>
      )}
    </View>
  );
}
