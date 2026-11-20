// Aba do organizador: cria a prova no mapa, monta a planilha (tipos de trecho, classes, neutros) e publica.
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapaWeb from './MapaWeb';
import { calcularRota } from './osrm';
import { salvarProva, ouvirInscritos } from './firebase';
import { loadJson, saveJson } from './persist';
import { Roadbook } from './Tulipa';
import { gruposDe } from './rally';
import Levantamento from './Levantamento';
import { OrgTrackLog } from './TrackLog';
import { Platform } from 'react-native';
import ListaProvas, { slugProva } from './Provas';
import { CATS_PADRAO, OrgCategorias, OrgInscricoes, OrgLiberacao, OrgResultados } from './OrgExtras';
import { compartilharPdf } from './pdf';

const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; };
const vs = (v0, dif, ng) => Array.from({ length: ng }, (_, g) => String(Math.round((num(v0, 30) - num(dif, 3) * g) * 10) / 10));
const novoLeg = (dif, ng, nt) => ({ t: 'V', v: vs(30, dif, ng), min: '15', nt: String(nt || 0) });
// Converte os campos de tela em trechos publicáveis (v = média de cada grupo; kg/ka mantidos para versões antigas do app).
const toTrechos = (legs, kms) => legs.map((l, i) => ({ tr: i + 1, t: l.t, km: kms[i], v: l.v.map((x) => num(x, 30)), kg: num(l.v[0], 30), ka: num(l.v[l.v.length - 1] ?? l.v[0], 27), min: num(l.min, 15), nt: num(l.nt, 0) }));

// Trechos do organizador (independentes dos PCs) -> um trecho "equivalente" por intervalo entre PCs, para a apuração.
const trechosEq = (trs, legs, kms, ng) => {
  const dTot = kms.reduce((a, b) => a + b, 0) * 1000;
  const sec = trs.map((t, i) => ({ t: t.t, v: t.v.map((x) => num(x, 30)), min: num(t.min, 15), d0: t.d0, d1: i + 1 < trs.length ? trs[i + 1].d0 : dTot }));
  const secT = (x, g, a, b) => { const len = Math.max(0, Math.min(b, x.d1) - Math.max(a, x.d0)); const full = x.d1 - x.d0; if (len <= 0 || full <= 0) return 0; return x.t === 'D' ? (x.min * 60 * len) / full : (len / 1000 / Math.max(1, x.v[g] ?? x.v[0])) * 3600; };
  let a = 0;
  return legs.map((l, i) => {
    const b = a + kms[i] * 1000;
    const over = sec.filter((x) => Math.min(b, x.d1) > Math.max(a, x.d0) + 0.5);
    const allD = over.length > 0 && over.every((x) => x.t === 'D');
    const T = Array.from({ length: ng }, (_, g) => over.reduce((acc, x) => acc + secT(x, g, a, b), 0));
    a = b;
    const v = T.map((t) => (t > 0 ? Math.round(((kms[i] / t) * 3600) * 10) / 10 : 30));
    return { tr: i + 1, t: allD ? 'D' : 'V', km: kms[i], v, kg: v[0], ka: v[v.length - 1], min: allD ? Math.round((T[0] / 60) * 10) / 10 : num(l.min, 15), nt: num(l.nt, 0) };
  });
};

// Anexa a cada entrada do roadbook: neutro do PC, tipo do trecho (só onde o trecho começa), tempo de prova e nº do trecho.
export const comTipos = (tul, trechos, trs) => {
  let secs, a = 0;
  if (trs && trs.length) {
    const dTot = trechos.reduce((x, t) => x + (t.km || 0), 0) * 1000;
    secs = trs.map((t, i) => ({ t: t.t, v: t.v, min: t.min, d0: t.d0, d1: i + 1 < trs.length ? trs[i + 1].d0 : dTot }));
  } else secs = trechos.map((t) => { const x = { t: t.t, v: t.v, min: t.min, kg: t.kg, ka: t.ka, d0: a, d1: a + (t.km || 0) * 1000 }; a = x.d1; return x; });
  const nts = []; let ac = 0;
  trechos.forEach((t) => { ac += (t.km || 0) * 1000; if (t.nt > 0) nts.push({ d: ac, nt: t.nt }); });
  const ng = secs[0] && secs[0].v ? secs[0].v.length : 1;
  const nxOf = (i) => { const x = secs[i]; return x ? { t: x.t, v: x.v, min: x.min, kg: x.kg ?? x.v[0], ka: x.ka ?? x.v[x.v.length - 1] } : null; };
  const tempo = (d, g) => {
    let acc = 0;
    secs.forEach((x) => {
      const len = Math.max(0, Math.min(d, x.d1) - x.d0), full = x.d1 - x.d0;
      if (len <= 0 || full <= 0) return;
      acc += x.t === 'D' ? ((x.min || 0) * 60 * len) / full : (len / 1000 / Math.max(1, (x.v && (x.v[g] ?? x.v[0])) || 30)) * 3600;
    });
    nts.forEach((q) => { if (d > q.d + 1.5) acc += q.nt; });
    return acc;
  };
  const tnAt = (d) => { let n = 1; secs.forEach((x, i) => { if (x.d0 <= d + 1.5) n = i + 1; }); return n; };
  const comTrs = !!(trs && trs.length);
  return tul.map((e, i) => {
    let o = e;
    if (e.t === 'L') { const prox = tul[i + 1]; o = { ...e, nx: prox && prox.t === 'T' && prox.ptr === 0 ? null : nxOf(0) }; }
    else if (e.t === 'P') o = { ...e, nt: trechos[e.n - 1]?.nt || 0, nx: comTrs ? null : nxOf(e.n) };
    else if (e.t === 'C') o = { ...e, nt: trechos[e.n - 1]?.nt || 0, nx: null };
    else if (e.t === 'T' && e.ptr != null) o = { ...e, nx: nxOf(e.ptr) };
    if (secs.length) o = { ...o, tn: tnAt(e.d || 0), tm: Array.from({ length: ng }, (_, g) => Math.round(tempo(e.d || 0, g))) };
    return o;
  });
};

export default function Organizador({ st, prova, provaMap, last, onOrg, onProva, onTab, abrirReq }) {
  const [org, setOrg] = useState(() => loadJson('org', null));
  const [wps, setWps] = useState([]);
  const [rota, setRota] = useState({ coords: [], legs: [], tul: [] });
  const [legs, setLegs] = useState([]);
  const [dif, setDif] = useState('3');
  const [busy, setBusy] = useState('');
  const [inscritos, setInscritos] = useState([]);
  const [sec, setSec] = useState(Platform.OS === 'web' ? 'planilha' : 'levantar');
  const [aberta, setAberta] = useState(false);
  const [pcl, setPcl] = useState([]);
  const [refs, setRefs] = useState([]);
  const [manual, setManual] = useState(false);
  const [trs, setTrs] = useState([]);
  const nPend = useRef(new Set());
  const grupos = gruposDe(provaMap.categorias);
  const ng = grupos.length;
  const carregado = useRef(0);
  const logado = org && org.prova === prova.trim().toUpperCase();

  useEffect(() => {
    if (logado && provaMap.wps.length && carregado.current !== (provaMap.pub || 1) && !(carregado.current && wps.length)) {
      carregado.current = provaMap.pub || 1;
      setWps(provaMap.wps);
      setRota({ coords: provaMap.coords, legs: provaMap.legs, tul: provaMap.tul });
      setRefs(provaMap.refs || []);
      setPcl(provaMap.pcl || []);
      setManual(provaMap.tul.some((e) => e.man));
      setLegs((provaMap.trechos || []).map((t) => {
        const v = (t.v || [t.kg, t.ka]).map(String);
        while (v.length < ng) v.push(String(num(v[0]) - num(dif, 3) * v.length));
        return { t: t.t, v, min: String(t.min), nt: String(t.nt || 0) };
      }));
      setTrs((provaMap.trs || []).map((t) => { const v = (t.v || []).map(String); while (v.length < ng) v.push(String(num(v[0]) - num(dif, 3) * v.length)); return { t: t.t, v, min: String(t.min), d0: t.d0 }; }));
    }
  }, [logado, provaMap]);

  useEffect(() => {
    setInscritos([]);
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
    setTrs((o) => o.map((l) => (l.v.length === ng ? l : { ...l, v: Array.from({ length: ng }, (_, g) => l.v[g] ?? vs(l.v[0], dif, ng)[g]) })));
    setLegs((o) => o.map((l) => (l.v.length === ng ? l : { ...l, v: Array.from({ length: ng }, (_, g) => l.v[g] ?? vs(l.v[0], dif, ng)[g]) })));
  }, [ng]);

  // Percurso vindo do levantamento dirigindo: usa o rastro e as tulipas marcadas, sem recalcular pelo OSRM.
  const aplicarLevantamento = ({ wps: w, rota: r, nIdx, refs: rf, pcl: pc, trs: tn }) => {
    setManual(true);
    setWps(w); setRota(r); setRefs(rf); setPcl(pc || []);
    setLegs(r.legs.map((_, i) => novoLeg(num(dif, 3), ng, (nIdx.get ? nIdx.get(i) : nIdx.has(i) ? 60 : 0) || 0)));
    setTrs((tn || []).map((t) => (t.t === 'D' ? { t: 'D', v: vs(30, dif, ng), min: String(t.min || 15), d0: t.d0 } : { t: 'V', v: vs(t.v, dif, ng).map((x, k) => (k === 0 ? String(t.v).replace(',', '.') : x)), min: '15', d0: t.d0 })));
    setSec('planilha');
  };
  const updT = (i, patch) => setTrs((o) => o.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const onVT = (i, g, v) => setTrs((o) => o.map((l, j) => (j !== i ? l : { ...l, v: g === 0 ? vs(v, dif, ng).map((x, k) => (k === 0 ? v : x)) : l.v.map((x, k) => (k === g ? v : x)) })));
  const upd = (i, patch) => setLegs((o) => o.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  // Ao mudar a média Graduado/Moto, o Amador acompanha com a diferença configurada.
  const onV = (i, g, v) => setLegs((o) => o.map((l, j) => (j !== i ? l : { ...l, v: g === 0 ? vs(v, dif, ng).map((x, k) => (k === 0 ? v : x)) : l.v.map((x, k) => (k === g ? v : x)) })));
  const aplicarDif = (v) => { setDif(v); setTrs((o) => o.map((l) => (l.t === 'V' ? { ...l, v: vs(l.v[0], v, ng).map((x, k) => (k === 0 ? l.v[0] : x)) } : l))); setLegs((o) => o.map((l) => (l.t === 'V' ? { ...l, v: vs(l.v[0], v, ng).map((x, k) => (k === 0 ? l.v[0] : x)) } : l))); };

  // Abre uma prova da lista: troca o código, entra como organizador e zera a tela da prova anterior.
  const abrirProva = async (code, nova) => {
    try {
      onProva && onProva(code);
      const o = { prova: code.trim().toUpperCase() };
      saveJson('org', o); setOrg(o); onOrg && onOrg(o);
      carregado.current = 0;
      setWps([]); setRota({ coords: [], legs: [], tul: [] }); setLegs([]); setTrs([]); setRefs([]); setPcl([]); setManual(false); setInscritos([]);
      setSec(Platform.OS === 'web' ? 'planilha' : 'levantar'); setAberta(true);
    } catch (e) { Alert.alert('Sem conexão', String(e?.message || e)); }
  };
  useEffect(() => { if (abrirReq && abrirReq.code) abrirProva(abrirReq.code, false); }, [abrirReq && abrirReq.n]);
  const sair = () => { saveJson('org', null); setOrg(null); onOrg && onOrg(null); };

  const trsNum = trs.map((t) => ({ t: t.t, v: t.v.map((x) => num(x, 30)), min: num(t.min, 15), d0: Math.round(t.d0 || 0) }));
  const trechos = trsNum.length ? trechosEq(trs, legs, rota.legs, ng) : toTrechos(legs, rota.legs);
  const tulT = comTipos(rota.tul, trechos, trsNum);

  const publicar = async () => {
    if (wps.length < 2 || rota.legs.length !== wps.length - 1 || legs.length !== rota.legs.length) return Alert.alert('Falta rota', 'Marque ao menos a largada e a chegada e aguarde o cálculo.');
    try {
      await salvarProva(prova, {
        roteiro: trechos.map((t) => `${t.km.toFixed(3)} ${t.kg}`).join('\n'),
        trechos,
        trs: trsNum,
        wps: wps.flatMap((w) => [Math.round(w[0] * 1e6) / 1e6, Math.round(w[1] * 1e6) / 1e6]),
        rota: rota.coords.flatMap((c) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]),
        legs: rota.legs.map((k) => Math.round(k * 1000) / 1000),
        tul: JSON.parse(JSON.stringify(tulT)),
        refs,
        pcl: manual ? pcl : [],
        ...(((loadJson('lev_' + String(prova).trim().toUpperCase().replace(/[^A-Z0-9]+/g, ''), {}).nome || '').slice(0, 60)) ? { nome: (loadJson('lev_' + String(prova).trim().toUpperCase().replace(/[^A-Z0-9]+/g, ''), {}).nome || '').slice(0, 60) } : {}),
        publicadoEm: Date.now(),
      });
      Alert.alert('Prova publicada', 'Planilha e roadbook enviados. Os celulares com este código recebem sozinhos.');
    } catch (e) { Alert.alert('Não publicou', String(e?.message || e)); }
  };

  const pdf = async () => {
    try { await compartilharPdf(prova.trim().toUpperCase(), tulT, true); }
    catch (e) { Alert.alert('Não gerou o PDF', String(e?.message || e)); }
  };

  if (!logado || !aberta) return <ListaProvas st={st} org={org} onAbrir={abrirProva} onSairOrg={sair} />;

  const total = rota.legs.reduce((a, b) => a + b, 0);
  const me = last ? [last.lat, last.lon] : null;
  const chip = (on) => [st.btn2, { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', paddingHorizontal: 14, paddingVertical: 6 }, on && { backgroundColor: '#ff7a2e' }];
  const cats = provaMap.categorias;
  const SEC = [['levantar', 'Levantar'], ['planilha', 'Planilha'], ['categorias', 'Categorias'], ['inscricoes', 'Inscrições'], ['ranking', 'Ranking'], ['resultados', 'Resultados'], ['tracklog', 'Track log'], ['liberacao', 'Liberação']].filter(([k]) => Platform.OS !== 'web' || (k !== 'levantar' && k !== 'ranking'));
  const nomeProva = (loadJson('lev_index', []).find((x) => x.code === org.prova) || {}).nome || '';
  return (
    <View>
      <TouchableOpacity onPress={() => setAberta(false)}><Text style={[st.v, { marginBottom: 6 }]}>‹ Minhas provas</Text></TouchableOpacity>
      <Text style={st.tip}>{nomeProva || 'Prova'} · código {org.prova}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {SEC.map(([k, n]) => <TouchableOpacity key={k} style={chip(sec === k)} onPress={() => (k === 'ranking' ? onTab && onTab('ranking') : setSec(k))}><Text style={[st.btn2Tx, sec === k && { color: '#0c1014' }]}>{n}</Text></TouchableOpacity>)}
      </View>
      {sec === 'levantar' && <Levantamento key={org.prova} st={st} prova={org.prova} last={last} onAplicar={aplicarLevantamento} />}
      {sec === 'categorias' && <OrgCategorias st={st} prova={org.prova} categorias={cats} />}
      {sec === 'inscricoes' && <OrgInscricoes key={org.prova} st={st} prova={org.prova} inscritos={inscritos} categorias={cats} />}
      {sec === 'tracklog' && <OrgTrackLog st={st} prova={org.prova} provaMap={provaMap} grupos={grupos} />}
      {sec === 'liberacao' && <OrgLiberacao st={st} prova={org.prova} lib={provaMap.lib || {}} />}
      {sec === 'resultados' && <OrgResultados st={st} prova={org.prova} provaMap={provaMap} grupos={grupos} inscritos={inscritos} categorias={cats} />}
      {sec === 'planilha' && (
        <View>
      <View style={st.card}>
        <Text style={st.tip}>Prova {org.prova} · organizador</Text>
        {Platform.OS === 'web' && <Text style={[st.tipTx, { color: provaMap.wps.length ? '#4caf50' : '#ffb74d' }]}>{provaMap.wps.length ? `Dados da prova carregados da nuvem: ${provaMap.wps.length} pontos, ${provaMap.trechos.length} trechos.` : 'Esta prova ainda não tem percurso publicado na nuvem. Publique pelo celular (ou marque o percurso no mapa abaixo e toque em Publicar).'}</Text>}
        <Text style={st.tipTx}>Toque no mapa (ou dirija e use os botões abaixo): 1º ponto = largada, depois os fins de trecho, e o último = chegada. O app calcula a rota, gera as tulipas e a planilha de trechos.</Text>
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
        {trs.length > 0 && trs.map((l, i) => {
          const fim = i + 1 < trs.length ? trs[i + 1].d0 : total * 1000;
          return (
            <View key={'t' + i} style={{ borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 8 }}>
              <Text style={st.v}>Trecho {i + 1} · {((fim - (l.d0 || 0)) / 1000).toFixed(3)} km</Text>
              <View style={[st.row, { marginTop: 6, marginBottom: 6 }]}>
                <TouchableOpacity style={chip(l.t === 'V')} onPress={() => updT(i, { t: 'V' })}><Text style={[st.btn2Tx, l.t === 'V' && { color: '#0c1014' }]}>V média</Text></TouchableOpacity>
                <TouchableOpacity style={chip(l.t === 'D')} onPress={() => updT(i, { t: 'D' })}><Text style={[st.btn2Tx, l.t === 'D' && { color: '#0c1014' }]}>D deslocamento</Text></TouchableOpacity>
              </View>
              {l.t === 'V' ? grupos.map((g, gi) => (
                <View key={gi} style={st.line}>
                  <Text style={st.k}>Grupo {g.nome} · {g.cats.join(', ') || '—'}</Text>
                  <TextInput style={st.input} value={l.v[gi] ?? ''} onChangeText={(v) => onVT(i, gi, v)} keyboardType="decimal-pad" />
                </View>
              )) : (
                <View style={st.line}>
                  <Text style={st.k}>Tempo limite (min) — não vale pontos</Text>
                  <TextInput style={st.input} value={l.min} onChangeText={(v) => updT(i, { min: v })} keyboardType="decimal-pad" />
                </View>
              )}
            </View>
          );
        })}
        {trs.length > 0 && legs.length > 1 && <Text style={[st.tip, { marginTop: 8 }]}>Neutros (parada no ponto)</Text>}
        {trs.length > 0 && legs.slice(0, -1).map((l, i) => {
          const pt = rota.tul.filter((e) => e.t === 'P')[i];
          const ate = rota.legs.slice(0, i + 1).reduce((x, y) => x + y, 0);
          return (
            <View key={'n' + i} style={st.line}>
              <Text style={st.k}>{pt && pt.pn ? `PC ${pt.pn}` : 'Neutro'} · km {ate.toFixed(3)} (s parado, 0 = sem)</Text>
              <TextInput style={st.input} value={l.nt} onChangeText={(v) => upd(i, { nt: v })} keyboardType="number-pad" />
            </View>
          );
        })}
        {trs.length === 0 && legs.map((l, i) => (
          <View key={i} style={{ borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 8 }}>
            <Text style={st.v}>Trecho {i + 1} · {(rota.legs[i] ?? 0).toFixed(3)} km</Text>
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
        {rota.tul.length > 0 && <Roadbook st={st} tul={tulT} dist={null} grupos={grupos} org />}
        <TouchableOpacity style={[st.btn, { marginTop: 10, backgroundColor: '#2e7d32' }]} onPress={publicar}><Text style={[st.btnTx, { color: '#fff' }]}>Publicar prova para os celulares</Text></TouchableOpacity>
        <TouchableOpacity style={[st.btn2, { marginBottom: 8 }]} onPress={pdf}><Text style={st.btn2Tx}>Gerar PDF do roadbook (imprimir)</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={sair}><Text style={st.btn2Tx}>Sair do modo organizador</Text></TouchableOpacity>
      </View>
        </View>
      )}
    </View>
  );
}
