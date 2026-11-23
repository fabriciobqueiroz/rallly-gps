// Perfil do cadastro: dados completos do competidor/organizador (salvos na conta, valem em qualquer aparelho).
import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Seguro from './Seguro';
import { lerPerfil, salvarDadosPerfil } from './firebase';

const CAMPOS = [
  ['nome', 'Nome completo', 'default'], ['telefone', 'Telefone / WhatsApp', 'phone-pad'], ['cidade', 'Cidade', 'default'], ['equipe', 'Equipe', 'default'],
  ['veiculo', 'Veículo (marca e modelo)', 'default'], ['placa', 'Placa', 'default'],
  ['sangue', 'Tipo sanguíneo', 'default'], ['saude', 'Alergias / observações de saúde', 'default'],
  ['emergNome', 'Contato de emergência (nome)', 'default'], ['emergTel', 'Contato de emergência (telefone)', 'phone-pad'],
];

export default function PerfilTela({ st, user, papel, onClose, onSalvo }) {
  const [d, setD] = useState({});
  const [msg, setMsg] = useState('');
  const [carregado, setCarregado] = useState(false);
  useEffect(() => { lerPerfil(user.uid).then((p) => { setD(p.perfil || {}); setCarregado(true); }).catch(() => { setMsg('Sem conexão: não deu para carregar o perfil.'); setCarregado(true); }); }, [user.uid]);
  const feitos = CAMPOS.filter(([k]) => String(d[k] || '').trim()).length;
  const salvar = async () => {
    setMsg('Salvando…');
    try { await salvarDadosPerfil(user.uid, d); setMsg('Perfil salvo ✓'); onSalvo && onSalvo(d); }
    catch { setMsg('Não salvou (sem conexão?). Tente de novo.'); }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}><Seguro>
      <ScrollView style={{ flex: 1, backgroundColor: '#0c1014' }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#ff7a2e', fontSize: 26, fontWeight: '900' }}>Perfil</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}><Text style={{ color: '#f5f5f5', fontSize: 18, fontWeight: '800' }}>Fechar</Text></TouchableOpacity>
        </View>
        <Text style={{ color: '#9aa3ad', marginTop: 4 }}>{user.email} · {papel === 'organizador' ? 'Organizador' : 'Competidor'}</Text>
        <View style={{ backgroundColor: '#1b212a', borderRadius: 10, height: 10, marginVertical: 10, overflow: 'hidden' }}><View style={{ width: `${Math.round((feitos / CAMPOS.length) * 100)}%`, height: 10, backgroundColor: '#4caf50' }} /></View>
        <Text style={{ color: '#9aa3ad', marginBottom: 8 }}>Perfil {Math.round((feitos / CAMPOS.length) * 100)}% completo. Quanto mais completo, mais fácil para o organizador e para o resgate em caso de emergência.</Text>
        {carregado && CAMPOS.map(([k, rot, kb]) => (
          <View key={k} style={{ marginBottom: 10 }}>
            <Text style={{ color: '#9aa3ad', fontSize: 13, marginBottom: 3 }}>{rot}</Text>
            <TextInput style={st.field} value={d[k] || ''} onChangeText={(v) => setD((o) => ({ ...o, [k]: v }))} keyboardType={kb} placeholder={rot} placeholderTextColor="#666" autoCapitalize={k === 'placa' ? 'characters' : 'words'} />
          </View>
        ))}
        {msg ? <Text style={{ color: msg.includes('✓') ? '#4caf50' : '#ffb300', marginBottom: 8 }}>{msg}</Text> : null}
        <TouchableOpacity style={[st.btn, { backgroundColor: '#ff7a2e' }]} onPress={salvar}><Text style={st.btnTx}>SALVAR PERFIL</Text></TouchableOpacity>
      </ScrollView>
    </Seguro></Modal>
  );
}
