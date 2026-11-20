import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { TASK } from './src/gpsTask';
import { loadRoteiro, saveRoteiro, recFile, loadJson, saveJson } from './src/persist';
import { Roadbook, tulComp } from './src/Tulipa';
import * as ScreenOrientation from 'expo-screen-orientation';
import Organizador from './src/Organizador';
import { enviarResultado, ouvirRanking, salvarProva, ouvirProva, ouvirInscricao, ouvirMinhaLargada, enviarDatalogger, ouvirAuth, sairConta, lerPerfil } from './src/firebase';
import Login from './src/Login';
import Fluxo, { DlTela } from './src/Fluxo';
import { planilhaLiberada, parseHMS, CATS_PADRAO } from './src/OrgExtras';
import { NavTela, NavConfig, PilotoTela, loadNav } from './src/Nav';
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
  const [largManual, setLargManualRaw] = useState('');
  const [dlTick, setDlTick] = useState(0);
  const [soDl, setSoDl] = useState(false);
  const [pilotoOpen, setPilotoOpen] = useState(false);
  const [cfgPiloto, setCfgPiloto] = useState(false);
  const [abrirReq, setAbrirReq] = useState(null);
  const [tab, setTab] = useState(() => (loadJson('papel', 'competidor') === 'organizador' ? 'organizar' : 'provas'));
  const [user, setUser] = useState(undefined); // undefined = carregando, null = sem login
  const [papel, setPapelRaw] = useState(() => loadJson('papel', 'competidor'));
  const [papeis, setPapeis] = useState({});
  const setPapel = (p) => { setPapelRaw(p); saveJson('papel', p); setTab(p === 'organizador' ? 'organizar' : 'provas'); };
  const [navOpen, setNavOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [odoBase, setOdoBase] = useState(0);
  const [odoAdj, setOdoAdj] = useState(0);
  const odoAtual = () => { const v = (points.length ? cum[points.length - 1] * factor : 0) + odoAdj; return Number.isFinite(v) ? v : 0; };
  const [piloto, setPiloto] = useState(() => ({ nome: '', numero: '', prova: '', navegador: '', email: '', classe: 'GRADUADO', ...loadJson('piloto', {}) }));
  const [hist, setHist] = useState([]);
  const [provaMap, setProvaMap] = useState({ wps: [], coords: [], legs: [], kmh: [], tul: [], trechos: [], trs: [], categorias: [], lib: {}, refs: [], pcl: [] });
  const [orgInfo, setOrgInfo] = useState(() => loadJson('org', null));
  const [minhaLarg, setMinhaLarg] = useState('');
  const [enviandoDl, setEnviandoDl] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [rankErr, setRankErr] = useState('');
  const [filtro, setFiltro] = useState('TODAS');
  const [enviando, setEnviando] = useState(false);
  const [largadaTxt, setLargadaTxt] = useState(() => loadJson('largada', { h: '', iv: '0' }).h);
  const [intervalo, setIntervalo] = useState(() => loadJson('largada', { h: '', iv: '60' }).iv);
  const pend = useRef({});
  const pushT = useRef(null);
  const armed = useRef(false);
  const autoGps = useRef(false);
  const lastEdit = useRef(0);
  const rotRef = useRef('');
  const warned = useRef({ idx: -2, w100: false, w0: false });

  useEffect(() => subscribe(() => setTick((x) => x + 1)), []);
  useEffect(() => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); }, []);
  useEffect(() => ouvirAuth((u) => {
    setUser(u || null);
    if (u) lerPerfil(u.uid).then((p) => setPapeis(p.papeis || {})).catch(() => {});
  }), []);
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
  const souOrg = papel === 'organizador';
  const libOk = souOrg || planilhaLiberada(provaMap.lib);
  const tulVis = souOrg ? provaMap.tul : tulComp(provaMap.tul); // o PC é do organizador; o competidor vê só o neutro
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
    const own = parseHMS(minhaLarg || largManual);
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
      if (piloto.prova.trim() && souOrg) salvarProva(piloto.prova, data).catch(() => {});
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
  const escolher = (it) => {
    const n = { ...piloto, prova: it.prova, numero: it.numero, nome: it.piloto, navegador: it.navegador || '', email: user?.email || '', classe: it.classe };
    setPiloto(n); saveJson('piloto', n);
  };
  const setP = (k) => (v) => { const n = { ...piloto, [k]: v }; setPiloto(n); saveJson('piloto', n); };
  const onDatalogger = async () => {
    if (!piloto.nome.trim() || !piloto.numero.trim() || !piloto.prova.trim()) return Alert.alert('Escolha a prova', 'Abra "Minhas provas" e toque em INICIAR na prova em que você está inscrito.');
    const jan = loadJson(kJan(), {});
    const pts = points.filter((p) => (jan.ini == null || p.t >= jan.ini) && (jan.fim == null || p.t <= jan.fim));
    if (pts.length < 10) return Alert.alert('Sem trilha da prova', 'Não há pontos gravados entre a largada e o fim da prova. O datalogger só envia esse período.');
    setEnviandoDl(true);
    try {
      await enviarDatalogger({ prova: piloto.prova, numero: piloto.numero, nome: piloto.nome, classe: piloto.classe, points: pts, pcs: stage.pcs, tIni: jan.ini || undefined });
      saveJson('dlstat', { ...loadJson('dlstat', {}), [piloto.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '') + '_' + piloto.numero.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')]: { n: pts.length, em: Date.now() } }); setDlTick((x) => x + 1);
      Alert.alert('Datalogger enviado', `${pts.length} pontos. O organizador calcula o resultado oficial com ele.`);
    } catch (e) { Alert.alert('Não enviou', 'Confira a internet e tente de novo. ' + String(e?.message || e)); }
    setEnviandoDl(false);
  };
  const onEnviar = async () => {
    if (!piloto.nome.trim() || !piloto.numero.trim() || !piloto.prova.trim()) return Alert.alert('Escolha a prova', 'Abra "Minhas provas" e toque em INICIAR na prova em que você está inscrito.');
    // Os PCs são do organizador: sem PC marcado, a finalização envia a trilha (datalogger) e o organizador calcula o resultado oficial.
    if (!stage.pcs.length) return onDatalogger();
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
    const slugP = piloto.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
    setLargManualRaw(loadJson('largm', {})[slugP] || '');
    const cache = loadJson('prova_' + slugP, null);
    const aplica = (d, nuvem) => {
      if (nuvem) saveJson('prova_' + slugP, d);
      if (nuvem && Date.now() - lastEdit.current < 2500) return; // não sobrescreve o que você está digitando
      if (typeof d.roteiro === 'string' && d.roteiro !== rotRef.current) { setRotTxt(d.roteiro); saveRoteiro(d.roteiro); }
      if (typeof d.largada === 'string') setLargadaTxt(d.largada);
      {
        const pair = (a) => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
        setProvaMap({ wps: pair(d.wps || []), coords: pair(d.rota || []), legs: d.legs || [], kmh: d.kmh || [], tul: d.tul || [], trechos: d.trechos || [], trs: d.trs || [], categorias: d.categorias || [], lib: d.lib || {}, refs: d.refs || [], pcl: d.pcl || [] });
      }
      if (d.intervalo != null) setIntervalo(String(d.intervalo));
    };
    if (cache) aplica(cache, false);
    return ouvirProva(piloto.prova, (d) => aplica(d, true), () => {});
  }, [piloto.prova]);
  // Arma a largada quando o horário ainda está no futuro.
  useEffect(() => {
    armed.current = tStart != null && tStart > Date.now();
    autoGps.current = false;
  }, [largadaTxt, intervalo, piloto.numero, minhaLarg, largManual]);
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
    if (!piloto.prova.trim()) return;
    const email = (user && user.email) || piloto.email;
    if (email) {
      return ouvirMinhaLargada(piloto.prova, email, (lista) => {
        const meu = lista.find((x) => String(x.numero) === String(piloto.numero)) || lista[0];
        setMinhaLarg((meu && meu.largada) || '');
      }, () => {});
    }
    if (!piloto.numero.trim()) return;
    return ouvirInscricao(piloto.prova, piloto.numero, (d) => setMinhaLarg(d?.largada || ''), () => {});
  }, [piloto.prova, piloto.numero, user && user.email]);
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
  // Janela do datalogger: da largada (início do 1º trecho) até ENCERRAR PROVA. Só esses pontos são enviados.
  const kJan = () => 'jan_' + piloto.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  useEffect(() => {
    if (!stage.active || !(stage.idx <= 0) || !stage.t0 || !piloto.prova.trim()) return;
    const j = loadJson(kJan(), {});
    if (j.ini !== stage.t0) saveJson(kJan(), { ini: stage.t0 });
  }, [stage.active, stage.idx, stage.t0, piloto.prova]);
  const encerrarProva = () => {
    const j = loadJson(kJan(), {});
    saveJson(kJan(), { ...j, fim: Date.now() });
    setStage(newStage()); setHist([]); setNavOpen(false);
    Alert.alert('Prova encerrada', 'Agora envie o datalogger na tela da prova (Sincronizar agora).');
  };
  const adjAll = (m) => { adj(m); setOdoAdj((a) => a + m); };
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
  const ultE = tulVis.length ? tulVis[tulVis.length - 1] : null;
  const fimProva = !!(ultE && ultE.t === 'C' && (rs || stage.idx >= 0) && globalDist >= ultE.d - 5);
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

  if (user === undefined) return <View style={[st.root, { justifyContent: 'center' }]}><Text style={[st.sub, { textAlign: 'center' }]}>Carregando…</Text></View>;
  if (!user) return (
    <ScrollView style={st.root} contentContainerStyle={st.wrap}>
      <StatusBar style="light" />
      <Text style={st.h1}>Rally GPS</Text>
      <Login st={st} onEntrou={(p) => setPapel(p)} />
    </ScrollView>
  );
  const minhasAbas = papel === 'organizador' ? ['provas', 'organizar', 'ranking'] : ['provas', 'tulipas', 'ranking'];
  const setLargManual = (v) => { setLargManualRaw(v); const k = piloto.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ''); saveJson('largm', { ...loadJson('largm', {}), [k]: v }); };
  const onPlanilha = () => {
    if (!libOk) return Alert.alert('Planilha não liberada', 'Aguarde a liberação do organizador. Você pode usar "Apenas datalogger".');
    if (!running) start();
    setNavOpen(true);
  };
  const onSoDl = () => { if (!running) start(); setSoDl(true); };
  const finalizarDl = async () => { await stop(); await onDatalogger(); setSoDl(false); };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
    <ScrollView style={st.root} contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
      <StatusBar style="light" />
      <Text style={st.h1}>Rally GPS</Text>
      <View style={[st.row, { alignItems: 'center' }]}>
        <Text style={[st.sub, { flex: 1 }]}>{user.email} · {papel === 'organizador' ? 'Organizador' : 'Competidor'}</Text>
        {papeis.organizador && papeis.competidor && <TouchableOpacity onPress={() => setPapel(papel === 'organizador' ? 'competidor' : 'organizador')}><Text style={{ color: '#ff7a2e', fontWeight: '800', marginRight: 14 }}>{papel === 'organizador' ? 'Ser competidor' : 'Ser organizador'}</Text></TouchableOpacity>}
        <TouchableOpacity onPress={() => Alert.alert('Sair da conta?', user.email, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', onPress: () => { sairConta().catch(() => {}); } }])}><Text style={{ color: '#ff5252', fontWeight: '800' }}>Sair</Text></TouchableOpacity>
      </View>
      <Text style={st.sub}>{running ? '● Gravando' : points.length ? `○ Parado · ${points.length} pontos salvos` : '○ Parado'}{Platform.OS === 'android' ? '' : ' (somente Android)'}</Text>

      <View style={st.row}>
        <View style={[st.gps, { borderColor: gpsColor, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }]}>
          <Text style={[st.gpsTx, { color: gpsColor, flex: 1 }]}>{running ? gpsTxt : 'GPS desligado'}</Text>
          <TouchableOpacity onPress={running ? stop : start} style={{ backgroundColor: running ? '#37474f' : '#4caf50', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: running ? '#fff' : '#0c1014', fontWeight: '900', fontSize: 13 }}>{running ? 'DESLIGAR GPS' : 'LIGAR GPS'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {remLarg != null && remLarg > 0 && (
        <View style={[st.gps, { borderColor: '#ff7a2e', marginBottom: 10 }]}>
          <Text style={[st.gpsTx, { color: '#ff7a2e', fontSize: 20 }]}>Largada em {fmtDur(remLarg)}</Text>
          {!running && remLarg > 180 && <Text style={st.tipTx}>O GPS liga sozinho 3 min antes.</Text>}
        </View>
      )}
      <View style={st.row}>
        {minhasAbas.map((t) => (
          <TouchableOpacity key={t} style={[st.tab, tab === t && st.tabOn]} onPress={() => setTab(t)}>
            <Text style={[st.tabTx, tab === t && { color: '#0c1014' }]}>{{ provas: 'Provas', gravar: 'Gravar', ranking: 'Ranking', tulipas: 'Iniciar', organizar: 'Organizar' }[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'provas' ? (
        <Fluxo st={st} user={user} piloto={piloto} provaMap={provaMap} lib={libOk} minhaLarg={minhaLarg} largManual={largManual} setLargManual={setLargManual} pointsN={points.length} dlStat={loadJson('dlstat', {})} dlTick={dlTick}
          onEnviarDl={onDatalogger} enviandoDl={enviandoDl} onEscolher={escolher} onPlanilha={onPlanilha} onSoDl={onSoDl} onPiloto={() => setPilotoOpen(true)} onPersonalizar={() => setCfgOpen(true)}
          onAdmin={(x) => { setPapel('organizador'); setP('prova')(x.code); setAbrirReq({ code: x.code, n: Date.now() }); }} />
      ) : tab === 'organizar' ? (
        <Organizador st={st} onTab={setTab} onProva={setP('prova')} prova={piloto.prova} provaMap={provaMap} last={last} onOrg={setOrgInfo} abrirReq={abrirReq} />
      ) : tab === 'tulipas' ? (
        <View style={st.card}>
          <Text style={st.tip}>Prova {piloto.prova.trim() || '—'}</Text>
          <TouchableOpacity style={[st.btn, { backgroundColor: '#2e7d32', marginTop: 6 }]} onPress={() => { if (!libOk) return Alert.alert('Planilha não liberada', 'Aguarde a liberação do organizador.'); setNavOpen(true); }}><Text style={[st.btnTx, { color: '#fff' }]}>INICIAR (tela do navegador)</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => setCfgOpen(true)}><Text style={st.btn2Tx}>Personalizar a tela (faça antes da prova)</Text></TouchableOpacity>
          <Text style={[st.tip, { marginTop: 12 }]}>Roadbook</Text>
          {!libOk ? (
            <Text style={[st.tipTx, { color: '#ffb300' }]}>Planilha ainda não liberada pelo organizador{provaMap.lib?.ini ? ` (libera em ${provaMap.lib.ini})` : ''}.</Text>
          ) : provaMap.tul.length === 0 ? (
            <Text style={st.tipTx}>O organizador ainda não publicou o roadbook desta prova.</Text>
          ) : (
            <Text style={st.tipTx}>Esquerda: parcial e total (km). A tulipa mostra o cruzamento: você chega pela rua de baixo e segue a seta. A entrada destacada é a próxima.</Text>
          )}
          {libOk && <Roadbook st={st} tul={provaMap.tul} org={souOrg} classe={piloto.classe} grupos={grupos} dist={rs || stage.idx >= 0 ? globalDist : 0} />}
          {libOk && provaMap.tul.length > 0 && (
            <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={() => compartilharPdf(piloto.prova.trim().toUpperCase(), provaMap.tul, souOrg).catch((e) => Alert.alert('Não gerou o PDF', String(e?.message || e)))}>
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
      ) : null}
      {soDl && <DlTela st={st} last={last} pointsN={points.length} startedAt={startedAt} onFinalizar={finalizarDl} />}
      {navOpen && (
        <NavTela cfg={loadNav()} stage={stage} rs={rs} last={last} globalDist={rs || stage.idx >= 0 ? globalDist : 0}
          odoM={odoAtual() - odoBase} tul={tulVis} rot={rot} trs={provaMap.trs} fim={fimProva} classe={piloto.classe} grupos={grupos}
          aviso={fimProva ? 'FIM DA PROVA' : remLarg != null && remLarg > 0 ? `Largada em ${fmtDur(remLarg)}` : neutroRest != null ? `NEUTRO · PARE · ${fmtDur(neutroRest)}` : stage.idx >= 0 && rs && remain != null && remain <= 0 ? 'CHEGOU — toque em PC' : null}
          onAdj={adjAll} onPc={onPc} onIniciarAgora={onStage} onEncerrar={encerrarProva} onZerar={() => setOdoBase(odoAtual())} onClose={() => setNavOpen(false)} />
      )}
      <NavConfig st={st} visible={cfgOpen} onClose={() => setCfgOpen(false)} />
      {pilotoOpen && <PilotoTela cfg={loadNav()} tul={tulVis} classe={piloto.classe} grupos={grupos} onPersonalizar={() => setCfgPiloto(true)} onClose={() => setPilotoOpen(false)} />}
      <NavConfig st={st} piloto visible={cfgPiloto} onClose={() => setCfgPiloto(false)} />
    </ScrollView>
    </KeyboardAvoidingView>
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
