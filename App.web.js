// Versão para o navegador do computador: só o modo organizador (planilha, inscrições, resultados, track log).
import { Component, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Cab } from './src/Pos';
import Login from './src/Login';
import Organizador from './src/Organizador';
import OverlayRoot from './src/Overlay';
import { TrilhasOrg } from './src/Trilhas';
import { st as stDark, stClaro as st } from './src/estilos';
import { VERSAO } from './src/versao';
import { ouvirAuth, ouvirProva, sairConta } from './src/firebase';
import { loadJson, saveJson } from './src/persist';

// Fonte do editor de planilha (mesma família do Kraken).
if (typeof document !== 'undefined' && !document.getElementById('fonte-montserrat')) {
  const l = document.createElement('link');
  l.id = 'fonte-montserrat'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(l);
}
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
  const [menu, setMenu] = useState(false);
  useEffect(() => ouvirAuth((u) => setUser(u || null)), []);
  useEffect(() => {
    if (!prova.trim()) { setProvaMap(VAZIO); return undefined; }
    setProvaMap(VAZIO);
    return ouvirProva(prova, (d) => setProvaMap({ code: String(prova).trim().toUpperCase().replace(/[^A-Z0-9]+/g, ''), wps: pair(d.wps || []), coords: pair(d.rota || []), legs: d.legs || [], kmh: d.kmh || [], tul: d.tul || [], trechos: d.trechos || [], trs: d.trs || [], categorias: d.categorias || [], lib: d.lib || {}, refs: d.refs || [], pcl: d.pcl || [], pub: d.publicadoEm || 1, lev: d.lev || null, ed: d.ed || {}, ex: d.ex || [], cg: !!d.cg }), () => {});
  }, [prova]);
  const escolher = (p) => { setProva(p); saveJson('piloto', { ...loadJson('piloto', {}), prova: p }); };
  const caixa = { width: '100%' };
  if (user === undefined) return <View style={[stDark.root, { justifyContent: 'center' }]}><Text style={[stDark.sub, { textAlign: 'center' }]}>Carregando…</Text></View>;
  if (!user) return <View style={{ flex: 1 }}><Login st={stDark} soOrganizador onEntrou={() => {}} /><Text style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', color: '#6b7480', fontSize: 11 }}>{VERSAO}</Text></View>;
  return (
    <ScrollView style={[st.root, { backgroundColor: '#fafafa' }]} contentContainerStyle={[st.wrap, caixa, { padding: 0, paddingTop: 0, paddingBottom: 0 }]} keyboardShouldPersistTaps="handled">
      {mod === 'trilhas' ? (
        <View>
          <Cab titulo="Trilhas" azul onVoltar={() => setMod('rally')} />
          <View style={{ padding: 16, width: '100%', maxWidth: 900, alignSelf: 'center' }}><TrilhasOrg st={st} /></View>
        </View>
      ) : <Organizador st={st} onMenu={() => setMenu(true)} onProva={escolher} prova={prova} provaMap={provaMap} last={null} onOrg={setOrg} abrirReq={abrirReq} onTab={(t) => { if (t === 'trilhas') setMod('trilhas'); }} />}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setMenu(false)}>
          <View style={{ position: 'absolute', top: 44, right: 10, width: 260, backgroundColor: '#fff', paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 10 }}>
            <Text style={{ color: '#6b7480', fontSize: 12, paddingHorizontal: 18, paddingVertical: 8 }}>{user.email}</Text>
            <TouchableOpacity onPress={() => { setMenu(false); setMod('rally'); }} style={{ paddingVertical: 12, paddingHorizontal: 18 }}><Text style={{ color: '#1c1c1c', fontSize: 15, fontWeight: '600' }}>Eventos</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setMenu(false); setMod('trilhas'); }} style={{ paddingVertical: 12, paddingHorizontal: 18 }}><Text style={{ color: '#1c1c1c', fontSize: 15, fontWeight: '600' }}>Trilhas</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setMenu(false); sairConta().catch(() => {}); }} style={{ paddingVertical: 12, paddingHorizontal: 18 }}><Text style={{ color: '#1c1c1c', fontSize: 15, fontWeight: '600' }}>Sair</Text></TouchableOpacity>
            <Text style={{ color: '#9aa5ae', fontSize: 11, textAlign: 'center', paddingVertical: 4 }}>Rally GPS · {VERSAO}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// Se algo quebrar depois do login, mostra o erro na tela (em vez de tela branca) para dar para corrigir.
class Falha extends Component {
  constructor(p) { super(p); this.state = { erro: null }; }
  static getDerivedStateFromError(erro) { return { erro }; }
  render() {
    if (!this.state.erro) return this.props.children;
    const e = this.state.erro;
    return (
      <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#c0392b' }}>Algo deu errado ({VERSAO})</Text>
        <Text selectable style={{ marginTop: 10, color: '#222' }}>{String((e && e.message) || e)}</Text>
        <Text selectable style={{ marginTop: 10, color: '#666', fontSize: 11 }}>{String((e && e.stack) || '').slice(0, 900)}</Text>
        <TouchableOpacity onPress={() => { try { window.location.reload(); } catch {} }} style={{ marginTop: 16, backgroundColor: '#31b9d3', padding: 12, borderRadius: 6, alignSelf: 'flex-start' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Recarregar</Text></TouchableOpacity>
      </View>
    );
  }
}

// ?overlay=CODIGO abre só o overlay da transmissão (fundo transparente, para a Fonte de Navegador do OBS).
export default function App() {
  let q = null;
  try { q = new URLSearchParams(window.location.search); } catch {}
  if (q && q.get('overlay')) return <OverlayRoot code={q.get('overlay')} delay={Number(q.get('delay')) || 0} car={q.get('car') || ''} teste={!!q.get('teste')} />;
  return <Falha><AppOrg /></Falha>;
}
