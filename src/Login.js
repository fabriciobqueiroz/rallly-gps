// Entrada por e-mail e senha. O mesmo e-mail pode ter cadastro de Competidor e de Organizador.
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const chip = (id, tx) => (
    <TouchableOpacity style={[st.btn2, papel === id && { backgroundColor: '#ff7a2e' }]} onPress={() => setPapel(id)}>
      <Text style={[st.btn2Tx, papel === id && { color: '#0c1014' }]}>{tx}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={st.card}>
      {!soOrganizador && <Text style={st.tip}>Entrar como</Text>}
      {!soOrganizador && <View style={st.row}>{chip('competidor', 'Competidor')}{chip('organizador', 'Organizador')}</View>}
      <TextInput style={st.field} value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor="#666" autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={st.field} value={senha} onChangeText={setSenha} placeholder="Senha (mínimo 6)" placeholderTextColor="#666" secureTextEntry autoCapitalize="none" />
      <TouchableOpacity style={[st.btn, { marginTop: 10, marginBottom: 0 }]} onPress={ir} disabled={busy}>
        {busy ? <ActivityIndicator color="#0c1014" /> : <Text style={st.btnTx}>{criar ? 'Criar conta' : 'Entrar'}</Text>}
      </TouchableOpacity>
      <View style={[st.row, { marginTop: 10, marginBottom: 0 }]}>
        <TouchableOpacity style={st.btn2} onPress={() => setCriar(!criar)}><Text style={st.btn2Tx}>{criar ? 'Já tenho conta' : 'Criar conta'}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={esqueci}><Text style={st.btn2Tx}>Esqueci a senha</Text></TouchableOpacity>
      </View>
      <Text style={st.tipTx}>{papel === 'competidor' ? 'Use o e-mail que o organizador cadastrou na sua inscrição. As provas aparecem sozinhas.' : 'Organizador cria as provas, levanta o percurso e inscreve os competidores.'}</Text>
    </View>
  );
}
