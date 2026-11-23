import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View,
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
import { enviarResultado, ouvirRanking, salvarProva, ouvirProva, ouvirInscricao, ouvirMinhaLargada, enviarDatalogger, ouvirAuth, sairConta, lerPerfil, enviarAoVivo, limparAoVivo, ehMaster, ouvirMasters } from './src/firebase';
import UsuariosTela from './src/Usuarios';
import Login from './src/Login';
import { st } from './src/estilos';
import Fluxo, { DlTela, EventosAbertos, InfoProva } from './src/Fluxo';
import { planilhaLiberada, parseHMS, CATS_PADRAO } from './src/OrgExtras';
import PerfilTela from './src/Perfil';
import { NavTela, NavConfig, PilotoTela, loadNav } from './src/Nav';
import { compartilharPdf } from './src/pdf';
import Erro from './src/Erro';
import { TrilhasComp, TrilhasOrg } from './src/Trilhas';
import { begin, clear, getState, subscribe, summarize, toCsv, haversine } from './src/store';
import { gruposDe, cumulative, newStage, startStage, status, markPc, parseRoteiro, resolverTrecho, pontos, rank, fmtDur, fmtSigned, pcsToText, zeroOff } from './src/rally';

const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

const aoVivoActivePrev = (ant, nova) => !!ant && ant !== nova;
export default function App() {
  const [, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [keepOn, setKeepOn] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [stage, setStage] = useState(newStage());
  const [factor, setFactorRaw] = useState(() => { const f = Number(loadJson('wfactor', 1)); return f > 0.5 && f < 1.5 ? f : 1; });
  const setFactor = (f) => { setFactorRaw(f); saveJson('wfactor', f); };
  const [aferUndo, setAferUndo] = useState(null);
  const [posOff, setPosOff] = useState(0); // posição fixada pelo "estou aqui" quando o trecho ainda não começou (m)
  const [kmhTxt, setKmhTxt] = useState('');
  const [rotTxt, setRotTxt] = useState(() => loadRoteiro());
  const [largManual, setLargManualRaw] = useState('');
  const [dlTick, setDlTick] = useState(0);
  const [soDl, setSoDl] = useState(false);
  const [pilotoOpen, setPilotoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [provaVer, setProvaVer] = useState(0); // muda quando uma prova é aberta/criada/apagada: recarrega do zero, mesmo com o mesmo código
  const forcaZero = useRef(false);
  const [mastersX, setMastersX] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [cfgPiloto, setCfgPiloto] = useState(false);
  const [abrirReq, setAbrirReq] = useState(null);
  const [listaReq, setListaReq] = useState(0); // menu "Organizar prova": volta para a lista de provas
  const [erroProva, setErroProva] = useState('');
  const [tab, setTab] = useState(() => (loadJson('papel', 'competidor') === 'organizador' ? 'organizar' : 'provas'));
  const [user, setUser] = useState(undefined); // undefined = carregando, null = sem login
  useEffect(() => { if (!user) return; return ouvirMasters(setMastersX, () => {}); }, [user && user.uid]);
  const [papel, setPapelRaw] = useState(() => loadJson('papel', 'competidor'));
  const [papeis, setPapeis] = useState({});
  const setPapel = (p) => { setPapelRaw(p); saveJson('papel', p); setTab(p === 'organizador' ? 'organizar' : 'provas'); };
  const [navOpen, setNavOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [odoBase, setOdoBase] = useState(0);
  const [odoAdj, setOdoAdj] = useState(0);
  const [aferBase, setAferBase] = useState(null); // {cum, km}: ponto da última aferição (cum = GPS bruto em m, km = posição oficial em km)
  const odoAtual = () => { const v = (points.length ? cum[points.length - 1] * factor : 0) + odoAdj; return Number.isFinite(v) ? v : 0; };
  const [piloto, setPiloto] = useState(() => ({ nome: '', numero: '', prova: '', navegador: '', email: '', classe: 'GRADUADO', ...loadJson('piloto', {}) }));
  const [hist, setHist] = useState([]);
  const [provaMap, setProvaMap] = useState({ wps: [], coords: [], legs: [], kmh: [], tul: [], trechos: [], trs: [], categorias: [], lib: {}, refs: [], pcl: [], lev: null });
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
  const autoPc = useRef(() => {});
  autoPc.current = () => { if (rs && stage.idx >= 0 && stage.active) onPc(); };
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
    setProvaMap({ wps: [], coords: [], legs: [], kmh: [], tul: [], trechos: [], trs: [], categorias: [], lib: {}, refs: [], pcl: [], lev: null });
    if (forcaZero.current) { forcaZero.current = false; setRotTxt(''); saveRoteiro(''); setLargadaTxt(''); }
    if (!piloto.prova.trim()) return;
    const slugP = piloto.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
    setLargManualRaw(loadJson('largm', {})[slugP] || '');
    const cache = loadJson('prova_' + slugP, null);
    // Ao trocar de prova, começa vazio: nada da prova anterior pode aparecer na nova.
    setProvaMap({ wps: [], coords: [], legs: [], kmh: [], tul: [], trechos: [], trs: [], categorias: [], lib: {}, refs: [], pcl: [], lev: null });
    const aplica = (d, nuvem) => {
      if (nuvem) saveJson('prova_' + slugP, d);
      if (nuvem && Date.now() - lastEdit.current < 2500) return; // não sobrescreve o que você está digitando
      if (typeof d.roteiro === 'string' && d.roteiro !== rotRef.current) { setRotTxt(d.roteiro); saveRoteiro(d.roteiro); }
      if (typeof d.largada === 'string') setLargadaTxt(d.largada);
      {
        const pair = (a) => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
        setProvaMap({ code: slugP, wps: pair(d.wps || []), coords: pair(d.rota || []), legs: d.legs || [], kmh: d.kmh || [], tul: d.tul || [], trechos: d.trechos || [], trs: d.trs || [], categorias: d.categorias || [], lib: d.lib || {}, refs: d.refs || [], pcl: d.pcl || [], lev: d.lev || null, nome: d.nome || '', pub: d.publicadoEm || 1 });
      }
      if (d.intervalo != null) setIntervalo(String(d.intervalo));
    };
    if (cache) aplica(cache, false);
    setErroProva('');
    return ouvirProva(piloto.prova, (d) => { setErroProva(''); aplica(d, true); }, (e) => setErroProva(String(e?.message || e)));
  }, [piloto.prova, provaVer]);
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
    setStage(newStage()); setHist([]); setPosOff(0); setNavOpen(false);
    Alert.alert('Prova encerrada', 'Agora envie o datalogger na tela da prova (Sincronizar agora).');
  };
  const adjAll = (m) => { adj(m); setOdoAdj((a) => a + m); };
  const refPerto = (() => {
    if (!last || !provaMap.refs.length) return null;
    let b = null;
    for (const r of provaMap.refs) { const d = haversine(last, r); if (!b || d < b.d) b = { r, d }; }
    return b && b.d <= 80 ? b : null;
  })();
  useEffect(() => {
    if (stage.active && !aferBase && points.length) { setAferBase({ cum: cum[points.length - 1], km: 0 }); setOdoBase(odoAtual()); }
    if (!stage.active && aferBase) setAferBase(null);
  }, [stage.active]);
  // "Estou aqui": o competidor confirma a referência do roadbook; posição e hodômetro passam a valer o km dela.
  const estouAqui = (d) => {
    if (!points.length || !Number.isFinite(d)) return;
    const cumNow = cum[points.length - 1];
    if (rs) setStage((x) => ({ ...x, adjust: x.adjust + (d - globalDist) }));
    setOdoAdj(d + odoBase - cumNow * factor);
  };
  const desfazerAfer = () => {
    if (!aferUndo) return;
    setFactor(aferUndo.factor); setOdoBase(aferUndo.odoBase); setOdoAdj(aferUndo.odoAdj);
    setStage((x) => ({ ...x, adjust: aferUndo.adjust })); setAferBase(aferUndo.aferBase); setAferUndo(null);
    Alert.alert('Aferição desfeita', `W% voltou para ${(aferUndo.factor * 1000).toFixed(2)}.`);
  };
  // Ajuste manual do W% (delta em unidades de W%, ex.: 0,1). Mantém o hodômetro e o trecho sem salto.
  const ajustarW = (dw) => {
    const f = factor + dw / 1000;
    if (f < 0.9 || f > 1.1) return;
    const cn = points.length ? cum[points.length - 1] : 0, df = f - factor;
    setFactor(f); setOdoBase((b) => b + cn * df); setStage((x) => ({ ...x, adjust: x.adjust - cn * df }));
  };
  const aferRef = (() => {
    if (!last || !provaMap.refs.length || !stage.active || stage.idx < 0) return null;
    let b = null;
    for (const r of provaMap.refs) { if (!r.afer) continue; const d = haversine(last, r); if (!b || d < b.d) b = { r, d }; }
    if (!b || b.d > 80) return null;
    const km = Number(b.r.km) || 0;
    return { n: b.r.n, km, kmShow: (km * 1000 - zeroOff(provaMap.trs, km * 1000)) / 1000 };
  })();
  const onAfer = () => {
    if (!aferRef || !points.length) return;
    const cumNow = cum[points.length - 1];
    const base = aferBase || { cum: 0, km: 0 };
    const raw = cumNow - base.cum, verd = (aferRef.km - base.km) * 1000;
    if (!(raw > 200) || !(verd > 200)) { Alert.alert('Aferição', 'Distância percorrida muito curta para aferir (mínimo 200 m desde a largada/última aferição).'); return; }
    const f = verd / raw;
    if (f < 0.9 || f > 1.1) { Alert.alert('Aferição recusada', `Fator ${f.toFixed(4)} fora do normal (0,90–1,10). Confira se está na referência certa.`); return; }
    const pos = aferRef.km * 1000;
    setAferUndo({ factor, odoBase, odoAdj, adjust: stage.adjust, aferBase });
    setStage((x) => ({ ...x, adjust: (pos - feitos) - cumNow * f + x.d0 }));
    setOdoBase(cumNow * f - (pos - zeroOff(provaMap.trs, pos)));
    setOdoAdj(0);
    setFactor(f);
    setAferBase({ cum: cumNow, km: aferRef.km });
    Alert.alert('Aferição feita', `W% = ${(f * 1000).toFixed(2)}. Hodômetro ajustado para o km ${(aferRef.kmShow).toFixed(3)}.`);
  };
  const ahead = rs && rs.aheadSec != null ? rs.aheadSec : null;
  // Posição no percurso: distância planejada dos trechos já feitos + parcial do trecho atual.
  const feitos = stage.idx > 0 ? rot.trechos.slice(0, stage.idx).reduce((a, t) => a + t.km * 1000, 0) : 0;
  const globalDist = feitos + (rs ? rs.dist : 0) + posOff;
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
    if (!w.w0 && remain <= 0) { w.w0 = true; autoPc.current(); } // PC escondido: registra em silêncio
  }, [remain, stage.idx]);

  // Ao vivo: a cada ~8 s manda só a posição atual (prova em andamento ou trilha gravando). É informativo; o datalogger completo segue gravado no celular.
  const aoVivoRef = useRef({});
  aoVivoRef.current = { user, piloto, last, kJan };
  const aoVivoAtivo = useRef(null);
  useEffect(() => {
    const tick = () => {
      const { user: u, piloto: pl, last: l, kJan: kj } = aoVivoRef.current;
      if (!u) return;
      let alvo = null;
      try {
        const rec = loadJson('trl_rec', null);
        if (rec && rec.id && !rec.fim) alvo = { kind: 'trilha', id: rec.id, numero: '' };
        else if (pl.prova.trim() && pl.numero.trim()) {
          const j = loadJson(kj(), {});
          if (j.ini != null && j.fim == null) alvo = { kind: 'prova', id: pl.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ''), numero: pl.numero.trim() };
        }
      } catch {}
      const chave = alvo ? alvo.kind + '_' + alvo.id : null;
      if (aoVivoActivePrev(aoVivoAtivo.current, chave)) { const [k0, ...r0] = aoVivoAtivo.current.split('_'); limparAoVivo(k0, r0.join('_')).catch(() => {}); }
      aoVivoAtivo.current = chave;
      if (!alvo || !l || Date.now() - l.t > 20000) return;
      enviarAoVivo({ ...alvo, nome: pl.nome || u.email, lat: l.lat, lon: l.lon, t: l.t, spd: l.spd, acc: l.acc }).catch(() => {});
    };
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (navOpen) setInfoOpen(true); }, [navOpen]);
  if (user === undefined) return <View style={[st.root, { justifyContent: 'center' }]}><Text style={[st.sub, { textAlign: 'center' }]}>Carregando…</Text></View>;
  if (!user) return (
    <ScrollView style={st.root} contentContainerStyle={st.wrap}>
      <StatusBar style="light" />
      <Text style={st.h1}>Rally GPS</Text>
      <Login st={st} onEntrou={(p) => setPapel(p)} />
    </ScrollView>
  );
  const infoProva = (() => {
    const tr = rot.trechos || [];
    const totalSec = tr.reduce((a, t) => a + (t.tipo === 'D' ? (Number(t.min) || 0) * 60 : t.kmh > 0 ? (t.km / t.kmh) * 3600 : 0) + (t.nt || 0), 0);
    const km = tr.reduce((a, t) => a + (Number(t.km) || 0), 0);
    return {
      nome: provaMap.nome || (piloto.prova ? 'Prova ' + piloto.prova.trim().toUpperCase() : ''), pub: provaMap.pub, refs: tulComp(provaMap.tul).filter((e) => e.t === 'T' || e.nt > 0).length,
      trechos: provaMap.trs.length || tr.length, classe: piloto.classe, numero: piloto.numero, totalSec: Math.round(totalSec), km, largSec: parseHMS(minhaLarg || largManual),
    };
  })();
  const minhasAbas = papel === 'organizador' ? ['provas', 'organizar', 'ranking', 'trilhas', 'abertos'] : ['provas', 'tulipas', 'ranking', 'abertos'];
  const setLargManual = (v) => { setLargManualRaw(v); const k = piloto.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ''); saveJson('largm', { ...loadJson('largm', {}), [k]: v }); };
  // Os pontos de GPS ficam intactos (o levantamento do organizador usa o mesmo rastro). A prova só conta a partir da largada
  // (janela do datalogger) e o hodômetro é zerado aqui, então nada se mistura e nada é apagado.
  const prepararInicio = (cont) => {
    if (!stage.active) { setOdoBase(odoAtual()); setOdoAdj(0); setAferBase(null); setAferUndo(null); }
    cont();
  };
  const zerarDatalogger = () => Alert.alert('Zerar datalogger', 'Apaga todos os pontos de GPS gravados neste celular (inclusive o rastro de um levantamento, se for o mesmo aparelho do organizador) e zera o hodômetro. O W% é mantido. Se a prova está em andamento, não faça isso. Confirma?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Zerar', style: 'destructive', onPress: () => { clear(); if (running) begin(); saveJson(kJan(), {}); setOdoBase(0); setOdoAdj(0); setAferBase(null); setAferUndo(null); setPosOff(0); } },
  ]);
  const janN = (() => { const j = loadJson(kJan(), {}); return j.ini == null ? 0 : points.filter((p) => p.t >= j.ini && (j.fim == null || p.t <= j.fim)).length; })();
  const pendEnv = (() => { const k = piloto.prova.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '') + '_' + String(piloto.numero).trim(); return loadJson('dlstat', {})[k] ? 0 : janN; })();
  const onPlanilha = () => {
    if (!libOk) return Alert.alert('Planilha não liberada', 'Aguarde a liberação do organizador. Você pode usar "Apenas datalogger".');
    prepararInicio(() => { if (!running) start(); setNavOpen(true); });
  };
  const onSoDl = () => prepararInicio(() => { if (!running) start(); setSoDl(true); });
  const finalizarDl = async () => { await stop(); await onDatalogger(); setSoDl(false); };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
    <ScrollView style={st.root} contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <TouchableOpacity onPress={() => setTab(papel === 'organizador' ? 'organizar' : 'provas')}><Text style={{ color: '#ff7a2e', fontSize: 26, fontWeight: '900' }}>Rally GPS</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 14, right: 10 }} accessibilityLabel="Menu"><Text style={{ color: '#f5f5f5', fontSize: 30, fontWeight: '900', paddingHorizontal: 6 }}>⋮</Text></TouchableOpacity>
      </View>
      <Text style={[st.sub, { marginBottom: 8 }]}>Olá, {(piloto.nome || user.email.split('@')[0]).split(' ')[0]} · {papel === 'organizador' ? 'Organizador' : `Competidor · ${running ? '● Gravando' : pendEnv > 0 ? `○ ${pendEnv} pontos não enviados` : '○ Parado'}`}{Platform.OS === 'android' ? '' : ' (somente Android)'}</Text>

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
      {tab !== 'provas' && tab !== 'organizar' && (
      <View style={st.row}>
        <TouchableOpacity style={st.tab} onPress={() => setTab(papel === 'organizador' ? 'organizar' : 'provas')}><Text style={st.tabTx}>‹ Início</Text></TouchableOpacity>
        {minhasAbas.filter((t) => t !== 'provas' && t !== 'organizar').map((t) => (
          <TouchableOpacity key={t} style={[st.tab, tab === t && st.tabOn]} onPress={() => setTab(t)}>
            <Text style={[st.tabTx, tab === t && { color: '#0c1014' }]}>{{ provas: 'Provas', gravar: 'Gravar', ranking: 'Ranking', tulipas: 'Iniciar', organizar: 'Organizar', trilhas: 'Org. trilha', abertos: 'Abertos' }[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      )}
      {tab === 'organizar' && (
      <View style={st.row}>
        <TouchableOpacity style={st.tab} onPress={() => setTab('provas')}><Text style={st.tabTx}>Meus eventos</Text></TouchableOpacity>
      </View>
      )}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setMenuOpen(false)}>
          <View style={{ position: 'absolute', top: 54, right: 12, width: 230, backgroundColor: '#1b212a', borderWidth: 1, borderColor: '#262b32', borderRadius: 12, paddingVertical: 6 }}>
            {[
              ...(papel === 'organizador' ? [['Organizar prova', () => { setListaReq((n) => n + 1); setTab('organizar'); }], ['Organizar trilha', () => setTab('trilhas')]] : []),
              ['Meus eventos', () => setTab('provas')],
              ['Eventos abertos', () => setTab('abertos')],
              ...(ehMaster(user.email, mastersX) ? [['Usuários (master)', () => setTab('usuarios')]] : []),
              ['Ranking', () => setTab('ranking')],
              ['Perfil', () => setPerfilOpen(true)],
              ...(papeis.organizador && papeis.competidor ? [[papel === 'organizador' ? 'Modo competidor' : 'Modo organizador', () => setPapel(papel === 'organizador' ? 'competidor' : 'organizador')]] : []),
              ['Sair', () => Alert.alert('Sair da conta?', user.email, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', onPress: () => { sairConta().catch(() => {}); } }]), '#ff5252'],
            ].map(([t, f, cor]) => (
              <TouchableOpacity key={t} onPress={() => { setMenuOpen(false); setTimeout(f, 50); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                <Text style={{ color: cor || '#f5f5f5', fontSize: 16, fontWeight: '700' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      {tab === 'provas' ? (
        <Fluxo st={st} user={user} piloto={piloto} provaMap={provaMap} lib={libOk} minhaLarg={minhaLarg} largManual={largManual} setLargManual={setLargManual} pointsN={janN} dlStat={loadJson('dlstat', {})} dlTick={dlTick}
          onEnviarDl={onDatalogger} enviandoDl={enviandoDl} onEscolher={escolher} onPlanilha={onPlanilha} onSoDl={onSoDl} onPiloto={() => setPilotoOpen(true)} onZerarDl={zerarDatalogger} onPersonalizar={() => setCfgOpen(true)}
          extra={<TrilhasComp st={st} modo="minhas" gps={{ nome: piloto.nome || user.email, uid: user.uid, running, start, getPoints: () => getState().points }} />}
          onAdmin={(x) => { setPapel('organizador'); setP('prova')(x.code); setAbrirReq({ code: x.code, n: Date.now() }); }} />
      ) : tab === 'organizar' ? (
        <Organizador st={st} listaReq={listaReq} erroProva={erroProva} onTab={setTab} onProva={(c, force) => { if (force) { forcaZero.current = true; setProvaVer((v) => v + 1); } setP('prova')(c); }} prova={piloto.prova} provaMap={provaMap} last={last} onOrg={setOrgInfo} abrirReq={abrirReq} />
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
      ) : tab === 'usuarios' && ehMaster(user.email, mastersX) ? (
        <UsuariosTela st={st} email={user.email} masters={mastersX} />
      ) : tab === 'abertos' ? (
        <EventosAbertos st={st} user={user} extra={<TrilhasComp st={st} modo="abertas" gps={{ nome: piloto.nome || user.email, uid: user.uid, running, start, getPoints: () => getState().points }} />} />
      ) : tab === 'trilhas' ? (
        <TrilhasOrg st={st} />
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
      {soDl && <DlTela st={st} last={last} pointsN={points.length} startedAt={startedAt} onFinalizar={finalizarDl} info={infoProva} />}
      {navOpen && (
        <Erro onClose={() => setNavOpen(false)}><NavTela cfg={loadNav()} stage={stage} rs={rs} last={last} globalDist={rs || stage.idx >= 0 ? globalDist : Math.max(0, odoAtual() - odoBase)}
          odoM={odoAtual() - odoBase} tul={tulVis} rot={rot} trs={provaMap.trs} fim={fimProva} cont={remLarg} classe={piloto.classe} grupos={grupos}
          aviso={fimProva ? 'FIM DA PROVA' : remLarg != null && remLarg > 0 ? `Largada em ${fmtDur(remLarg)}` : neutroRest != null ? `NEUTRO · PARE · ${fmtDur(neutroRest)}` : null}
          onAdj={adjAll} onIniciarAgora={onStage} onEncerrar={encerrarProva} onZerar={() => setOdoBase(odoAtual())} factor={factor} aferRef={aferRef} onAfer={onAfer} podeDesfazer={!!aferUndo} onDesfazer={desfazerAfer} onW={ajustarW} onEstouAqui={estouAqui} onClose={() => setNavOpen(false)} /></Erro>
      )}
      {navOpen && <InfoProva visible={infoOpen} info={infoProva} onOk={() => setInfoOpen(false)} />}
      <NavConfig st={st} visible={cfgOpen} onClose={() => setCfgOpen(false)} />
      {perfilOpen && <PerfilTela st={st} user={user} papel={papel} onClose={() => setPerfilOpen(false)} onSalvo={(d) => { if (d.nome && !piloto.nome) setPiloto((o) => ({ ...o, nome: d.nome })); }} />}
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


