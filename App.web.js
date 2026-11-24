// Versão para o navegador do computador: só o modo organizador (planilha, inscrições, resultados, track log).
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Login from './src/Login';
import Organizador from './src/Organizador';
import OverlayRoot from './src/Overlay';
import { TrilhasOrg } from './src/Trilhas';
import { st } from './src/estilos';
import { ouvirAuth, ouvirProva, sairConta } from './src/firebase';
import { loadJson, saveJson } from './src/persist';

// No navegador o Alert do React Native não faz nada: troca por caixas do próprio navegador.
Alert.alert = (titulo, msg, botoes) => {
  const texto = [titulo, msg].filter(Boolean).join('\n\n');
  const bs = botoes && botoes.length ? botoes : [{ text: 'OK' }];
  if (bs.length < 2) { window.alert(texto); if (bs[0] && bs[0].onPress) bs[0].onPress(); return; }
  const cancel = bs.find((b) => b.style === 'cancel');
  const acao = bs.find((b) => b.style !== 'cancel');
  const ok = window.confirm(texto + '\n\nOK = ' + (acao && acao.text ? acao.text : 'Confirmar') + ' · Cancelar = ' + (cancel && cancel.text ? cancel.text : 'Voltar'));
  const b = ok ? acao : cancel;
  if (b && b.onPress) b.onPress();
};

const VAZIO = { wps: [], coords: [], legs: [], kmh: [], tul: [], trechos: [], trs: [], categorias: [], lib: {}, refs: [], pcl: [], pub: 0, lev: null };
const pair = (a) => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };

function AppOrg() {
  const [user, setUser] = useState(undefined);
  const [prova, setProva] = useState(() => loadJson('piloto', {}).prova || '');
  const [provaMap, setProvaMap] = useState(VAZIO);
  const [, setOrg] = useState(null);
  const [mod, setMod] = useState('rally');
  const [abrirReq] = useState(null);
  useEffect(() => ouvirAuth((u) => setUser(u || null)), []);
  useEffect(() => {
    if (!prova.trim()) { setProvaMap(VAZIO); return undefined; }
    setProvaMap(VAZIO);
    return ouvirProva(prova, (d) => setProvaMap({ code: String(prova).trim().toUpperCase().replace(/[^A-Z0-9]+/g, ''), wps: pair(d.wps || []), coords: pair(d.rota || []), legs: d.legs || [], kmh: d.kmh || [], tul: d.tul || [], trechos: d.trechos || [], trs: d.trs || [], categorias: d.categorias || [], lib: d.lib || {}, refs: d.refs || [], pcl: d.pcl || [], pub: d.publicadoEm || 1, lev: d.lev || null }), () => {});
  }, [prova]);
  const escolher = (p) => { setProva(p); saveJson('piloto', { ...loadJson('piloto', {}), prova: p }); };
  const caixa = { width: '100%', maxWidth: 1100, alignSelf: 'center' };
  if (user === undefined) return <View style={[st.root, { justifyContent: 'center' }]}><Text style={[st.sub, { textAlign: 'center' }]}>Carregando…</Text></View>;
  if (!user) return (
    <ScrollView style={st.root} contentContainerStyle={[st.wrap, caixa]}>
      <Text style={st.h1}>Rally GPS · Organizador</Text>
      <Login st={st} soOrganizador onEntrou={() => {}} />
    </ScrollView>
  );
  return (
    <ScrollView style={st.root} contentContainerStyle={[st.wrap, caixa]} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>Rally GPS · Organizador</Text>
      <View style={[st.row, { alignItems: 'center' }]}>
        <Text style={[st.sub, { flex: 1 }]}>{user.email}</Text>
        <TouchableOpacity onPress={() => { sairConta().catch(() => {}); }}><Text style={{ color: '#ff5252', fontWeight: '800' }}>Sair</Text></TouchableOpacity>
      </View>
      <View style={[st.row, { marginBottom: 8 }]}>
        <TouchableOpacity style={[st.chip, { paddingHorizontal: 16, paddingVertical: 8 }, mod === 'rally' && { backgroundColor: '#ff7a2e' }]} onPress={() => setMod('rally')}><Text style={[st.btn2Tx, mod === 'rally' && { color: '#0c1014' }]}>Rally</Text></TouchableOpacity>
        <TouchableOpacity style={[st.chip, { paddingHorizontal: 16, paddingVertical: 8 }, mod === 'trilhas' && { backgroundColor: '#ff7a2e' }]} onPress={() => setMod('trilhas')}><Text style={[st.btn2Tx, mod === 'trilhas' && { color: '#0c1014' }]}>Trilhas</Text></TouchableOpacity>
      </View>
      {mod === 'trilhas' ? <TrilhasOrg st={st} /> : <Organizador st={st} onProva={escolher} prova={prova} provaMap={provaMap} last={null} onOrg={setOrg} abrirReq={abrirReq} onTab={() => {}} />}
    </ScrollView>
  );
}

// ?overlay=CODIGO abre só o overlay da transmissão (fundo transparente, para a Fonte de Navegador do OBS).
export default function App() {
  let q = null;
  try { q = new URLSearchParams(window.location.search); } catch {}
  if (q && q.get('overlay')) return <OverlayRoot code={q.get('overlay')} delay={Number(q.get('delay')) || 0} car={q.get('car') || ''} teste={!!q.get('teste')} />;
  return <AppOrg />;
}
