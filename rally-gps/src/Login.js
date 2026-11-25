// Entrada por e-mail e senha. O mesmo e-mail pode ter cadastro de Competidor e de Organizador.
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { addPapel, criarConta, entrarConta, recuperarSenha } from './firebase';

const msg = (e) => {
  const c = String(e?.code || '');
  if (c.includes('invalid-email')) return 'E-mail inválido.';
  if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential')) return 'E-mail ou senha incorretos. Se ainda não tem conta, toque em "Criar conta".';
  if (c.includes('email-already-in-use')) return 'Este e-mail já tem conta. Use "Entrar".';
  if (c.includes('weak-password')) return 'Senha fraca: use pelo menos 6 caracteres.';
  if (c.includes('network')) return 'Sem internet. Tente de novo.';
  if (c.includes('operation-not-allowed')) return 'Login por e-mail ainda não está ativado no Firebase.';
  return String(e?.message || e);
};

export default function Login({ st, onEntrou, soOrganizador }) {
  const [papel, setPapel] = useState(soOrganizador ? 'organizador' : 'competidor');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [criar, setCriar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ver, setVer] = useState(false);
  const { width, height } = useWindowDimensions();

  const ir = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('E-mail', 'Digite um e-mail válido.');
    if (senha.length < 6) return Alert.alert('Senha', 'A senha precisa de pelo menos 6 caracteres.');
    setBusy(true);
    try {
      const u = criar ? await criarConta(email, senha) : await entrarConta(email, senha);
      await addPapel(u.uid, email, papel);
      onEntrou(papel);
    } catch (e) { Alert.alert(criar ? 'Não criou a conta' : 'Não entrou', msg(e)); }
    setBusy(false);
  };
  const esqueci = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('E-mail', 'Digite seu e-mail acima e toque de novo.');
    try { await recuperarSenha(email); Alert.alert('Enviado', 'Mandamos um link para redefinir a senha no seu e-mail.'); }
    catch (e) { Alert.alert('Não enviou', msg(e)); }
  };
  const wide = width >= 760;
  const AZUL = '#2fb6d3';
  const chip = (id, tx) => (
    <TouchableOpacity key={id} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5, borderColor: '#fff', backgroundColor: papel === id ? '#fff' : 'transparent' }} onPress={() => setPapel(id)}>
      <Text style={{ color: papel === id ? AZUL : '#fff', fontWeight: '700', fontSize: 14 }}>{tx}</Text>
    </TouchableOpacity>
  );
  const campo = { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, height: 52, paddingHorizontal: 14, marginBottom: 16 };
  const input = { flex: 1, color: '#222', fontSize: 16, height: '100%', outlineStyle: 'none', borderWidth: 0 };
  const marca = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Svg width={34} height={34} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="2" /><Path d="M12 5 L16 17 L12 14 L8 17 Z" fill="#fff" /></Svg>
      <View>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 1 }}>RALLY GPS</Text>
        {soOrganizador ? <Text style={{ color: '#fff', fontSize: 12, letterSpacing: 2 }}>ORGANIZADOR</Text> : null}
      </View>
    </View>
  );
  const arte = (h) => (
    <View style={{ height: h, width: '100%', backgroundColor: '#8a5516', overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
        <Rect width="400" height="600" fill="#8a5516" />
        <Path d="M0 90 C60 70 120 100 200 80 C280 60 340 90 400 70 L400 0 L0 0 Z" fill="#9c6420" />
        <Path d="M-20 620 C60 470 150 400 230 300 C300 215 370 130 430 -20 L430 70 C380 150 320 230 270 310 C200 410 120 520 60 640 Z" fill="#e0a352" />
        <Path d="M-20 620 C60 470 150 400 230 300 C300 215 370 130 430 -20" stroke="#c98a37" strokeWidth="6" fill="none" />
        <Path d="M10 380 C60 360 110 380 170 350" stroke="#6b3f0f" strokeWidth="3" fill="none" opacity="0.45" />
        <Path d="M250 520 C300 490 350 480 410 450" stroke="#6b3f0f" strokeWidth="3" fill="none" opacity="0.45" />
        <Path d="M300 380 C330 360 360 370 400 340" stroke="#6b3f0f" strokeWidth="3" fill="none" opacity="0.35" />
        <Rect x="236" y="285" width="34" height="16" rx="7" fill="#18b8e8" transform="rotate(-40 253 293)" />
        <Rect x="246" y="288" width="12" height="9" rx="3" fill="#0b6a8c" transform="rotate(-40 253 293)" />
      </Svg>
    </View>
  );
  const form = (
    <View style={{ width: '100%', maxWidth: 400 }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>Login</Text>
      <Text style={{ color: '#fff', fontSize: 20, marginBottom: 24 }}>{criar ? 'Crie sua conta para continuar' : 'Informe seus dados para continuar'}</Text>
      {!soOrganizador && <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>{chip('competidor', 'Competidor')}{chip('organizador', 'Organizador')}</View>}
      <View style={campo}>
        <TextInput style={input} value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor="#888" autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={ir} />
        <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M3 6h18v12H3z M3 7l9 6 9-6" fill="none" stroke="#777" strokeWidth="1.6" strokeLinejoin="round" /></Svg>
      </View>
      <View style={campo}>
        <TextInput style={input} value={senha} onChangeText={setSenha} placeholder="Senha" placeholderTextColor="#888" secureTextEntry={!ver} autoCapitalize="none" autoComplete="password" onSubmitEditing={ir} />
        <TouchableOpacity onPress={() => setVer(!ver)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="#777" strokeWidth="1.6" /><Circle cx="12" cy="12" r="3" fill="none" stroke="#777" strokeWidth="1.6" />{ver ? null : <Path d="M4 4l16 16" stroke="#777" strokeWidth="1.8" />}</Svg>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={{ height: 50, borderWidth: 1.5, borderColor: '#fff', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 }} onPress={ir} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 }}>{criar ? 'CRIAR CONTA' : 'ENTRAR'}</Text>}
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <TouchableOpacity onPress={() => setCriar(!criar)}><Text style={{ color: '#fff', textDecorationLine: 'underline', fontSize: 14 }}>{criar ? 'Já tenho conta' : 'Criar conta'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={esqueci}><Text style={{ color: '#fff', textDecorationLine: 'underline', fontSize: 14 }}>Esqueci a senha</Text></TouchableOpacity>
      </View>
      <Text style={{ color: '#fff', opacity: 0.9, fontSize: 13, marginTop: 22, lineHeight: 18 }}>{papel === 'competidor' ? 'Use o e-mail que o organizador cadastrou na sua inscrição. As provas aparecem sozinhas.' : 'Organizador cria as provas, levanta o percurso e inscreve os competidores.'}</Text>
    </View>
  );
  if (wide) {
    return (
      <View style={{ flex: 1, minHeight: height, flexDirection: 'row', backgroundColor: AZUL }}>
        <ScrollView style={{ width: Math.min(480, Math.max(380, width * 0.38)), flexGrow: 0 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 44 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 48 }}>{marca}</View>
          {form}
        </ScrollView>
        <View style={{ flex: 1 }}>
          {arte('100%')}
          <View style={{ position: 'absolute', left: 60, top: '14%' }}>
            <Text style={{ color: '#fff', fontSize: Math.min(60, width * 0.045), fontWeight: '800', lineHeight: Math.min(68, width * 0.052) }}>Navegue o{'\n'}rally com <Text style={{ color: '#18d0ff' }}>precisão</Text></Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: AZUL }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View>
        {arte(150)}
        <View style={{ position: 'absolute', left: 20, bottom: 14 }}>{marca}</View>
      </View>
      <View style={{ padding: 24, alignItems: 'center', backgroundColor: AZUL, flexGrow: 1 }}>{form}</View>
    </ScrollView>
  );
}
