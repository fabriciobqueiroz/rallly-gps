// Fluxo do competidor: eventos → evento → modo de uso → largada → configurações → equipamento → prova.
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MeuTrackLog } from './TrackLog';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { useKeepAwake } from 'expo-keep-awake';
import { loadJson, saveJson } from './persist';
import { cancelarPedido, lerPerfil, pedirVagaProva, removerInscricao, lerProva, ouvirMeusPedidos, ouvirMinhasInscricoes, ouvirMinhasProvas, ouvirRanking, ouvirVitrine } from './firebase';
import { parseHMS, planilhaLiberada } from './OrgExtras';
import { fmtDur, gruposDe, rank } from './rally';

const slug = (p) => String(p).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
export const parseDataBR = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return isNaN(d) || d.getDate() !== +m[1] ? null : d.getTime();
};
const hms = (s) => { const p = (x) => String(x).padStart(2, '0'); return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(Math.floor(s % 60))}`; };
const temCache = (code) => { const c = loadJson('prova_' + slug(code), null); return !!(c && (c.trechos || []).length); };

function Topo({ st, titulo, onVoltar }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      {onVoltar ? <TouchableOpacity onPress={onVoltar} style={{ paddingRight: 14, paddingVertical: 6 }}><Text style={{ color: '#4fc3f7', fontSize: 24, fontWeight: '800' }}>←</Text></TouchableOpacity> : null}
      <Text style={[st.tip, { flex: 1, marginBottom: 0 }]}>{titulo}</Text>
    </View>
  );
}

// ---------- Eventos disponíveis: pedir vaga ----------
function PedirVaga({ st, user, v, onFim }) {
  const cats = v.categorias || [];
  const [f, setF] = useState({ piloto: '', navegador: '', equipe: '', classe: cats[0] || '', numero: '' });
  const [env, setEnv] = useState(false);
  useEffect(() => { lerPerfil(user.uid).then((d) => { const p = d.perfil || {}; setF((x) => ({ ...x, piloto: x.piloto || p.nome || '', equipe: x.equipe || p.equipe || '' })); }).catch(() => {}); }, [user.uid]);
  const enviar = async () => {
    if (!f.piloto.trim()) return Alert.alert('Falta preencher', 'Informe o nome do piloto.');
    setEnv(true);
    try { await pedirVagaProva(v.prova, { provaNome: v.nome, ...f, piloto: f.piloto.trim() }); onFim(); }
    catch (e) { Alert.alert('Não enviou', String(e?.message || e)); setEnv(false); }
  };
  return (
    <View style={{ marginTop: 8 }}>
      <TextInput style={st.field} value={f.piloto} onChangeText={(t) => setF({ ...f, piloto: t })} placeholder="Piloto" placeholderTextColor="#666" />
      <TextInput style={st.field} value={f.navegador} onChangeText={(t) => setF({ ...f, navegador: t })} placeholder="Navegador (opcional)" placeholderTextColor="#666" />
      <TextInput style={st.field} value={f.equipe} onChangeText={(t) => setF({ ...f, equipe: t })} placeholder="Equipe (opcional)" placeholderTextColor="#666" />
      <TextInput style={st.field} value={f.numero} onChangeText={(t) => setF({ ...f, numero: t })} placeholder="Número desejado (opcional)" placeholderTextColor="#666" keyboardType="number-pad" />
      {cats.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {cats.map((c) => <TouchableOpacity key={c} style={[st.chip, f.classe === c && { backgroundColor: '#ff7a2e' }]} onPress={() => setF({ ...f, classe: c })}><Text style={[st.btn2Tx, f.classe === c && { color: '#0c1014' }]}>{c}</Text></TouchableOpacity>)}
        </View>
      )}
      <View style={st.row}>
        <TouchableOpacity style={[st.btn, { flex: 1, marginBottom: 0 }]} onPress={enviar} disabled={env}><Text style={st.btnTx}>{env ? 'Enviando…' : 'Enviar pedido'}</Text></TouchableOpacity>
        <TouchableOpacity style={[st.btn2, { flex: 1 }]} onPress={onFim}><Text style={st.btn2Tx}>Cancelar</Text></TouchableOpacity>
      </View>
      <Text style={st.tipTx}>O organizador aprova o pedido, define o número e a largada. Você é avisado aqui.</Text>
    </View>
  );
}
export function EventosAbertos({ st, user, extra }) {
  const c0 = loadJson('evcache', { insc: [], donos: [], provas: {} });
  const [insc, setInsc] = useState(c0.insc);
  const [donos, setDonos] = useState(c0.donos);
  useEffect(() => ouvirMinhasInscricoes(user.email, setInsc, () => {}), [user.email]);
  useEffect(() => ouvirMinhasProvas(setDonos, () => {}), [user.uid]);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = (ts) => (ts == null ? null : Math.round((ts - hoje.getTime()) / 86400000));
  return (
    <View>
      <Topo st={st} titulo="Eventos abertos" />
      <Text style={st.tipTx}>Eventos lançados pelos organizadores com inscrições abertas. Peça a sua vaga; depois de aprovado o evento passa para "Meus eventos".</Text>
      <Disponiveis st={st} user={user} excluir={[...insc.map((i) => i.prova), ...donos.map((d) => d.code)]} dias={dias} semTitulo />
      {extra}
    </View>
  );
}
function Disponiveis({ st, user, excluir, dias }) {
  const [vit, setVit] = useState([]);
  const [pedidos, setPedidos] = useState({});
  const [aberta, setAberta] = useState(null);
  useEffect(() => ouvirVitrine(setVit, () => {}), []);
  useEffect(() => ouvirMeusPedidos((l) => setPedidos(Object.fromEntries(l.map((p) => [p.prova, p]))), () => {}), []);
  const lista = vit.filter((v) => !excluir.includes(v.prova) && v.donoUid !== user.uid)
    .map((v) => ({ ...v, ts: v.dataTs ?? parseDataBR(v.data) }))
    .filter((v) => v.ts == null || dias(v.ts) >= 0 || pedidos[v.prova])
    .sort((a, b) => (a.ts ?? 9e15) - (b.ts ?? 9e15));
  if (!lista.length) return <View style={[st.card, { marginTop: 10 }]}><Text style={st.tipTx}>Nenhuma prova com inscrições abertas no momento.</Text></View>;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={[st.tip, { marginBottom: 6 }]}>Provas</Text>
      {lista.map((v) => {
        const p = pedidos[v.prova];
        const stt = p && p.status;
        return (
          <View key={v.prova} style={[st.card, { marginBottom: 8, borderLeftWidth: 5, borderLeftColor: '#9aa3ad' }]}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{v.nome || 'Prova ' + v.prova}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}><Text style={st.tipTx}>{v.cidade || '—'}</Text><Text style={st.tipTx}>{v.data || ''}</Text></View>
            {stt === 'pedido' && <Text style={{ color: '#ffb300', fontWeight: '700', marginTop: 4 }}>Pedido enviado · aguardando o organizador</Text>}
            {stt === 'recusado' && <Text style={{ color: '#ff5252', fontWeight: '700', marginTop: 4 }}>Pedido recusado pelo organizador</Text>}
            {stt === 'aprovado' && <Text style={{ color: '#4caf50', fontWeight: '700', marginTop: 4 }}>Aprovado ✓ · já aparece em Eventos inscritos</Text>}
            {(stt === 'pedido' || stt === 'recusado') && (
              <TouchableOpacity onPress={() => cancelarPedido(v.prova, user.uid).catch(() => {})}><Text style={{ color: '#ff5252', fontWeight: '700', marginTop: 6 }}>{stt === 'pedido' ? 'Cancelar pedido' : 'Limpar'}</Text></TouchableOpacity>
            )}
            {!p && aberta !== v.prova && <TouchableOpacity style={[st.btn, { marginTop: 8, marginBottom: 0 }]} onPress={() => setAberta(v.prova)}><Text style={st.btnTx}>Pedir inscrição</Text></TouchableOpacity>}
            {!p && aberta === v.prova && <PedirVaga st={st} user={user} v={v} onFim={() => setAberta(null)} />}
          </View>
        );
      })}
    </View>
  );
}

// ---------- 1. Escolha o evento ----------
function Eventos({ st, user, onEvento, onAdmin }) {
  const c0 = loadJson('evcache', { insc: [], donos: [], provas: {} });
  const [insc, setInsc] = useState(c0.insc);
  const [donos, setDonos] = useState(c0.donos);
  const [provas, setProvas] = useState(c0.provas);
  const [erro, setErro] = useState('');
  const [ocultas, setOcultas] = useState(() => loadJson('evocultas', []));
  const [sumidas, setSumidas] = useState({}); // provas que não existem mais na nuvem (canceladas/apagadas)
  useEffect(() => ouvirMinhasInscricoes(user.email, (l) => { setInsc(l); setErro(''); }, () => setErro('Sem conexão: mostrando o que está salvo no celular.')), [user.email]);
  useEffect(() => ouvirMinhasProvas(setDonos, () => {}), [user.uid]);
  useEffect(() => {
    insc.forEach((i) => { lerProva(i.prova).then((d) => { if (d) { setSumidas((m) => (m[i.prova] ? { ...m, [i.prova]: false } : m)); if (!provas[i.prova]) setProvas((p) => ({ ...p, [i.prova]: d })); } else setSumidas((m) => ({ ...m, [i.prova]: true })); }).catch(() => {}); });
  }, [insc]);
  useEffect(() => { saveJson('evcache', { insc, donos, provas }); }, [insc, donos, provas]);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = (ts) => (ts == null ? null : Math.round((ts - hoje.getTime()) / 86400000));
  const adm = donos.map((x) => ({ kind: 'adm', code: x.code, nome: x.nome || 'Prova ' + x.code, cidade: x.cidade, data: x.data, ts: x.dataTs ?? parseDataBR(x.data) }));
  const comp = insc.filter((i) => !sumidas[i.prova] && !ocultas.includes(i.prova + '_' + i.numero)).map((i) => { const p = provas[i.prova] || {}; return { kind: 'comp', code: i.prova, nome: i.provaNome || p.nome || 'Prova ' + i.prova, cidade: p.cidade, data: p.data, ts: p.dataTs ?? parseDataBR(p.data), insc: i }; });
  const ord = (a) => [...a].sort((x, y) => (y.ts ?? -1) - (x.ts ?? -1));
  const todos = [...adm, ...comp];
  const sHoje = todos.filter((x) => dias(x.ts) === 0);
  const sAman = todos.filter((x) => dias(x.ts) === 1);
  const resto = (a) => ord(a.filter((x) => ![0, 1].includes(dias(x.ts))));
  const remover = (x) => Alert.alert('Remover da lista', `Tirar "${x.nome}" da sua lista de eventos inscritos?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => {
      const chave = x.code + '_' + (x.insc?.numero || '');
      const n = [...ocultas, chave]; setOcultas(n); saveJson('evocultas', n);
      removerInscricao(x.code, x.insc?.numero, user.email).catch(() => {}); // se a conta permitir, apaga também na nuvem
    } },
  ]);
  const Cartao = ({ x, tag, hero }) => (
    <TouchableOpacity style={[st.card, { marginBottom: 8, borderLeftWidth: 5, borderLeftColor: x.kind === 'adm' ? '#4fc3f7' : '#ff7a2e' }, hero && { backgroundColor: '#ff7a2e', borderLeftColor: '#ffb27a' }]} onPress={() => (x.kind === 'adm' ? onAdmin(x) : onEvento(x))}>
      <Text style={{ color: hero ? '#0c1014' : '#fff', fontSize: hero ? 22 : 18, fontWeight: '800' }}>{x.nome}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={[st.tipTx, hero && { color: '#0c1014' }]}>{x.cidade || '—'}</Text><Text style={[st.tipTx, hero && { color: '#0c1014' }]}>{x.data || ''}</Text>
      </View>
      {tag ? <Text style={[st.tipTx, { color: hero ? '#0c1014' : '#4fc3f7', fontWeight: '700' }]}>{x.kind === 'adm' ? 'Organizador' : 'Competidor'}{hero ? ' · toque para abrir' : ''}</Text> : null}
      {x.kind === 'comp' && temCache(x.code) ? <Text style={[st.tipTx, { color: hero ? '#0c1014' : '#4caf50' }]}>Disponível offline ✓</Text> : null}
      {x.kind === 'comp' ? <TouchableOpacity onPress={() => remover(x)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: '#ff5252', fontWeight: '700', marginTop: 6 }}>Remover da lista</Text></TouchableOpacity> : null}
    </TouchableOpacity>
  );
  const Sec = ({ t, a, tag, hero }) => (a.length ? <View style={{ marginTop: 6 }}><Text style={[st.tip, { marginBottom: 6 }]}>{t}</Text>{a.map((x, i) => <Cartao key={x.kind + x.code + (x.insc?.numero || '')} x={x} tag={tag} hero={hero && i === 0} />)}</View> : null);
  return (
    <View>
      <Topo st={st} titulo="Escolha o evento" />
      {erro ? <Text style={[st.tipTx, { color: '#ffb300' }]}>{erro}</Text> : null}
      <Sec t="Hoje" a={sHoje} tag hero /><Sec t="Amanhã" a={sAman} tag />
      <Sec t="Admin" a={resto(adm)} /><Sec t="Eventos inscritos" a={resto(comp)} />
      {todos.length === 0 && <View style={st.card}><Text style={st.tipTx}>Nenhum evento inscrito ainda. Veja o menu "Eventos abertos" e peça inscrição, ou peça ao organizador para inscrever o e-mail {user.email}. Se é organizador, crie a prova na aba Organizar.</Text></View>}
    </View>
  );
}

// ---------- 2. Evento ----------
function Evento({ st, user, x, provaMap, lib, dlStat, pointsN, onDl, enviandoDl, onIniciar, onPersonalizar, onVoltar, onZerarDl }) {
  const [aba, setAba] = useState('info');
  const [aberto, setAberto] = useState(false);
  const [rows, setRows] = useState([]);
  const key = slug(x.code) + '_' + x.insc.numero;
  const s = dlStat[key];
  const pend = !s && pointsN >= 10;
  useEffect(() => { if (aba !== 'res') return; return ouvirRanking(x.code, (r) => setRows(rank(r)), () => {}); }, [aba, x.code]);
  const atualizar = () => lerProva(x.code).then((d) => { if (d) saveJson('prova_' + slug(x.code), d); Alert.alert('Atualizado', 'Planilha e informações salvas no celular.'); }).catch(() => Alert.alert('Sem conexão', 'Não deu para atualizar agora.'));
  const off = temCache(x.code);
  const corDl = s ? '#4caf50' : pend ? '#ff5252' : '#888';
  return (
    <View>
      <Topo st={st} titulo="Evento" onVoltar={onVoltar} />
      <View style={[st.row, { marginBottom: 6 }]}>
        {[['info', 'Informações'], ['res', 'Resultados']].map(([k, t]) => (
          <TouchableOpacity key={k} style={[st.btn2, aba === k && { backgroundColor: '#ff7a2e' }]} onPress={() => setAba(k)}><Text style={[st.btn2Tx, aba === k && { color: '#0c1014' }]}>{t}</Text></TouchableOpacity>
        ))}
      </View>
      {aba === 'info' ? (
        <View>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6 }}>{x.nome}</Text>
          {provaMap && provaMap.pub > 1 ? <Text style={{ color: '#9aa3ad', marginTop: 2 }}>Planilha do organizador: versão de {new Date(provaMap.pub).toLocaleString('pt-BR')}</Text> : null}
          <View style={[st.line, { marginTop: 8 }]}>
            <Text style={st.v}>{x.data || 'data a definir'}{x.cidade ? ` · ${x.cidade}` : ''}</Text>
            <TouchableOpacity onPress={atualizar}><Text style={{ color: '#4fc3f7', fontSize: 24 }}>↻</Text></TouchableOpacity>
          </View>
          <Text style={[st.tipTx, { color: off ? '#4caf50' : '#ffb300' }]}>{off ? 'Disponível offline ✓' : 'Planilha ainda não publicada'}</Text>
          {off && !lib ? <Text style={[st.tipTx, { color: '#ffb300' }]}>Planilha ainda não liberada pelo organizador{provaMap.lib?.ini ? ` (libera em ${provaMap.lib.ini})` : ''}.</Text> : null}
          <Text style={st.tipTx}>#{x.insc.numero} · {x.insc.classe} · {x.insc.piloto}{x.insc.navegador ? ` / ${x.insc.navegador}` : ''}{x.insc.largada ? ` · largada ${x.insc.largada}` : ''}</Text>
          <TouchableOpacity style={[st.card, { borderColor: corDl, borderWidth: 1, marginTop: 12 }]} onPress={() => setAberto(!aberto)}>
            <View style={st.line}>
              <View><Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Datalogger</Text>
                <Text style={{ color: corDl }}>{s ? `Enviado ✓ (${s.n} pontos)` : pend ? `1 não sincronizado (${pointsN} pontos)` : 'nenhum gravado'}</Text></View>
              <Text style={{ color: '#fff', fontSize: 18 }}>{aberto ? '⌃' : '⌄'}</Text>
            </View>
            {aberto && (
              <View style={{ marginTop: 8 }}>
                {s ? <Text style={st.tipTx}>Enviado em {new Date(s.em).toLocaleString('pt-BR')}.</Text> : <Text style={st.tipTx}>Ainda não enviado para a apuração.</Text>}
                {pointsN >= 10 && <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={onDl} disabled={enviandoDl}><Text style={st.btn2Tx}>{enviandoDl ? 'Enviando…' : s ? 'Enviar de novo' : 'Sincronizar agora'}</Text></TouchableOpacity>}
                {onZerarDl && <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={onZerarDl}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Zerar datalogger</Text></TouchableOpacity>}
              </View>
            )}
          </TouchableOpacity>
          {provaMap.lib?.track === true && <MeuTrackLog st={st} prova={x.insc.prova} uid={user?.uid} provaMap={provaMap} grupos={gruposDe(provaMap.categorias)} />}
          <TouchableOpacity style={[st.btn, { backgroundColor: '#1aa6c9', marginTop: 24 }]} onPress={onIniciar}><Text style={[st.btnTx, { color: '#fff' }]}>INICIAR RALLY</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={onPersonalizar}><Text style={st.btn2Tx}>Personalizar tela</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={st.card}>
          {provaMap.lib?.resultado === false ? <Text style={[st.tipTx, { color: '#ffb300' }]}>Resultado ainda não liberado pelo organizador.</Text> : rows.length === 0 ? <Text style={st.tipTx}>Nenhum resultado ainda.</Text> : rows.map((r, i) => (
            <View key={r.numero} style={st.line}>
              <Text style={st.k}>{i + 1}º  #{r.numero} {r.nome} · {r.classe ? r.classe.slice(0, 3) : ''}{r.oficial ? ' ✔' : ''}</Text>
              {provaMap.lib?.soma !== false && <Text style={st.v}>{Number(r.pontos).toFixed(1)} pts</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------- 3. Modo de uso ----------
function Opcao({ st, t, d, onPress }) {
  return (
    <TouchableOpacity style={[st.card, { paddingVertical: 36, flexDirection: 'row', alignItems: 'center' }]} onPress={onPress}>
      <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{t}</Text><Text style={[st.tipTx, { marginTop: 6, fontSize: 14 }]}>{d}</Text></View>
      <Text style={{ color: '#fff', fontSize: 28 }}>›</Text>
    </TouchableOpacity>
  );
}
function Modo({ st, onEscolhe, onVoltar }) {
  return (
    <View>
      <Topo st={st} titulo="Como deseja utilizar o aplicativo?" onVoltar={onVoltar} />
      <Opcao st={st} t="Apenas datalogger" d="Registro de dados GPS para a apuração em segundo plano." onPress={() => onEscolhe('dl')} />
      <Opcao st={st} t="Planilha digital" d="Sistema de navegação em tempo real, com geração de datalogger GPS para a apuração." onPress={() => onEscolhe('planilha')} />
    </View>
  );
}

// ---------- 4. Largada ----------
function Largada({ st, minhaLarg, onContinua, onVoltar }) {
  return (
    <View>
      <Topo st={st} titulo="Sua hora de largada" onVoltar={onVoltar} />
      <View style={st.card}>
        {minhaLarg ? (
          <>
            <Text style={{ color: '#fff', fontSize: 44, fontWeight: '800', textAlign: 'center' }}>{minhaLarg}</Text>
            <Text style={[st.tipTx, { textAlign: 'center' }]}>Definida pelo organizador. Só ele pode alterar.</Text>
          </>
        ) : (
          <Text style={[st.tipTx, { textAlign: 'center', fontSize: 15 }]}>O organizador ainda não definiu a sua largada. Quando ele definir, o horário aparece aqui sozinho.</Text>
        )}
      </View>
      <TouchableOpacity style={[st.btn, { marginTop: 16 }]} onPress={onContinua}><Text style={st.btnTx}>CONTINUAR</Text></TouchableOpacity>
    </View>
  );
}

// ---------- 5. Configurações necessárias ----------
async function checar() {
  const r = {};
  try { r.gps = await Location.hasServicesEnabledAsync(); } catch { r.gps = false; }
  try { r.fg = (await Location.getForegroundPermissionsAsync()).status === 'granted'; } catch { r.fg = false; }
  try { r.bg = (await Location.getBackgroundPermissionsAsync()).status === 'granted'; } catch { r.bg = false; }
  try { r.bat = !(await Battery.isBatteryOptimizationEnabledAsync()); } catch { r.bat = true; }
  try { r.eco = !(await Battery.isLowPowerModeEnabledAsync()); } catch { r.eco = true; }
  return r;
}
const abrirCfg = (acao) => Linking.sendIntent(acao).catch(() => Linking.openSettings());
function Config({ st, onContinua, onVoltar }) {
  const [r, setR] = useState(null);
  const re = () => checar().then(setR);
  useEffect(() => { re(); const sub = AppState.addEventListener('change', (s) => { if (s === 'active') re(); }); return () => sub.remove(); }, []);
  const corrige = {
    gps: () => abrirCfg('android.settings.LOCATION_SOURCE_SETTINGS'),
    fg: async () => { await Location.requestForegroundPermissionsAsync(); re(); },
    bg: async () => {
      const f = await Location.requestForegroundPermissionsAsync();
      if (f.status === 'granted') { const b = await Location.requestBackgroundPermissionsAsync(); if (b.status === 'granted') return re(); }
      Alert.alert('Localização o tempo todo', 'Abra as configurações do app, toque em Permissões > Localização e escolha "Permitir o tempo todo".', [{ text: 'Abrir configurações', onPress: () => Linking.openSettings() }, { text: 'Agora não' }]);
    },
    bat: () => abrirCfg('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'),
    eco: () => abrirCfg('android.settings.BATTERY_SAVER_SETTINGS'),
  };
  const itens = [['gps', '1. Ative o GPS'], ['fg', '2. Permissão de localização durante o uso'], ['bg', '3. Permissão de localização O TEMPO TODO'], ['bat', '4. Ignorar otimização de bateria'], ['eco', '5. Desabilitar modo de economia de energia']];
  const ok = r && itens.every(([k]) => r[k]);
  const ir = () => {
    if (ok) return onContinua();
    Alert.alert('Faltam configurações', 'Sem elas o app pode parar de gravar durante a prova. Corrija os itens com ✗.', [{ text: 'Corrigir', style: 'cancel' }, { text: 'Continuar mesmo assim', style: 'destructive', onPress: onContinua }]);
  };
  return (
    <View>
      <Topo st={st} titulo="Configurações necessárias" onVoltar={onVoltar} />
      <Text style={st.tipTx}>Para que o app não seja interrompido e registre o datalogger corretamente, é necessário realizar estas configurações:</Text>
      <View style={[st.card, { marginTop: 8 }]}>
        {itens.map(([k, t]) => (
          <View key={k} style={[st.line, { alignItems: 'center', paddingVertical: 10 }]}>
            <Text style={{ color: r == null ? '#888' : r[k] ? '#4caf50' : '#ff5252', fontSize: 22, width: 30 }}>{r == null ? '…' : r[k] ? '✓' : '✗'}</Text>
            <Text style={[st.v, { flex: 1 }]}>{t}</Text>
            {r && !r[k] ? <TouchableOpacity onPress={corrige[k]}><Text style={{ color: '#4fc3f7', fontWeight: '800' }}>corrigir</Text></TouchableOpacity> : null}
          </View>
        ))}
        <View style={[st.line, { alignItems: 'center', paddingVertical: 10 }]}>
          <Text style={{ color: '#888', fontSize: 22, width: 30 }}>–</Text>
          <Text style={[st.v, { flex: 1, color: '#aaa' }]}>6. Bluetooth (recomendado, verificação em breve)</Text>
        </View>
      </View>
      <TouchableOpacity style={[st.btn, { marginTop: 14 }]} onPress={ir}><Text style={st.btnTx}>CONTINUAR</Text></TouchableOpacity>
    </View>
  );
}

// ---------- 6. Tipo de equipamento ----------
function Equip({ st, onEscolhe, onVoltar }) {
  return (
    <View>
      <Topo st={st} titulo="Tipo de equipamento" onVoltar={onVoltar} />
      <Opcao st={st} t="Navegador (Carro) / Piloto (Moto)" d="Equipamento principal" onPress={() => onEscolhe('principal')} />
      <Opcao st={st} t="Piloto (Carro)" d="Equipamento secundário, espelho do navegador" onPress={() => onEscolhe('piloto')} />
    </View>
  );
}

// ---------- Dados da prova (aparece ao abrir a navegação) ----------
const fmtPub = (ts) => { if (!ts || ts <= 1) return '—'; const d = new Date(ts); const p = (x) => String(x).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} - ${p(d.getHours())}:${p(d.getMinutes())}`; };
export function InfoProva({ visible, info, onOk }) {
  if (!info) return null;
  const L = [['Nome', info.nome || '—'], ['Publicada em', fmtPub(info.pub)], ['Referências', String(info.refs)], ['Trechos', String(info.trechos)], ['Classe', info.classe || '—'], ['Tempo total', hms(info.totalSec)], ['Distância total', info.km.toFixed(3).replace('.', ',') + ' km']];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onOk}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#1b212a', borderWidth: 1, borderColor: '#262b32', borderRadius: 16, padding: 18 }}>
          <Text style={{ color: '#f5f5f5', fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Dados da prova</Text>
          {L.map(([k, v]) => (
            <View key={k} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#262b32' }}>
              <Text style={{ color: '#9aa3ad', fontSize: 13 }}>{k}</Text>
              <Text style={{ color: '#f5f5f5', fontSize: 18, fontWeight: '700' }}>{v}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={onOk} style={{ alignSelf: 'flex-end', paddingVertical: 12, paddingHorizontal: 18, marginTop: 6 }}><Text style={{ color: '#ff7a2e', fontSize: 18, fontWeight: '900' }}>OK</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Modo "apenas datalogger" ----------
export function DlTela({ st, last, pointsN, startedAt, onFinalizar, info }) {
  useKeepAwake();
  const [t, setT] = useState(Date.now());
  const bat = Battery.useBatteryLevel();
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 500); return () => clearInterval(id); }, []);
  const acc = last && last.acc != null ? last.acc : null;
  const stale = !last || t - last.t > 5000;
  const cor = stale || acc == null || acc > 15 ? '#ff5252' : acc > 6 ? '#ffb300' : '#4caf50';
  const d = new Date(t);
  const agora = hms(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());
  const i = info || {};
  const Card = ({ k, v, wide }) => (
    <View style={{ backgroundColor: '#1b212a', borderWidth: 1, borderColor: '#262b32', borderRadius: 12, padding: 10, width: wide ? '100%' : '48.5%', marginBottom: 8 }}>
      <Text style={{ color: '#9aa3ad', fontSize: 12 }}>{k}</Text>
      <Text style={{ color: '#f5f5f5', fontSize: 18, fontWeight: '700' }}>{v}</Text>
    </View>
  );
  return (
    <Modal visible animationType="fade" onRequestClose={() => {}}>
    <ScrollView style={{ flex: 1, backgroundColor: '#0c1014' }} contentContainerStyle={{ paddingTop: 50, paddingHorizontal: 16, paddingBottom: 30 }}>
      <Text style={{ color: '#ff7a2e', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>Datalogger</Text>
      <Text style={{ color: '#f5f5f5', fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>{i.nome || 'Prova'}</Text>
      <Text style={{ color: '#9aa3ad', textAlign: 'center', fontSize: 14 }}>{i.classe ? i.classe : ''}{i.numero ? ` · nº ${i.numero}` : ''}</Text>
      <Text style={{ color: '#9aa3ad', textAlign: 'center', fontSize: 13, marginTop: 18 }}>Relógio oficial</Text>
      <Text style={{ color: '#f5f5f5', fontSize: 54, fontWeight: '800', textAlign: 'center' }}>{agora}</Text>
      <View style={{ borderWidth: 1, borderColor: cor, borderRadius: 12, padding: 10, marginVertical: 12 }}>
        <Text style={{ color: cor, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{stale ? 'Sem sinal GPS' : 'GPS ok'}</Text>
        <Text style={{ color: '#9aa3ad', textAlign: 'center' }}>Precisão: {!stale && acc != null ? acc.toFixed(1) + ' m' : '—'}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Card k="Hora de largada" v={i.largSec != null ? hms(i.largSec) : '—'} />
        <Card k="Final previsto" v={i.largSec != null && i.totalSec ? hms((i.largSec + i.totalSec) % 86400) : '—'} />
        <Card k="Gravando há" v={hms(startedAt ? Math.max(0, (t - startedAt) / 1000) : 0)} />
        <Card k="Pontos · bateria" v={`${pointsN} · ${bat >= 0 ? Math.round(bat * 100) + '%' : '—'}`} />
        <Card k="Planilha publicada em" v={fmtPub(i.pub)} wide />
      </View>
      <Text style={{ color: '#777', textAlign: 'center', marginVertical: 8 }}>Pode bloquear a tela. A gravação continua em segundo plano.</Text>
      <TouchableOpacity style={[st.btn, { backgroundColor: '#c0392b', marginTop: 16 }]} onPress={() => Alert.alert('Finalizar prova', 'Parar a gravação e enviar o datalogger?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Finalizar', style: 'destructive', onPress: onFinalizar }])}>
        <Text style={[st.btnTx, { color: '#fff' }]}>FINALIZAR</Text>
      </TouchableOpacity>
    </ScrollView>
    </Modal>
  );
}

// ---------- Fluxo ----------
export default function Fluxo({ st, user, piloto, provaMap, lib, minhaLarg, largManual, setLargManual, pointsN, dlStat, onEnviarDl, enviandoDl, onEscolher, onAdmin, onPlanilha, onSoDl, onPersonalizar, onPiloto, extra, onZerarDl }) {
  const [tela, setTela] = useState('eventos');
  const [x, setX] = useState(null);
  const [modo, setModo] = useState('planilha');
  return (
    <View>
      {tela === 'eventos' && <Eventos st={st} user={user} onEvento={(e) => { setX(e); onEscolher(e.insc); setTela('evento'); }} onAdmin={onAdmin} />}
      {tela === 'eventos' && extra}
      {tela === 'evento' && x && <Evento st={st} user={user} x={x} provaMap={provaMap} lib={lib} dlStat={dlStat} pointsN={pointsN} onDl={onEnviarDl} enviandoDl={enviandoDl} onIniciar={() => setTela('modo')} onPersonalizar={onPersonalizar} onVoltar={() => setTela('eventos')} onZerarDl={onZerarDl} />}
      {tela === 'modo' && <Modo st={st} onEscolhe={(m) => { setModo(m); setTela('largada'); }} onVoltar={() => setTela('evento')} />}
      {tela === 'largada' && <Largada st={st} minhaLarg={minhaLarg} largManual={largManual} setLargManual={setLargManual} onContinua={() => setTela('config')} onVoltar={() => setTela('modo')} />}
      {tela === 'config' && <Config st={st} onContinua={() => setTela('equip')} onVoltar={() => setTela('largada')} />}
      {tela === 'equip' && <Equip st={st} onVoltar={() => setTela('config')} onEscolhe={(q) => {
        if (q === 'piloto') return onPiloto();
        setTela('evento');
        if (modo === 'dl') onSoDl(); else onPlanilha();
      }} />}
    </View>
  );
}
