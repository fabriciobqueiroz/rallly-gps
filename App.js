import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { TASK } from './src/gpsTask';
import { loadRoteiro, saveRoteiro, recFile, loadJson, saveJson } from './src/persist';
import { Roadbook } from './src/Tulipa';
import Organizador from './src/Organizador';
import { enviarResultado, ouvirRanking, salvarProva, ouvirProva, inscrever, ouvirInscricao, enviarDatalogger } from './src/firebase';
import { planilhaLiberada, parseHMS, CATS_PADRAO } from './src/OrgExtras';
import { compartilharPdf } from './src/pdf';
import { begin, clear, getState, subscribe, summarize, toCsv, haversine } from './src/store';
import { gruposDe, cumulative, newStage, startStage, status, markPc, parseRoteiro, resolverTrecho, pontos, rank, fmtDur, fmtSigned, pcsToText } from './src/rally';

const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

export default function App() {
  const [, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [keepOn, setKeepOn] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [stage, setStage] = useState(newStage());
  const [factor, setFactor] = useState(1);
  const [kmhTxt, setKmhTxt] = useState('');
  const [rotTxt, setRotTxt] = useState(() => loadRoteiro());
  const [tab, setTab] = useState('gravar');
  const [piloto, setPiloto] = useState(() => ({ nome: '', numero: '', prova: '', navegador: '', email: '', classe: 'GRADUADO', ...loadJson('piloto', {}) }));
  const [hist, setHist] = useState([]);
  const [provaMap, setProvaMap] = useState({ wps: [], coords: [], legs: [], kmh: [], tul: [], trechos: [], categorias: [], lib: {}, refs: [] });
  const [orgInfo, setOrgInfo] = useState(() => loadJson('org', null));
  const [minhaLarg, setMinhaLarg] = useState('');
  const [enviandoDl, setEnviandoDl] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [rankErr, setRankErr] = useState('');
  const [filtro, setFiltro] = useState('TODAS');
  const [enviando, setEnviando] = useState(false);
  const [largadaTxt, setLargadaTxt] = useState(() => loadJson('largada', { h: '', iv: '0' }).h);
  const [intervalo, setIntervalo] = useState(() => loadJson('largada', { h: '', iv: '0' }).iv);
  const pend = useRef({});
  const pushT = useRef(null);
  const armed = useRef(false);
  const autoGps = useRef(false);
  const lastEdit = useRef(0);
  const rotRef = useRef('');
  const warned = useRef({ idx: -2, w100: false, w0: false });

  useEffect(() => subscribe(() => setTick((x) => x + 1)), []);
  useEffect(() => {
    Location.hasStartedLocationUpdatesAsync(TASK).then(setRunning).catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = useCallback(async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à localização para gravar o percurso.');
      return;
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      Alert.alert(
        'Localização "o tempo todo"',
        'Para gravar com a tela apagada, abra as configurações do app e escolha "Permitir o tempo todo" em Localização.',
        [{ text: 'Abrir configurações', onPress: () => Linking.openSettings() }, { text: 'Agora não' }]
      );
      return;
    }
    try {
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
        foregroundService: {
          notificationTitle: 'Rally GPS gravando',
          notificationBody: 'Gravando o percurso da prova',
          notificationColor: '#e8590c',
        },
      });
      begin();
      setRunning(true);
    } catch (e) {
      Alert.alert('Não foi possível iniciar', String(e?.message || e));
    }
  }, []);

  const stop = useCallback(async () => {
    try { await Location.stopLocationUpdatesAsync(TASK); } catch {}
    setRunning(false);
  }, []);

  const toggleKeep = async () => {
    if (keepOn) { deactivateKeepAwake(); setKeepOn(false); }
    else { await activateKeepAwakeAsync(); setKeepOn(true); }
  };

  const exportCsv = async () => {
    const { points } = getState();
    if (!points.length) return Alert.alert('Sem dados', 'Grave um percurso primeiro.');
    try {
      await Sharing.shareAsync(recFile().uri, { mimeType: 'text/csv', dialogTitle: 'Gravação do rally' });
    } catch {
      Share.share({ message: toCsv(points), title: 'percurso-rally.csv' });
    }
  };

  const { points, startedAt } = getState();
  const s = summarize(points);
  const last = points[points.length - 1];
  const kmh = last && last.spd != null && last.spd >= 0 ? last.spd * 3.6 : null;
  const sinceLast = last ? Math.round((now - last.t) / 1000) : null;
  const elapsed = startedAt ? (running ? now : (last?.t ?? startedAt)) - startedAt : 0;

  const cum = cumulative(points);
  const rs = status(stage, points, cum, factor);
  const needPoints = () => Alert.alert('Sem GPS', 'Inicie a gravação e espere os primeiros pontos.');
  rotRef.current = rotTxt;
  // Se o organizador publicou a planilha, usa os trechos da classe do competidor; senão, o roteiro digitado.
  const grupos = gruposDe(provaMap.categorias);
  const cats = provaMap.categorias.length ? provaMap.categorias.map((c) => c.nome) : CATS_PADRAO.map((c) => c.nome);
  const souOrg = !!(orgInfo && orgInfo.pin && orgInfo.prova === piloto.prova.trim().toUpperCase());
  const libOk = souOrg || planilhaLiberada(provaMap.lib);
  const rot = provaMap.trechos.length
    ? { trechos: provaMap.trechos.map((t) => resolverTrecho(t, piloto.classe, grupos)), erros: [] }
    : parseRoteiro(rotTxt);
  const goTrecho = (base, i, keepPcs, tAt) => {
    const t = rot.trechos[i];
    setKmhTxt(String(t.kmh));
    warned.current = { idx: i, w100: false, w0: false };
    return startStage(base, points, cum, factor, { keepPcs, tAt, targetKmh: t.kmh, km: t.km, idx: i, tipo: t.tipo || 'V', min: t.min || 0 });
  };

  // Horário de largada deste carro (ms): base de hoje (HH:MM) + (número-1) x intervalo.
  const tStart = (() => {
    const own = parseHMS(minhaLarg);
    if (own != null) { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() + own * 1000; }
    const m = /^(\d{1,2}):(\d{2})$/.exec(largadaTxt.trim());
    if (!m) return null;
    const d = new Date();
    d.setHours(+m[1], +m[2], 0, 0);
    const k = Math.max(0, (parseInt(piloto.numero, 10) || 1) - 1);
    return d.getTime() + k * (parseFloat(intervalo) || 0) * 1000;
  })();
  const remLarg = tStart != null && armed.current ? (tStart - now) / 1000 : null;

  // Envia alterações do roteiro/largada para a nuvem (agrupadas em 0,8 s).
  const pushProva = (patch) => {
    lastEdit.current = Date.now();
    Object.assign(pend.current, patch);
    clearTimeout(pushT.current);
    pushT.current = setTimeout(() => {
      const data = pend.current; pend.current = {};
      if (piloto.prova.trim()) salvarProva(piloto.prova, data).catch(() => {});
    }, 800);
  };
  const onLargada = (v) => { setLargadaTxt(v); saveJson('largada', { h: v, iv: intervalo }); pushProva({ largada: v }); };
  const onInterv = (v) => { setIntervalo(v); saveJson('largada', { h: largadaTxt, iv: v }); pushProva({ intervalo: v }); };
  const onStage = () => {
    if (!points.length) return needPoints();
    setHist([]);
    setStage(rot.trechos.length ? goTrecho(stage, 0, false) : startStage(stage, points, cum, factor));
  };
  const onPc = () => {
    if (!rs) return Alert.alert('Inicie o trecho', 'Toque em "Zerar / iniciar trecho" antes.');
    const marked = markPc(stage, points, cum, factor);
    setHist((h) => [...h, stage]);
    const nt = stage.idx >= 0 ? rot.trechos[stage.idx]?.nt || 0 : 0;
    const liberar = nt > 0 ? points[points.length - 1].t + nt * 1000 : undefined; // neutro: o próximo trecho só começa depois da parada
    if (stage.idx >= 0 && stage.idx + 1 < rot.trechos.length) { if (nt > 0) Vibration.vibrate(400); setStage(goTrecho(marked, stage.idx + 1, true, liberar)); }
    else if (stage.idx >= 0) { Vibration.vibrate([0, 500, 200, 500]); setStage({ ...marked, active: false }); }
    else setStage(marked);
  };
  const onUndo = () => {
    if (!hist.length) return;
    const prev = hist[hist.length - 1];
    setHist(hist.slice(0, -1));
    warned.current = { idx: prev.idx, w100: true, w0: true };
    setKmhTxt(prev.targetKmh ? String(prev.targetKmh) : '');
    setStage(prev);
  };
  const setP = (k) => (v) => { const n = { ...piloto, [k]: v }; setPiloto(n); saveJson('piloto', n); };
  const onInscrever = async () => {
    if (!piloto.nome.trim() || !piloto.numero.trim() || !piloto.prova.trim()) return Alert.alert('Falta preencher', 'Informe nome, número e código da prova.');
    try {
      await inscrever({ prova: piloto.prova, numero: piloto.numero, piloto: piloto.nome, navegador: piloto.navegador, classe: piloto.classe, email: piloto.email });
      Alert.alert('Inscrição feita', `#${piloto.numero} ${piloto.nome} · ${piloto.classe}`);
    } catch (e) { Alert.alert('Não inscreveu', String(e?.message || e)); }
  };
  const onDatalogger = async () => {
    if (!piloto.nome.trim() || !piloto.numero.trim() || !piloto.prova.trim()) return Alert.alert('Falta preencher', 'Informe nome, número e código da prova.');
    if (points.length < 10) return Alert.alert('Sem trilha', 'Grave o percurso antes de enviar o datalogger.');
    setEnviandoDl(true);
    try {
      await enviarDatalogger({ prova: piloto.prova, numero: piloto.numero, nome: piloto.nome, classe: piloto.classe, points, pcs: stage.pcs });
      Alert.alert('Datalogger enviado', `${points.length} pontos. O organizador calcula o resultado oficial com ele.`);
    } catch (e) { Alert.alert('Não enviou', 'Confira a internet e tente de novo. ' + String(e?.message || e)); }
    setEnviandoDl(false);
  };
  const onEnviar = async () => {
    if (!piloto.nome.trim() || !piloto.numero.trim() || !piloto.prova.trim()) return Alert.alert('Falta preencher', 'Informe nome, número e código da prova.');
    if (!stage.pcs.length) return Alert.alert('Sem PCs', 'Marque ao menos um PC antes de enviar.');
    setEnviando(true);
    try {
      await enviarResultado({ ...piloto, pcs: stage.pcs, pontos: pontos(stage.pcs) });
      Alert.alert('Enviado', `${stage.pcs.length} PC(s), ${pontos(stage.pcs).toFixed(1)} pontos. Veja na aba Ranking.`);
    } catch (e) {
      Alert.alert('Não enviou', 'Confira a internet e tente de novo. ' + String(e?.message || e));
    }
    setEnviando(false);
  };
  useEffect(() => {
    if (!piloto.prova.trim()) return;
    return ouvirProva(piloto.prova, (d) => {
      if (Date.now() - lastEdit.current < 2500) return; // não sobrescreve o que você está digitando
      if (typeof d.roteiro === 'string' && d.roteiro !== rotRef.current) { setRotTxt(d.roteiro); saveRoteiro(d.roteiro); }
      if (typeof d.largada === 'string') setLargadaTxt(d.largada);
      {
        const pair = (a) => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
        setProvaMap({ wps: pair(d.wps || []), coords: pair(d.rota || []), legs: d.legs || [], kmh: d.kmh || [], tul: d.tul || [], trechos: d.trechos || [], categorias: d.categorias || [], lib: d.lib || {}, refs: d.refs || [] });
      }
      if (d.intervalo != null) setIntervalo(String(d.intervalo));
    }, () => {});
  }, [piloto.prova]);
  // Arma a largada quando o horário ainda está no futuro.
  useEffect(() => {
    armed.current = tStart != null && tStart > Date.now();
    autoGps.current = false;
  }, [largadaTxt, intervalo, piloto.numero]);
  // A cada segundo: liga o GPS 3 min antes e inicia o trecho 1 na hora da largada.
  useEffect(() => {
    if (tStart == null || !armed.current) return;
    const rem = (tStart - Date.now()) / 1000;
    if (rem <= 180 && !running && !autoGps.current) { autoGps.current = true; start(); }
    if (rem <= 0 && points.length && points[points.length - 1].t >= tStart) {
      armed.current = false;
      Vibration.vibrate([0, 700, 200, 700]);
      setHist([]);
      setStage(rot.trechos.length ? goTrecho(stage, 0, false, tStart) : startStage(stage, points, cum, factor, { tAt: tStart }));
    }
  }, [now]);
  // Minha largada definida pelo organizador (horário HH:MM:SS na inscrição).
  useEffect(() => {
    setMinhaLarg('');
    if (!piloto.prova.trim() || !piloto.numero.trim()) return;
    return ouvirInscricao(piloto.prova, piloto.numero, (d) => setMinhaLarg(d?.largada || ''), () => {});
  }, [piloto.prova, piloto.numero]);
  useEffect(() => {
    if (tab !== 'ranking' || !piloto.prova.trim()) return;
    setRankErr('');
    return ouvirRanking(piloto.prova, (rows) => setRanking(rank(rows)), (e) => setRankErr(String(e?.message || e)));
  }, [tab, piloto.prova]);
  const onRot = (txt) => { setRotTxt(txt); saveRoteiro(txt); pushProva({ roteiro: txt }); };
  const onKmh = (txt) => {
    setKmhTxt(txt);
    const v = parseFloat(txt.replace(',', '.'));
    setStage((x) => ({ ...x, targetKmh: v > 0 ? v : 0 }));
  };
  const adj = (m) => setStage((x) => ({ ...x, adjust: x.adjust + m }));
  const refPerto = (() => {
    if (!last || !provaMap.refs.length) return null;
    let b = null;
    for (const r of provaMap.refs) { const d = haversine(last, r); if (!b || d < b.d) b = { r, d }; }
    return b && b.d <= 80 ? b : null;
  })();
  const ahead = rs && rs.aheadSec != null ? rs.aheadSec : null;
  // Posição no percurso: distância planejada dos trechos já feitos + parcial do trecho atual.
  const feitos = stage.idx > 0 ? rot.trechos.slice(0, stage.idx).reduce((a, t) => a + t.km * 1000, 0) : 0;
  const globalDist = feitos + (rs ? rs.dist : 0);
  const remain = rs ? rs.remain : null;
  const neutroRest = stage.active && last && stage.t0 > last.t ? (stage.t0 - last.t) / 1000 : null;
  const acc = last?.acc;
  const stale = sinceLast != null && sinceLast > 5;
  const gpsColor = !last || stale || acc > 15 ? '#ff5252' : acc > 6 ? '#ffb300' : '#4caf50';
  const gpsTxt = !last ? 'GPS: sem pontos' : stale ? `GPS: sem sinal há ${sinceLast} s` : acc > 6 ? `GPS: aguarde (${acc.toFixed(0)} m)` : `GPS pronto (${acc.toFixed(1)} m)`;
  useEffect(() => {
    const w = warned.current;
    if (remain == null || w.idx !== stage.idx) return;
    if (!w.w100 && remain <= 100) { w.w100 = true; Vibration.vibrate(150); }
    if (!w.w0 && remain <= 0) { w.w0 = true; Vibration.vibrate([0, 500, 200, 500]); }
  }, [remain, stage.idx]);

  return (
    <ScrollView style={st.root} contentContainerStyle={st.wrap}>
      <StatusBar style="light" />
      <Text style={st.h1}>Rally GPS · Teste</Text>
      <Text style={st.sub}>{running ? '● Gravando' : points.length ? `○ Parado · ${points.length} pontos salvos` : '○ Parado'}{Platform.OS === 'android' ? '' : ' (somente Android)'}</Text>

      <View style={st.row}>
        <View style={[st.gps, { borderColor: gpsColor }]}>
          <Text style={[st.gpsTx, { color: gpsColor }]}>{gpsTxt}</Text>
        </View>
      </View>
      {remLarg != null && remLarg > 0 && (
        <View style={[st.gps, { borderColor: '#ff7a2e', marginBottom: 10 }]}>
          <Text style={[st.gpsTx, { color: '#ff7a2e', fontSize: 20 }]}>Largada em {fmtDur(remLarg)}</Text>
          {!running && remLarg > 180 && <Text style={st.tipTx}>O GPS liga sozinho 3 min antes.</Text>}
        </View>
      )}
      <View style={st.row}>
        {['gravar', 'ranking', 'tulipas', 'organizar'].map((t) => (
          <TouchableOpacity key={t} style={[st.tab, tab === t && st.tabOn]} onPress={() => setTab(t)}>
            <Text style={[st.tabTx, tab === t && { color: '#0c1014' }]}>{{ gravar: 'Gravar', ranking: 'Ranking', tulipas: 'Tulipas', organizar: 'Organizar' }[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'organizar' ? (
        <Organizador st={st} prova={piloto.prova} provaMap={provaMap} last={last} onOrg={setOrgInfo} />
      ) : tab === 'tulipas' ? (
        <View style={st.card}>
          <Text style={st.tip}>Roadbook · prova {piloto.prova.trim() || '—'}</Text>
          {!libOk ? (
            <Text style={[st.tipTx, { color: '#ffb300' }]}>Planilha ainda não liberada pelo organizador{provaMap.lib?.ini ? ` (libera em ${provaMap.lib.ini})` : ''}.</Text>
          ) : provaMap.tul.length === 0 ? (
            <Text style={st.tipTx}>O organizador ainda não publicou o roadbook desta prova.</Text>
          ) : (
            <Text style={st.tipTx}>Esquerda: parcial e total (km). A tulipa mostra o cruzamento: você chega pela rua de baixo e segue a seta. A entrada destacada é a próxima.</Text>
          )}
          {libOk && <Roadbook st={st} tul={provaMap.tul} classe={piloto.classe} grupos={grupos} dist={rs || stage.idx >= 0 ? globalDist : 0} />}
          {libOk && provaMap.tul.length > 0 && (
            <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={() => compartilharPdf(piloto.prova.trim().toUpperCase(), provaMap.tul).catch((e) => Alert.alert('Não gerou o PDF', String(e?.message || e)))}>
              <Text style={st.btn2Tx}>Gerar PDF do roadbook</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : tab === 'ranking' ? (
        <View>
          <View style={st.card}>
            <Text style={st.tip}>Prova: {piloto.prova.trim() || '—'}</Text>
            {!piloto.prova.trim() && <Text style={st.tipTx}>Preencha o código da prova na aba Gravar.</Text>}
            {rankErr ? <Text style={[st.tipTx, { color: '#ff5252' }]}>{rankErr}</Text> : null}
            {ranking.length === 0 && piloto.prova.trim() && !rankErr ? <Text style={st.tipTx}>Nenhum resultado enviado ainda.</Text> : null}
            {!souOrg && provaMap.lib?.resultado === false ? <Text style={[st.tipTx, { color: '#ffb300' }]}>Resultado ainda não liberado pelo organizador.</Text> : null}
            <View style={[st.row, { flexWrap: 'wrap' }]}>
              {['TODAS', ...cats].map((c) => (
                <TouchableOpacity key={c} style={[st.btn2, { flex: 0, paddingHorizontal: 10, paddingVertical: 6 }, filtro === c && { backgroundColor: '#ff7a2e' }]} onPress={() => setFiltro(c)}>
                  <Text style={[st.btn2Tx, { fontSize: 11 }, filtro === c && { color: '#0c1014' }]}>{c === 'TODAS' ? 'Todas' : c[0] + c.slice(1).toLowerCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {(souOrg || provaMap.lib?.resultado !== false) && ranking.filter((r) => filtro === 'TODAS' || r.classe === filtro).map((r, i) => (
              <View key={r.numero} style={st.line}>
                <Text style={st.k}>{i + 1}º  #{r.numero} {r.nome} · {r.classe ? r.classe.slice(0, 3) : ''} · {r.npcs} PC{r.oficial ? ' ✔ oficial' : ''}</Text>
                {(souOrg || provaMap.lib?.soma !== false) && <Text style={st.v}>{Number(r.pontos).toFixed(1)} pts</Text>}
              </View>
            ))}
            <Text style={[st.tipTx, { marginTop: 8 }]}>Pontos: 1 por segundo de diferença em cada PC (menos é melhor).</Text>
          </View>
        </View>
      ) : (
      <>
      <View style={st.row}>
        <Big label="Velocidade" value={kmh != null ? kmh.toFixed(0) : '—'} unit="km/h" />
        <Big label="Distância" value={(s.dist / 1000).toFixed(2)} unit="km" />
      </View>
      <View style={st.row}>
        <Big label="Tempo" value={fmtTime(elapsed)} />
        <Big label="Pontos" value={String(s.n)} />
      </View>

      <View style={st.card}>
        <Line k="Precisão do último ponto" v={last?.acc != null ? `${last.acc.toFixed(0)} m` : '—'} />
        <Line k="Segundos desde o último ponto" v={sinceLast != null ? `${sinceLast} s` : '—'} />
        <Line k="Intervalo médio entre pontos" v={s.n > 1 ? `${(s.avgInterval / 1000).toFixed(1)} s` : '—'} />
        <Line k="Maior buraco sem pontos" v={s.n > 1 ? `${(s.maxGap / 1000).toFixed(0)} s` : '—'} />
        <Line k="Velocidade média" v={s.n > 1 ? `${s.avgKmh.toFixed(1)} km/h` : '—'} />
        <Line k="Pontos simulados (mock)" v={String(points.filter((p) => p.mocked).length)} />
      </View>

      <View style={st.card}>
        <Text style={st.tip}>Odômetro de rally</Text>
        {neutroRest != null && (
          <View style={[st.gps, { borderColor: '#ff5252', marginBottom: 8 }]}>
            <Text style={[st.gpsTx, { color: '#ff5252', fontSize: 18 }]}>NEUTRO · PARE · liberação em {fmtDur(neutroRest)}</Text>
          </View>
        )}
        {stage.active && stage.tipo === 'D' && <Text style={[st.tipTx, { color: '#ffe600' }]}>Deslocamento: limite de {stage.min}' — não vale pontos</Text>}
        <View style={st.row}>
          <Big label="Parcial" value={rs ? (rs.dist / 1000).toFixed(3) : '—'} unit="km" />
          <Big label="Tempo do trecho" value={rs ? fmtDur(rs.elapsed) : '—'} />
        </View>
        <View style={st.row}>
          <Big label="Média" value={rs ? rs.avgKmh.toFixed(1) : '—'} unit="km/h" />
          <View style={st.big}>
            <Text style={st.bigL}>Vs ideal</Text>
            <Text style={[st.bigV, ahead != null && { color: Math.abs(ahead) < 1 ? '#4caf50' : ahead > 0 ? '#ffb300' : '#ff5252' }]}>
              {ahead != null ? fmtSigned(ahead) : '—'}
            </Text>
            <Text style={st.bigU}>{ahead == null ? 'defina a média alvo' : ahead > 0 ? 'adiantado' : 'atrasado'}</Text>
          </View>
        </View>
        {stage.idx >= 0 && rs && (
          <View style={st.line}>
            <Text style={st.k}>Trecho {stage.idx + 1}/{rot.trechos.length} · {stage.km} km</Text>
            <Text style={[st.v, remain <= 100 && { color: '#ffb300' }]}>{remain > 0 ? `faltam ${Math.round(remain)} m` : 'CHEGOU — marque o PC'}</Text>
          </View>
        )}
        {stage.idx >= 0 && !stage.active && stage.pcs.length > 0 && <Text style={st.tip}>Roteiro concluído</Text>}
        <View style={st.line}>
          <Text style={st.k}>Média alvo do trecho (km/h)</Text>
          <TextInput style={st.input} value={kmhTxt} onChangeText={onKmh} keyboardType="decimal-pad" placeholder="ex: 30" placeholderTextColor="#666" />
        </View>
        <View style={st.row}>
          <TouchableOpacity style={st.btn2} onPress={() => adj(-10)}><Text style={st.btn2Tx}>−10 m</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => adj(10)}><Text style={st.btn2Tx}>+10 m</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => setFactor((f) => f - 0.001)}><Text style={st.btn2Tx}>Calib −0,1%</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => setFactor((f) => f + 0.001)}><Text style={st.btn2Tx}>+0,1%</Text></TouchableOpacity>
        </View>
        <Text style={st.tipTx}>Calibração: x{factor.toFixed(4)} (ajuste até bater com o hodômetro da organização)</Text>
        {provaMap.refs.length > 0 && (
          <TouchableOpacity style={[st.btn2, { marginTop: 8, borderColor: refPerto ? '#ffe600' : '#262b32' }]} disabled={!refPerto}
            onPress={() => { adj(refPerto.r.km * 1000 - globalDist); Vibration.vibrate(120); }}>
            <Text style={[st.btn2Tx, { color: refPerto ? '#ffe600' : '#666' }]}>{refPerto ? `REF ${refPerto.r.n} aqui (${refPerto.d.toFixed(0)} m) · corrigir odômetro p/ ${refPerto.r.km.toFixed(3)} km` : 'REF: sem marco de referência por perto'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[st.btn, { marginTop: 10 }]} onPress={onStage}><Text style={st.btnTx}>Zerar / iniciar trecho</Text></TouchableOpacity>
        <TouchableOpacity style={[st.btn, { backgroundColor: '#2e7d32' }]} onPress={onPc}><Text style={[st.btnTx, { color: '#fff' }]}>Marcar PC</Text></TouchableOpacity>
        {hist.length > 0 && (
          <TouchableOpacity style={[st.btn2, { marginBottom: 8 }]} onPress={onUndo}><Text style={st.btn2Tx}>Desfazer último PC</Text></TouchableOpacity>
        )}
        {stage.pcs.map((p) => (
          <View key={p.n} style={st.line}>
            <Text style={st.k}>PC{p.n} · {(p.dist / 1000).toFixed(3)} km · {fmtDur(p.elapsed)}</Text>
            <Text style={st.v}>{p.diff != null ? `${p.diff > 0 ? 'atrasado' : 'adiantado'} ${Math.abs(p.diff).toFixed(1)} s` : `${p.avgKmh.toFixed(1)} km/h`}</Text>
          </View>
        ))}
        {stage.pcs.length > 0 && (
          <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={() => Share.share({ message: pcsToText(stage, factor) })}>
            <Text style={st.btn2Tx}>Compartilhar PCs</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={st.card}>
        <Text style={st.tip}>Piloto e prova</Text>
        <TextInput style={st.field} value={piloto.nome} onChangeText={setP('nome')} placeholder="Nome (piloto/dupla)" placeholderTextColor="#666" />
        <TextInput style={st.field} value={piloto.numero} onChangeText={setP('numero')} placeholder="Número do carro" placeholderTextColor="#666" keyboardType="number-pad" />
        <TextInput style={st.field} value={piloto.navegador} onChangeText={setP('navegador')} placeholder="Navegador (opcional)" placeholderTextColor="#666" />
        <TextInput style={st.field} value={piloto.email} onChangeText={setP('email')} placeholder="E-mail (opcional)" placeholderTextColor="#666" autoCapitalize="none" keyboardType="email-address" />
        <View style={[st.row, { marginTop: 8, marginBottom: 0, flexWrap: 'wrap' }]}>
          {cats.map((c) => (
            <TouchableOpacity key={c} style={[st.btn2, { flex: 0, paddingHorizontal: 12, paddingVertical: 8 }, piloto.classe === c && { backgroundColor: '#ff7a2e' }]} onPress={() => setP('classe')(c)}>
              <Text style={[st.btn2Tx, piloto.classe === c && { color: '#0c1014' }]}>{c[0] + c.slice(1).toLowerCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={st.field} value={piloto.prova} onChangeText={setP('prova')} placeholder="Código da prova (ex: TESTE1)" placeholderTextColor="#666" autoCapitalize="characters" />
        <View style={st.row}>
          <TextInput style={[st.field, { flex: 1 }]} value={largadaTxt} onChangeText={onLargada} placeholder="Largada HH:MM" placeholderTextColor="#666" keyboardType="numbers-and-punctuation" />
          <TextInput style={[st.field, { flex: 1 }]} value={intervalo} onChangeText={onInterv} placeholder="Intervalo (s)" placeholderTextColor="#666" keyboardType="number-pad" />
        </View>
        <Text style={st.tipTx}>Roteiro e largada são compartilhados com todos que usam o mesmo código da prova. Se o organizador sortear a largada, o seu horário aparece aqui sozinho{minhaLarg ? `: ${minhaLarg}` : ''}. Sem sorteio: horário + (número − 1) × intervalo.</Text>
        <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={onInscrever}><Text style={st.btn2Tx}>Inscrever-se na prova</Text></TouchableOpacity>
        <TouchableOpacity style={[st.btn, { backgroundColor: '#1565c0', marginTop: 8, marginBottom: 0 }]} onPress={onEnviar} disabled={enviando}>
          <Text style={[st.btnTx, { color: '#fff' }]}>{enviando ? 'Enviando…' : 'Enviar resultado'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={onDatalogger} disabled={enviandoDl}>
          <Text style={st.btn2Tx}>{enviandoDl ? 'Enviando datalogger…' : 'Enviar datalogger (resultado oficial)'}</Text>
        </TouchableOpacity>
      </View>

      <View style={st.card}>
        <Text style={st.tip}>Roteiro da prova</Text>
        <Text style={st.tipTx}>Uma linha por trecho: distância em km e média alvo. Ex.: 4,2 30</Text>
        <TextInput style={st.area} value={rotTxt} onChangeText={onRot} multiline placeholder={'4,2 30\n3,5 25\n6 40'} placeholderTextColor="#666" autoCapitalize="none" />
        <Text style={st.tipTx}>{rot.trechos.length} trecho(s){rot.erros.length ? ` · linha(s) com erro: ${rot.erros.join(', ')}` : ''}. Com roteiro, "Marcar PC" já inicia o próximo trecho.</Text>
      </View>

      <TouchableOpacity style={[st.btn, running && st.btnStop]} onPress={running ? stop : start}>
        <Text style={st.btnTx}>{running ? 'Parar gravação' : 'Iniciar gravação'}</Text>
      </TouchableOpacity>
      <View style={st.row}>
        <TouchableOpacity style={st.btn2} onPress={exportCsv}><Text style={st.btn2Tx}>Exportar CSV</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={toggleKeep}><Text style={st.btn2Tx}>{keepOn ? 'Tela: ligada' : 'Tela: normal'}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={() => { if (!running) clear(); else Alert.alert('Pare a gravação antes de limpar.'); }}><Text style={st.btn2Tx}>Limpar</Text></TouchableOpacity>
      </View>

      <View style={st.card}>
        <Text style={st.tip}>Roteiro do teste</Text>
        <Text style={st.tipTx}>1. Toque em Iniciar e permita "o tempo todo".{'\n'}2. Bloqueie a tela e ande ou dirija por 10 a 15 minutos.{'\n'}3. Volte ao app e olhe "Maior buraco sem pontos": quanto menor, melhor (ideal: 2 a 3 s).{'\n'}4. Compare a distância com o hodômetro do carro ou com o Kraken.</Text>
      </View>
      </>
      )}
    </ScrollView>
  );
}

const Big = ({ label, value, unit }) => (
  <View style={st.big}>
    <Text style={st.bigL}>{label}</Text>
    <Text style={st.bigV}>{value}{unit ? <Text style={st.bigU}> {unit}</Text> : null}</Text>
  </View>
);
const Line = ({ k, v }) => (
  <View style={st.line}><Text style={st.k}>{k}</Text><Text style={st.v}>{v}</Text></View>
);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c1014' },
  wrap: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  h1: { color: '#f5f5f5', fontSize: 24, fontWeight: '800' },
  sub: { color: '#a8a8a8', marginBottom: 14, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  big: { flex: 1, backgroundColor: '#151a20', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#262b32' },
  bigL: { color: '#a8a8a8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  bigV: { color: '#f5f5f5', fontSize: 30, fontWeight: '800', marginTop: 4 },
  bigU: { fontSize: 14, color: '#a8a8a8', fontWeight: '400' },
  card: { backgroundColor: '#151a20', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#262b32' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  k: { color: '#a8a8a8', flex: 1 }, v: { color: '#f5f5f5', fontWeight: '700' },
  btn: { backgroundColor: '#ff7a2e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnStop: { backgroundColor: '#c0392b' },
  btnTx: { color: '#0c1014', fontWeight: '800', fontSize: 16 },
  btn2: { flex: 1, borderWidth: 1, borderColor: '#ff7a2e', borderRadius: 12, padding: 12, alignItems: 'center' },
  btn2Tx: { color: '#ff7a2e', fontWeight: '700', fontSize: 13 },
  input: { color: '#f5f5f5', borderWidth: 1, borderColor: '#262b32', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, minWidth: 80, textAlign: 'right', fontWeight: '700' },
  area: { color: '#f5f5f5', borderWidth: 1, borderColor: '#262b32', borderRadius: 8, padding: 10, minHeight: 90, marginVertical: 8, textAlignVertical: 'top' },
  gps: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  gpsTx: { fontWeight: '800' },
  tab: { flex: 1, borderWidth: 1, borderColor: '#ff7a2e', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 2, alignItems: 'center' },
  tabOn: { backgroundColor: '#ff7a2e' },
  tabTx: { color: '#ff7a2e', fontWeight: '800', fontSize: 12 },
  field: { color: '#f5f5f5', borderWidth: 1, borderColor: '#262b32', borderRadius: 8, padding: 10, marginTop: 8 },
  tip: { color: '#f5f5f5', fontWeight: '800', marginBottom: 6 },
  tipTx: { color: '#a8a8a8', lineHeight: 22 },
});
