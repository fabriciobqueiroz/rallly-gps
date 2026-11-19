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
import { enviarResultado, ouvirRanking } from './src/firebase';
import { begin, clear, getState, subscribe, summarize, toCsv } from './src/store';
import { cumulative, newStage, startStage, status, markPc, parseRoteiro, pontos, rank, fmtDur, fmtSigned, pcsToText } from './src/rally';

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
  const [piloto, setPiloto] = useState(() => loadJson('piloto', { nome: '', numero: '', prova: '' }));
  const [hist, setHist] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [rankErr, setRankErr] = useState('');
  const [enviando, setEnviando] = useState(false);
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
  const rot = parseRoteiro(rotTxt);
  const goTrecho = (base, i, keepPcs) => {
    const t = rot.trechos[i];
    setKmhTxt(String(t.kmh));
    warned.current = { idx: i, w100: false, w0: false };
    return startStage(base, points, cum, factor, { keepPcs, targetKmh: t.kmh, km: t.km, idx: i });
  };
  const onStage = () => {
    if (!points.length) return needPoints();
    setHist([]);
    setStage(rot.trechos.length ? goTrecho(stage, 0, false) : startStage(stage, points, cum, factor));
  };
  const onPc = () => {
    if (!rs) return Alert.alert('Inicie o trecho', 'Toque em "Zerar / iniciar trecho" antes.');
    const marked = markPc(stage, points, cum, factor);
    setHist((h) => [...h, stage]);
    if (stage.idx >= 0 && stage.idx + 1 < rot.trechos.length) setStage(goTrecho(marked, stage.idx + 1, true));
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
    if (tab !== 'ranking' || !piloto.prova.trim()) return;
    setRankErr('');
    return ouvirRanking(piloto.prova, (rows) => setRanking(rank(rows)), (e) => setRankErr(String(e?.message || e)));
  }, [tab, piloto.prova]);
  const onRot = (txt) => { setRotTxt(txt); saveRoteiro(txt); };
  const onKmh = (txt) => {
    setKmhTxt(txt);
    const v = parseFloat(txt.replace(',', '.'));
    setStage((x) => ({ ...x, targetKmh: v > 0 ? v : 0 }));
  };
  const adj = (m) => setStage((x) => ({ ...x, adjust: x.adjust + m }));
  const ahead = rs && rs.aheadSec != null ? rs.aheadSec : null;
  const remain = rs ? rs.remain : null;
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
      <View style={st.row}>
        {['gravar', 'ranking'].map((t) => (
          <TouchableOpacity key={t} style={[st.tab, tab === t && st.tabOn]} onPress={() => setTab(t)}>
            <Text style={[st.tabTx, tab === t && { color: '#0c1014' }]}>{t === 'gravar' ? 'Gravar' : 'Ranking'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'ranking' ? (
        <View>
          <View style={st.card}>
            <Text style={st.tip}>Prova: {piloto.prova.trim() || '—'}</Text>
            {!piloto.prova.trim() && <Text style={st.tipTx}>Preencha o código da prova na aba Gravar.</Text>}
            {rankErr ? <Text style={[st.tipTx, { color: '#ff5252' }]}>{rankErr}</Text> : null}
            {ranking.length === 0 && piloto.prova.trim() && !rankErr ? <Text style={st.tipTx}>Nenhum resultado enviado ainda.</Text> : null}
            {ranking.map((r, i) => (
              <View key={r.numero} style={st.line}>
                <Text style={st.k}>{i + 1}º  #{r.numero} {r.nome} · {r.npcs} PC</Text>
                <Text style={st.v}>{Number(r.pontos).toFixed(1)} pts</Text>
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
        <TextInput style={st.field} value={piloto.prova} onChangeText={setP('prova')} placeholder="Código da prova (ex: TESTE1)" placeholderTextColor="#666" autoCapitalize="characters" />
        <TouchableOpacity style={[st.btn, { backgroundColor: '#1565c0', marginTop: 8, marginBottom: 0 }]} onPress={onEnviar} disabled={enviando}>
          <Text style={[st.btnTx, { color: '#fff' }]}>{enviando ? 'Enviando…' : 'Enviar resultado'}</Text>
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
  tab: { flex: 1, borderWidth: 1, borderColor: '#ff7a2e', borderRadius: 12, padding: 10, alignItems: 'center' },
  tabOn: { backgroundColor: '#ff7a2e' },
  tabTx: { color: '#ff7a2e', fontWeight: '800' },
  field: { color: '#f5f5f5', borderWidth: 1, borderColor: '#262b32', borderRadius: 8, padding: 10, marginTop: 8 },
  tip: { color: '#f5f5f5', fontWeight: '800', marginBottom: 6 },
  tipTx: { color: '#a8a8a8', lineHeight: 22 },
});
