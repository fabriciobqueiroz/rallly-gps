// Fluxo do competidor: eventos → evento → modo de uso → largada → configurações → equipamento → prova.
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MeuTrackLog } from './TrackLog';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { useKeepAwake } from 'expo-keep-awake';
import { loadJson, saveJson } from './persist';
import { lerProva, ouvirMinhasInscricoes, ouvirMinhasProvas, ouvirRanking } from './firebase';
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

// ---------- 1. Escolha o evento ----------
function Eventos({ st, user, onEvento, onAdmin }) {
  const c0 = loadJson('evcache', { insc: [], donos: [], provas: {} });
  const [insc, setInsc] = useState(c0.insc);
  const [donos, setDonos] = useState(c0.donos);
  const [provas, setProvas] = useState(c0.provas);
  const [erro, setErro] = useState('');
  useEffect(() => ouvirMinhasInscricoes(user.email, (l) => { setInsc(l); setErro(''); }, () => setErro('Sem conexão: mostrando o que está salvo no celular.')), [user.email]);
  useEffect(() => ouvirMinhasProvas(setDonos, () => {}), [user.uid]);
  useEffect(() => {
    insc.forEach((i) => { if (!provas[i.prova]) lerProva(i.prova).then((d) => d && setProvas((p) => ({ ...p, [i.prova]: d }))).catch(() => {}); });
  }, [insc]);
  useEffect(() => { saveJson('evcache', { insc, donos, provas }); }, [insc, donos, provas]);

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = (ts) => (ts == null ? null : Math.round((ts - hoje.getTime()) / 86400000));
  const adm = donos.map((x) => ({ kind: 'adm', code: x.code, nome: x.nome || 'Prova ' + x.code, cidade: x.cidade, data: x.data, ts: x.dataTs ?? parseDataBR(x.data) }));
  const comp = insc.map((i) => { const p = provas[i.prova] || {}; return { kind: 'comp', code: i.prova, nome: i.provaNome || p.nome || 'Prova ' + i.prova, cidade: p.cidade, data: p.data, ts: p.dataTs ?? parseDataBR(p.data), insc: i }; });
  const ord = (a) => [...a].sort((x, y) => (y.ts ?? -1) - (x.ts ?? -1));
  const todos = [...adm, ...comp];
  const sHoje = todos.filter((x) => dias(x.ts) === 0);
  const sAman = todos.filter((x) => dias(x.ts) === 1);
  const resto = (a) => ord(a.filter((x) => ![0, 1].includes(dias(x.ts))));
  const Cartao = ({ x, tag }) => (
    <TouchableOpacity style={[st.card, { marginBottom: 8 }]} onPress={() => (x.kind === 'adm' ? onAdmin(x) : onEvento(x))}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{x.nome}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={st.tipTx}>{x.cidade || '—'}</Text><Text style={st.tipTx}>{x.data || ''}</Text>
      </View>
      {tag ? <Text style={[st.tipTx, { color: '#4fc3f7' }]}>{x.kind === 'adm' ? 'Organizador' : 'Competidor'}</Text> : null}
      {x.kind === 'comp' && temCache(x.code) ? <Text style={[st.tipTx, { color: '#4caf50' }]}>Disponível offline ✓</Text> : null}
    </TouchableOpacity>
  );
  const Sec = ({ t, a, tag }) => (a.length ? <View style={{ marginTop: 6 }}><Text style={[st.tip, { marginBottom: 6 }]}>{t}</Text>{a.map((x) => <Cartao key={x.kind + x.code + (x.insc?.numero || '')} x={x} tag={tag} />)}</View> : null);
  return (
    <View>
      <Topo st={st} titulo="Escolha o evento" />
      {erro ? <Text style={[st.tipTx, { color: '#ffb300' }]}>{erro}</Text> : null}
      <Sec t="Hoje" a={sHoje} tag /><Sec t="Amanhã" a={sAman} tag />
      <Sec t="Admin" a={resto(adm)} /><Sec t="Eventos inscritos" a={resto(comp)} />
      {todos.length === 0 && <View style={st.card}><Text style={st.tipTx}>Nenhum evento ainda. Se você é competidor, peça ao organizador para inscrever o e-mail {user.email}. Se é organizador, crie a prova na aba Organizar.</Text></View>}
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

// ---------- Modo "apenas datalogger" ----------
export function DlTela({ st, last, pointsN, startedAt, onFinalizar }) {
  useKeepAwake();
  const [t, setT] = useState(Date.now());
  const bat = Battery.useBatteryLevel();
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 500); return () => clearInterval(id); }, []);
  const acc = last && last.acc != null ? last.acc : null;
  const stale = !last || t - last.t > 5000;
  const cor = stale || acc == null || acc > 15 ? '#ff5252' : acc > 6 ? '#ffb300' : '#4caf50';
  return (
    <Modal visible animationType="fade" onRequestClose={() => {}}>
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 50, paddingHorizontal: 16 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Gravando datalogger</Text>
      <Text style={{ color: cor, fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 20 }}>{stale ? 'GPS sem sinal' : `GPS ${acc != null ? acc.toFixed(1) + ' m' : ''}`}</Text>
      <Text style={{ color: '#fff', fontSize: 56, fontWeight: '800', textAlign: 'center', marginTop: 24 }}>{hms(startedAt ? Math.max(0, (t - startedAt) / 1000) : 0)}</Text>
      <Text style={{ color: '#aaa', textAlign: 'center', fontSize: 16 }}>{pointsN} pontos · bateria {bat >= 0 ? Math.round(bat * 100) + '%' : '—'}</Text>
      <Text style={{ color: '#777', textAlign: 'center', marginTop: 16 }}>Pode bloquear a tela. A gravação continua em segundo plano.</Text>
      <TouchableOpacity style={[st.btn, { backgroundColor: '#c0392b', marginTop: 40 }]} onPress={() => Alert.alert('Finalizar prova', 'Parar a gravação e enviar o datalogger?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Finalizar', style: 'destructive', onPress: onFinalizar }])}>
        <Text style={[st.btnTx, { color: '#fff' }]}>FINALIZAR</Text>
      </TouchableOpacity>
    </View>
    </Modal>
  );
}

// ---------- Fluxo ----------
export default function Fluxo({ st, user, piloto, provaMap, lib, minhaLarg, largManual, setLargManual, pointsN, dlStat, onEnviarDl, enviandoDl, onEscolher, onAdmin, onPlanilha, onSoDl, onPersonalizar, onPiloto, onZerarDl }) {
  const [tela, setTela] = useState('eventos');
  const [x, setX] = useState(null);
  const [modo, setModo] = useState('planilha');
  return (
    <View>
      {tela === 'eventos' && <Eventos st={st} user={user} onEvento={(e) => { setX(e); onEscolher(e.insc); setTela('evento'); }} onAdmin={onAdmin} />}
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
