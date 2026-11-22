// Trilhas: passeios off road de lazer. Organizador cria e aprova pedidos; competidor pede vaga, confirma presença e grava o percurso.
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Share, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapaWeb from './MapaWeb';
import { calcularRota } from './osrm';
import { escolherDT, fmtBR, parseDT } from './OrgExtras';
import { loadJson, saveJson } from './persist';
import { haversine } from './store';
import PainelAoVivo from './AoVivo';
import {
  apagarTrilha, atualizarInscTrilha, enviarTrackTrilha, idTrilha, ouvirInscTrilha, ouvirMeusTracksTrilha, ouvirMinhasInscTrilhas,
  ouvirMinhasTrilhasOrg, ouvirTracksPublicosTrilha, ouvirTrilhasAbertas, pedirVagaTrilha, publicarTrackTrilha, removerInscTrilha, salvarTrilha,
} from './firebase';

const NIVEIS = ['Fácil', 'Média', 'Difícil'];
const pair = (a) => { const o = []; for (let i = 0; i + 1 < (a || []).length; i += 2) o.push([a[i], a[i + 1]]); return o; };
const flat = (c) => c.flatMap((p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
const trackCoords = (t) => (t && t.la ? t.la.map((v, i) => [v / 1e5, t.lo[i] / 1e5]) : []);
const kmDe = (pts) => { let d = 0; for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]); return d / 1000; };
const chipS = (st, on) => [st.chip, { paddingHorizontal: 12, paddingVertical: 8 }, on && { backgroundColor: '#ff7a2e' }];
const ST = {
  pedido: ['Pedido enviado', '#ffb300'], aprovado: ['Aprovado', '#4fc3f7'], confirmado: ['Confirmado ✓', '#4caf50'], recusado: ['Não aprovado', '#ff5252'], cancelado: ['Cancelado', '#888'],
};

function Etiqueta({ st, k }) {
  const [t, c] = ST[k] || ['', '#888'];
  return t ? <Text style={{ color: c, fontWeight: '800', fontSize: 13 }}>{t}</Text> : null;
}

// ---------- Organizador: formulário ----------
function FormTrilha({ st, ini, onFim }) {
  const [f, setF] = useState(() => ({ nome: '', quando: '', cidade: '', nivel: 'Média', vagas: '20', obs: '', aberta: false, encontro: null, rota: [], km: 0, ...ini }));
  const [pts, setPts] = useState(() => (ini && ini.pts && ini.pts.length ? pair(ini.pts) : ini && ini.encontro ? [[ini.encontro.lat, ini.encontro.lon]] : []));
  const [busy, setBusy] = useState('');
  const req = useRef(0);
  const set = (p) => setF((o) => ({ ...o, ...p }));
  const coords = pair(f.rota);
  // pts[0] = encontro, pts[1] = largada, demais = chegadas; o traçado segue as ruas do mapa, da largada até a última chegada
  const refaz = async (arr) => {
    const n = ++req.current;
    if (arr.length < 3) { set({ rota: [], km: 0 }); setBusy(''); return; }
    setBusy('Traçando o percurso pelas ruas…');
    try {
      const r = await calcularRota(arr.slice(1));
      if (n !== req.current) return;
      set({ rota: flat(r.coords), km: Math.round(r.legs.reduce((a, b) => a + b, 0) * 10) / 10 });
      setBusy('');
    } catch (e) { if (n === req.current) setBusy('Sem internet para traçar. Toque em "Refazer traçado".'); }
  };
  const aplica = (arr) => {
    setPts(arr);
    const q = (x) => Math.round(x * 1e6) / 1e6;
    set({ encontro: arr[0] ? { lat: q(arr[0][0]), lon: q(arr[0][1]) } : null, pts: flat(arr) });
    refaz(arr);
  };
  const onTap = (la, lo) => aplica([...pts, [la, lo]]);
  const marks = pts.map((p, i) => ({ lat: p[0], lon: p[1], txt: i === 0 ? 'Encontro' : i === 1 ? 'Largada' : `Chegada ${i - 1}`, cls: i === 0 ? 'l' : i === 1 ? 'c' : 's' }));
  const dica = pts.length === 0 ? 'Toque no mapa: 1º toque = ponto de ENCONTRO.' : pts.length === 1 ? 'Agora toque a LARGADA.' : 'Cada novo toque marca uma CHEGADA e o traçado segue as ruas até ele.';
  const salvar = async (aberta) => {
    if (!f.nome.trim()) return Alert.alert('Falta o nome', 'Dê um nome para a trilha.');
    if (aberta && (!f.quando || !f.encontro)) return Alert.alert('Falta informação', 'Para publicar, escolha a data e hora e marque o ponto de encontro no mapa.');
    const id = f.id || idTrilha();
    try {
      await salvarTrilha(id, {
        nome: f.nome.trim(), quando: f.quando || '', quandoTs: parseDT(f.quando), cidade: f.cidade || '', nivel: f.nivel, vagas: parseInt(f.vagas, 10) || 0, obs: f.obs || '',
        encontro: f.encontro || null, pts: f.pts || [], rota: f.rota || [], km: f.km || 0, aberta: !!aberta,
      });
      Alert.alert(aberta ? 'Trilha publicada' : 'Rascunho salvo', aberta ? 'Ela já aparece para os competidores.' : 'Só você vê. Publique quando estiver pronta.');
      onFim();
    } catch (e) { Alert.alert('Não salvou', String(e?.message || e)); }
  };
  return (
    <View>
      <View style={st.card}>
        <Text style={st.tip}>{f.id ? 'Editar trilha' : 'Nova trilha'}</Text>
        <TextInput style={st.field} value={f.nome} onChangeText={(v) => set({ nome: v })} placeholder="Nome da trilha" placeholderTextColor="#666" />
        <TouchableOpacity style={[st.field, { justifyContent: 'center' }]} onPress={() => escolherDT(f.quando, (v) => set({ quando: v }))}><Text style={st.v}>{f.quando ? fmtBR(f.quando) : 'Data e hora da saída (toque para escolher)'}</Text></TouchableOpacity>
        <TextInput style={st.field} value={f.cidade} onChangeText={(v) => set({ cidade: v })} placeholder="Cidade / região" placeholderTextColor="#666" />
        <Text style={[st.tipTx, { marginTop: 8 }]}>Nível</Text>
        <View style={[st.row, { marginTop: 4 }]}>{NIVEIS.map((n) => <TouchableOpacity key={n} style={chipS(st, f.nivel === n)} onPress={() => set({ nivel: n })}><Text style={[st.btn2Tx, f.nivel === n && { color: '#0c1014' }]}>{n}</Text></TouchableOpacity>)}</View>
        <View style={st.line}><Text style={st.k}>Vagas</Text><TextInput style={st.input} value={String(f.vagas)} onChangeText={(v) => set({ vagas: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" /></View>
        <TextInput style={[st.field, { minHeight: 70 }]} value={f.obs} onChangeText={(v) => set({ obs: v })} placeholder="Observações (o que levar, regras do grupo…)" placeholderTextColor="#666" multiline />
      </View>
      <View style={st.card}>
        <Text style={st.tip}>Mapa</Text>
        <Text style={st.tipTx}>{dica}</Text>
        <MapaWeb wps={[]} coords={coords} marks={marks} editable onTap={onTap} height={Platform.OS === 'web' ? 420 : 300} />
        <View style={st.row}>
          <TouchableOpacity style={st.btn2} onPress={() => aplica(pts.slice(0, -1))}><Text style={st.btn2Tx}>Desfazer último ponto</Text></TouchableOpacity>
          {pts.length >= 3 && <TouchableOpacity style={st.btn2} onPress={() => refaz(pts)}><Text style={st.btn2Tx}>Refazer traçado</Text></TouchableOpacity>}
          {pts.length > 0 && <TouchableOpacity style={st.btn2} onPress={() => aplica([])}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar tudo</Text></TouchableOpacity>}
        </View>
        {busy ? <Text style={st.tipTx}>{busy}</Text> : null}
        {f.km > 0 && <Text style={st.tipTx}>Percurso: {f.km} km</Text>}
      </View>
      <TouchableOpacity style={[st.btn, { backgroundColor: '#2e7d32' }]} onPress={() => salvar(true)}><Text style={[st.btnTx, { color: '#fff' }]}>{f.aberta ? 'Salvar e manter publicada' : 'Publicar trilha'}</Text></TouchableOpacity>
      <TouchableOpacity style={st.btn2} onPress={() => salvar(false)}><Text style={st.btn2Tx}>{f.aberta ? 'Salvar e despublicar' : 'Salvar rascunho'}</Text></TouchableOpacity>
      <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={onFim}><Text style={st.btn2Tx}>Voltar sem salvar</Text></TouchableOpacity>
    </View>
  );
}

// ---------- Organizador: participantes ----------
function LinhaPart({ st, trilha, p }) {
  const [ord, setOrd] = useState(p.ordem != null ? String(p.ordem) : '');
  useEffect(() => { setOrd(p.ordem != null ? String(p.ordem) : ''); }, [p.ordem]);
  const dec = (status) => atualizarInscTrilha(trilha, p.uid, { status }).catch((e) => Alert.alert('Erro', String(e?.message || e)));
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 8 }}>
      <View style={st.line}><Text style={st.v}>{p.nome || p.email}</Text><Etiqueta st={st} k={p.status} /></View>
      <Text style={st.tipTx}>{[p.veiculo, `${p.pessoas || 1} pessoa(s)`, p.email].filter(Boolean).join(' · ')}</Text>
      {p.status === 'pedido' && (
        <View style={st.row}>
          <TouchableOpacity style={[st.btn2, { backgroundColor: '#2e7d32' }]} onPress={() => dec('aprovado')}><Text style={[st.btn2Tx, { color: '#fff' }]}>Aprovar</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => dec('recusado')}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Recusar</Text></TouchableOpacity>
        </View>
      )}
      {(p.status === 'aprovado' || p.status === 'confirmado') && (
        <View style={[st.line, { alignItems: 'center' }]}>
          <Text style={st.k}>Ordem de saída (sugestão)</Text>
          <TextInput style={st.input} value={ord} onChangeText={setOrd} keyboardType="number-pad" onEndEditing={() => atualizarInscTrilha(trilha, p.uid, { ordem: parseInt(ord, 10) || null }).catch(() => {})} placeholder="—" placeholderTextColor="#666" />
        </View>
      )}
      {p.status !== 'pedido' && p.status !== 'aprovado' && p.status !== 'confirmado' && (
        <TouchableOpacity onPress={() => dec('aprovado')}><Text style={{ color: '#4fc3f7', fontWeight: '700' }}>Aprovar mesmo assim</Text></TouchableOpacity>
      )}
    </View>
  );
}

function Participantes({ st, t, onVoltar }) {
  const [lista, setLista] = useState([]);
  const [aviso, setAviso] = useState(t.aviso?.txt || '');
  useEffect(() => ouvirInscTrilha(t.id, setLista, () => {}), [t.id]);
  const conta = (s) => lista.filter((x) => x.status === s).length;
  const ordem = ['pedido', 'aprovado', 'confirmado', 'recusado', 'cancelado'];
  const ord = [...lista].sort((a, b) => ordem.indexOf(a.status) - ordem.indexOf(b.status) || (a.ordem || 999) - (b.ordem || 999));
  const publicarAviso = () => salvarTrilha(t.id, { aviso: { txt: aviso.trim(), em: Date.now() } }).then(() => Alert.alert('Aviso publicado', 'Os participantes veem na página da trilha.')).catch((e) => Alert.alert('Erro', String(e?.message || e)));
  const exportar = async () => {
    const txt = `${t.nome} · ${t.quando ? fmtBR(t.quando) : ''}\n` + ord.filter((x) => x.status === 'confirmado' || x.status === 'aprovado').map((x, i) => `${x.ordem || i + 1}. ${x.nome || x.email} · ${x.veiculo || ''} · ${x.pessoas || 1} pessoa(s) · ${x.status}`).join('\n');
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(txt); Alert.alert('Lista copiada', 'Cole onde quiser.'); } else await Share.share({ message: txt });
    } catch {}
  };
  return (
    <View>
      <TouchableOpacity onPress={onVoltar}><Text style={{ color: '#4fc3f7', fontSize: 16, fontWeight: '800', marginBottom: 8 }}>← Minhas trilhas</Text></TouchableOpacity>
      <View style={st.card}>
        <Text style={st.tip}>{t.nome}</Text>
        <Text style={st.tipTx}>{t.quando ? fmtBR(t.quando) : 'sem data'} · vagas {t.vagas || '—'}</Text>
        <View style={[st.row, { marginTop: 6 }]}>
          <Text style={st.v}>{conta('pedido')} pedido(s)</Text><Text style={st.v}>{conta('aprovado') + conta('confirmado')} aprovado(s)</Text><Text style={st.v}>{conta('confirmado')} confirmado(s)</Text>
        </View>
      </View>
      <View style={st.card}>
        <Text style={st.tip}>Aviso aos participantes</Text>
        <TextInput style={[st.field, { minHeight: 60 }]} value={aviso} onChangeText={setAviso} placeholder="Ex.: saída adiantada para 06:30" placeholderTextColor="#666" multiline />
        <TouchableOpacity style={[st.btn2, { marginTop: 8 }]} onPress={publicarAviso}><Text style={st.btn2Tx}>Publicar aviso</Text></TouchableOpacity>
      </View>
      <PainelAoVivo st={st} kind="trilha" id={t.id} rota={pair(t.rota || [])} />
      <View style={st.card}>
        <Text style={st.tip}>Participantes</Text>
        {ord.length === 0 && <Text style={st.tipTx}>Ainda não há pedidos de vaga.</Text>}
        {ord.map((p) => <LinhaPart key={p.uid} st={st} trilha={t.id} p={p} />)}
        {ord.length > 0 && <TouchableOpacity style={[st.btn2, { marginTop: 10 }]} onPress={exportar}><Text style={st.btn2Tx}>Exportar lista</Text></TouchableOpacity>}
      </View>
    </View>
  );
}

export function TrilhasOrg({ st }) {
  const [lista, setLista] = useState(null);
  const [vis, setVis] = useState(null); // {tipo:'form'|'part', t}
  useEffect(() => ouvirMinhasTrilhasOrg(setLista, () => setLista([])), []);
  if (vis && vis.tipo === 'form') return <FormTrilha st={st} ini={vis.t} onFim={() => setVis(null)} />;
  if (vis && vis.tipo === 'part') return <Participantes st={st} t={lista?.find((x) => x.id === vis.t.id) || vis.t} onVoltar={() => setVis(null)} />;
  const apagar = (t) => Alert.alert('Apagar trilha', `Apagar "${t.nome}" e todos os pedidos e percursos dela?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => apagarTrilha(t.id).catch((e) => Alert.alert('Erro', String(e?.message || e))) }]);
  return (
    <View>
      <Text style={st.tip}>Minhas trilhas</Text>
      <TouchableOpacity style={st.btn} onPress={() => setVis({ tipo: 'form', t: {} })}><Text style={st.btnTx}>+ Nova trilha</Text></TouchableOpacity>
      {lista == null && <Text style={st.tipTx}>Carregando…</Text>}
      {lista && lista.length === 0 && <View style={st.card}><Text style={st.tipTx}>Você ainda não criou nenhuma trilha.</Text></View>}
      {[...(lista || [])].sort((a, b) => (b.quandoTs || 0) - (a.quandoTs || 0)).map((t) => (
        <View key={t.id} style={st.card}>
          <View style={st.line}><Text style={st.v}>{t.nome}</Text><Text style={{ color: t.aberta ? '#4caf50' : '#ffb300', fontWeight: '800' }}>{t.aberta ? 'Publicada' : 'Rascunho'}</Text></View>
          <Text style={st.tipTx}>{[t.quando ? fmtBR(t.quando) : 'sem data', t.cidade, t.nivel, t.km ? `${t.km} km` : ''].filter(Boolean).join(' · ')}</Text>
          <View style={st.row}>
            <TouchableOpacity style={st.btn2} onPress={() => setVis({ tipo: 'part', t })}><Text style={st.btn2Tx}>Participantes</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setVis({ tipo: 'form', t })}><Text style={st.btn2Tx}>Editar</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => apagar(t)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Competidor ----------
const REC = 'trl_rec'; // gravação em andamento: { id, ini, fim }

function Gravacao({ st, t, gps, souAprovado }) {
  const [rec, setRec] = useState(() => loadJson(REC, null));
  const [, tick] = useState(0);
  const [meus, setMeus] = useState([]);
  const [ver, setVer] = useState(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => ouvirMeusTracksTrilha((l) => setMeus(l.filter((x) => x.trilha === t.id)), () => {}), [t.id]);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 3000); return () => clearInterval(id); }, []);
  const minha = rec && rec.id === t.id ? rec : null;
  const janela = () => gps.getPoints().filter((p) => p.t >= minha.ini && (minha.fim == null || p.t <= minha.fim));
  const iniciar = async () => {
    if (rec && rec.id !== t.id) return Alert.alert('Outra gravação', 'Finalize antes a gravação da outra trilha.');
    if (!gps.running) await gps.start();
    const r = { id: t.id, ini: Date.now(), fim: null };
    saveJson(REC, r); setRec(r);
  };
  const finalizar = async () => {
    const r = { ...minha, fim: minha.fim || Date.now() };
    saveJson(REC, r); setRec(r);
    const pts = gps.getPoints().filter((p) => p.t >= r.ini && p.t <= r.fim);
    setEnviando(true);
    try {
      await enviarTrackTrilha({ trilha: t.id, nome: gps.nome, points: pts, km: kmDe(pts), titulo: t.nome });
      saveJson(REC, null); setRec(null);
      Alert.alert('Percurso salvo', `${(kmDe(pts)).toFixed(1)} km gravados. Você pode publicá-lo abaixo.`);
    } catch (e) { Alert.alert('Não enviou', 'Seus pontos continuam guardados no celular. Confira a internet e toque em Enviar de novo. ' + String(e?.message || e)); }
    setEnviando(false);
  };
  const descartar = () => Alert.alert('Descartar gravação', 'Apagar esta gravação sem enviar?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Descartar', style: 'destructive', onPress: () => { saveJson(REC, null); setRec(null); } }]);
  const pts = minha ? janela() : [];
  const km = minha ? kmDe(pts) : 0;
  return (
    <View style={st.card}>
      <Text style={st.tip}>Meu percurso</Text>
      {!minha && souAprovado && <TouchableOpacity style={st.btn} onPress={iniciar}><Text style={st.btnTx}>Gravar minha trilha</Text></TouchableOpacity>}
      {!minha && !souAprovado && <Text style={st.tipTx}>Depois de aprovado você pode gravar o seu percurso.</Text>}
      {minha && (
        <View>
          <Text style={st.v}>{minha.fim ? 'Gravação parada' : 'Gravando…'} · {km.toFixed(2)} km · {pts.length} pontos</Text>
          <TouchableOpacity style={[st.btn, { marginTop: 8, backgroundColor: '#c0392b' }]} onPress={finalizar} disabled={enviando}><Text style={[st.btnTx, { color: '#fff' }]}>{enviando ? 'Enviando…' : minha.fim ? 'Enviar de novo' : 'Finalizar e salvar'}</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={descartar}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Descartar gravação</Text></TouchableOpacity>
        </View>
      )}
      {meus.map((m) => (
        <View key={m.uid + m.trilha} style={{ borderTopWidth: 1, borderTopColor: '#262b32', marginTop: 8, paddingTop: 8 }}>
          <View style={st.line}><Text style={st.v}>{m.km} km · {m.em ? new Date(m.em).toLocaleDateString('pt-BR') : ''}</Text><Text style={{ color: m.publico ? '#4caf50' : '#888', fontWeight: '800' }}>{m.publico ? 'Público' : 'Privado'}</Text></View>
          <View style={st.row}>
            <TouchableOpacity style={st.btn2} onPress={() => setVer(ver === m.uid ? null : m.uid)}><Text style={st.btn2Tx}>{ver === m.uid ? 'Esconder mapa' : 'Ver no mapa'}</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => publicarTrackTrilha(m.trilha, m.uid, !m.publico).catch(() => {})}><Text style={st.btn2Tx}>{m.publico ? 'Tornar privado' : 'Publicar percurso'}</Text></TouchableOpacity>
          </View>
          {ver === m.uid && <MapaWeb coords={trackCoords(m)} height={260} />}
        </View>
      ))}
    </View>
  );
}

function Detalhe({ st, t, insc, gps, onVoltar }) {
  const [veic, setVeic] = useState('');
  const [pes, setPes] = useState('1');
  const [pub, setPub] = useState([]);
  const [verPub, setVerPub] = useState(null);
  useEffect(() => ouvirTracksPublicosTrilha(t.id, setPub, () => {}), [t.id]);
  const s = insc ? insc.status : null;
  const agora = Date.now();
  const abreConf = t.quandoTs ? agora >= t.quandoTs - 24 * 3600 * 1000 : true;
  const pedir = () => pedirVagaTrilha(t.id, { nome: gps.nome, veiculo: veic.trim(), pessoas: parseInt(pes, 10) || 1 }).then(() => Alert.alert('Pedido enviado', 'O organizador vai analisar. Você vê a resposta aqui.')).catch((e) => Alert.alert('Erro', String(e?.message || e)));
  const mudar = (status, msg) => atualizarInscTrilha(t.id, gps.uid, { status }).then(() => msg && Alert.alert(msg)).catch((e) => Alert.alert('Erro', String(e?.message || e)));
  const sair = () => Alert.alert('Cancelar', 'Cancelar sua participação nesta trilha?', [{ text: 'Voltar', style: 'cancel' }, { text: 'Cancelar participação', style: 'destructive', onPress: () => mudar('cancelado') }]);
  const marks = pair(t.pts || []).map((p, i) => ({ lat: p[0], lon: p[1], txt: i === 0 ? 'Encontro' : i === 1 ? 'Largada' : `Chegada ${i - 1}`, cls: i === 0 ? 'l' : i === 1 ? 'c' : 's' }));
  if (!marks.length && t.encontro) marks.push({ lat: t.encontro.lat, lon: t.encontro.lon, txt: 'Encontro', cls: 'l' });
  const coords = verPub != null ? trackCoords(pub.find((x) => x.uid === verPub)) : pair(t.rota);
  return (
    <View>
      <TouchableOpacity onPress={onVoltar}><Text style={{ color: '#4fc3f7', fontSize: 16, fontWeight: '800', marginBottom: 8 }}>← Trilhas</Text></TouchableOpacity>
      <View style={st.card}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{t.nome}</Text>
        <Text style={st.tipTx}>{[t.quando ? fmtBR(t.quando) : '', t.cidade, t.nivel, t.km ? `${t.km} km` : '', t.vagas ? `${t.vagas} vagas` : ''].filter(Boolean).join(' · ')}</Text>
        {t.aviso && t.aviso.txt ? <View style={{ backgroundColor: '#5c4a12', borderRadius: 8, padding: 8, marginTop: 8 }}><Text style={{ color: '#ffe08a', fontWeight: '800' }}>Aviso do organizador</Text><Text style={{ color: '#ffe08a' }}>{t.aviso.txt}</Text></View> : null}
        {t.obs ? <Text style={[st.v, { marginTop: 8 }]}>{t.obs}</Text> : null}
      </View>
      {(t.encontro || coords.length > 0) && <MapaWeb coords={coords} marks={marks} height={260} />}
      <View style={st.card}>
        <Text style={st.tip}>Minha participação</Text>
        {!s && (
          <View>
            <TextInput style={st.field} value={veic} onChangeText={setVeic} placeholder="Veículo (ex.: Jipe, moto, UTV)" placeholderTextColor="#666" />
            <View style={st.line}><Text style={st.k}>Pessoas no veículo</Text><TextInput style={st.input} value={pes} onChangeText={(v) => setPes(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" /></View>
            <TouchableOpacity style={st.btn} onPress={pedir}><Text style={st.btnTx}>Pedir vaga</Text></TouchableOpacity>
          </View>
        )}
        {s && <View style={st.line}><Text style={st.v}>Situação</Text><Etiqueta st={st} k={s} /></View>}
        {s === 'pedido' && <Text style={st.tipTx}>Aguardando o organizador aprovar o seu pedido.</Text>}
        {s === 'recusado' && <Text style={st.tipTx}>O organizador não aprovou o seu pedido desta vez.</Text>}
        {(s === 'aprovado' || s === 'confirmado') && insc.ordem ? <Text style={st.tipTx}>Ordem de saída sugerida: {insc.ordem}º</Text> : null}
        {s === 'aprovado' && (
          abreConf
            ? <TouchableOpacity style={st.btn} onPress={() => mudar('confirmado', 'Presença confirmada')}><Text style={st.btnTx}>Confirmar presença</Text></TouchableOpacity>
            : <Text style={st.tipTx}>A confirmação de presença abre 24 h antes da saída.</Text>
        )}
        {s === 'confirmado' && <Text style={[st.tipTx, { color: '#4caf50' }]}>Presença confirmada. Boa trilha!</Text>}
        {(s === 'pedido' || s === 'aprovado' || s === 'confirmado') && <TouchableOpacity style={st.btn2} onPress={sair}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Cancelar participação</Text></TouchableOpacity>}
        {(s === 'cancelado' || s === 'recusado') && <TouchableOpacity style={st.btn2} onPress={() => removerInscTrilha(t.id, gps.uid).catch(() => {})}><Text style={st.btn2Tx}>Limpar e pedir de novo</Text></TouchableOpacity>}
      </View>
      <Gravacao st={st} t={t} gps={gps} souAprovado={s === 'aprovado' || s === 'confirmado'} />
      {pub.length > 0 && (
        <View style={st.card}>
          <Text style={st.tip}>Percursos publicados pelo grupo</Text>
          {pub.map((m) => (
            <TouchableOpacity key={m.uid} style={st.line} onPress={() => setVerPub(verPub === m.uid ? null : m.uid)}>
              <Text style={st.v}>{m.nome || 'Participante'} · {m.km} km</Text><Text style={{ color: '#4fc3f7' }}>{verPub === m.uid ? 'esconder' : 'ver no mapa'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function TrilhasComp({ st, gps }) {
  const [lista, setLista] = useState(null);
  const [minhas, setMinhas] = useState({});
  const [id, setId] = useState(null);
  useEffect(() => ouvirTrilhasAbertas(setLista, () => setLista([])), []);
  useEffect(() => ouvirMinhasInscTrilhas((l) => setMinhas(Object.fromEntries(l.map((x) => [x.trilha, x]))), () => {}), []);
  const t = id && (lista || []).find((x) => x.id === id);
  if (t) return <Detalhe st={st} t={t} insc={minhas[t.id]} gps={gps} onVoltar={() => setId(null)} />;
  const ordenada = [...(lista || [])].sort((a, b) => (a.quandoTs || 9e15) - (b.quandoTs || 9e15));
  return (
    <View>
      <Text style={st.tip}>Trilhas abertas</Text>
      {lista == null && <Text style={st.tipTx}>Carregando…</Text>}
      {lista && lista.length === 0 && <View style={st.card}><Text style={st.tipTx}>Nenhuma trilha aberta no momento.</Text></View>}
      {ordenada.map((x) => (
        <TouchableOpacity key={x.id} style={st.card} onPress={() => setId(x.id)}>
          <View style={st.line}><Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 }}>{x.nome}</Text>{minhas[x.id] ? <Etiqueta st={st} k={minhas[x.id].status} /> : <Text style={{ color: '#ff7a2e', fontWeight: '800' }}>Vagas abertas</Text>}</View>
          <Text style={st.tipTx}>{[x.quando ? fmtBR(x.quando) : '', x.cidade].filter(Boolean).join(' · ')}</Text>
          <Text style={st.tipTx}>{[x.nivel, x.km ? `${x.km} km` : '', x.vagas ? `${x.vagas} vagas` : ''].filter(Boolean).join(' · ')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
