// Versão para o navegador do computador: só o modo organizador (planilha, inscrições, resultados, track log).
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Login from './src/Login';
import Organizador from './src/Organizador';
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

const VAZIO = { wps: [], coords: [], legs: [], kmh: [], tul: [], trechos: [], trs: [], categorias: [], lib: {}, refs: [], pcl: [], pub: 0 };
const pair = (a) => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };

export default function App() {
  const [user, setUser] = useState(undefined);
  const [prova, setProva] = useState(() => loadJson('piloto', {}).prova || '');
  const [provaMap, setProvaMap] = useState(VAZIO);
  const [, setOrg] = useState(null);
  const [abrirReq] = useState(null);
  useEffect(() => ouvirAuth((u) => setUser(u || null)), []);
  useEffect(() => {
    if (!prova.trim()) { setProvaMap(VAZIO); return undefined; }
    return ouvirProva(prova, (d) => setProvaMap({ wps: pair(d.wps || []), coords: pair(d.rota || []), legs: d.legs || [], kmh: d.kmh || [], tul: d.tul || [], trechos: d.trechos || [], trs: d.trs || [], categorias: d.categorias || [], lib: d.lib || {}, refs: d.refs || [], pcl: d.pcl || [], pub: d.publicadoEm || 1 }), () => {});
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
      <Organizador st={st} onProva={escolher} prova={prova} provaMap={provaMap} last={null} onOrg={setOrg} abrirReq={abrirReq} onTab={() => {}} />
    </ScrollView>
  );
}
