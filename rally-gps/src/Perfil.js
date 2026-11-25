// Perfil do cadastro: dados completos do competidor/organizador (salvos na conta, valem em qualquer aparelho).
import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Seguro from './Seguro';
import { COR, Cab } from './Pos';
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
  const pct = Math.round((feitos / CAMPOS.length) * 100);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}><Seguro>
      <View style={{ flex: 1, backgroundColor: COR.fundo }}>
        <Cab titulo="Perfil" azul onVoltar={onClose} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: COR.tx2 }}>{user.email} · {papel === 'organizador' ? 'Organizador' : 'Competidor'}</Text>
          <View style={{ backgroundColor: '#dde3e8', borderRadius: 10, height: 8, marginVertical: 10, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: 8, backgroundColor: COR.verde }} /></View>
          <Text style={{ color: COR.tx2, marginBottom: 10 }}>Perfil {pct}% completo. Quanto mais completo, mais fácil para o organizador e para o resgate em caso de emergência.</Text>
          {carregado && CAMPOS.map(([k, rot, kb]) => (
            <View key={k} style={{ marginBottom: 12 }}>
              <Text style={{ color: COR.azulTx, fontSize: 13, marginBottom: 2 }}>{rot}</Text>
              <TextInput style={{ color: COR.tx, fontSize: 16, borderBottomWidth: 1, borderBottomColor: '#b8c4cc', paddingVertical: 6 }} value={d[k] || ''} onChangeText={(v) => setD((o) => ({ ...o, [k]: v }))} keyboardType={kb} placeholderTextColor="#9aa5ae" autoCapitalize={k === 'placa' ? 'characters' : 'words'} />
            </View>
          ))}
          {msg ? <Text style={{ color: msg.includes('✓') ? COR.verde : '#b26a00', marginBottom: 8 }}>{msg}</Text> : null}
        </ScrollView>
        <TouchableOpacity onPress={salvar} style={{ backgroundColor: COR.azul, paddingVertical: 18, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>SALVAR PERFIL</Text></TouchableOpacity>
      </View>
    </Seguro></Modal>
  );
}
