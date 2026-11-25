// Tela do master: quem está cadastrado no sistema (só cadastro; nada das provas).
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Alert } from 'react-native';
import { MASTERS, ouvirUsuarios, salvarMasters } from './firebase';

export default function UsuariosTela({ st, email, masters = [] }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todos');
  useEffect(() => ouvirUsuarios(setLista, (e) => setErro(String(e?.message || e))), []);
  const org = (u) => !!(u.papeis && u.papeis.organizador);
  const comp = (u) => !!(u.papeis && u.papeis.competidor);
  const vis = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (lista || [])
      .filter((u) => (filtro === 'org' ? org(u) : filtro === 'comp' ? comp(u) : true))
      .filter((u) => !t || [u.email, u.perfil?.nome, u.perfil?.cidade, u.perfil?.equipe].some((x) => String(x || '').toLowerCase().includes(t)))
      .sort((a, b) => String(a.perfil?.nome || a.email).localeCompare(String(b.perfil?.nome || b.email)));
  }, [lista, q, filtro]);
  const chip = (on) => [st.chip, { paddingHorizontal: 12, paddingVertical: 6 }, on && { backgroundColor: '#ff7a2e' }];
  const n = (f) => (lista || []).filter(f).length;
  return (
    <View>
      <Text style={st.tip}>Usuários cadastrados (master)</Text>
      {erro ? <Text style={[st.tipTx, { color: '#ff5252' }]}>Sem permissão ou erro: {erro}. Publique as regras novas do Firebase.</Text> : null}
      {lista == null && !erro && <Text style={st.tipTx}>Carregando…</Text>}
      {lista && (
        <>
          <Text style={st.tipTx}>{lista.length} no total · {n(org)} organizador(es) · {n(comp)} competidor(es)</Text>
          <TextInput style={st.field} value={q} onChangeText={setQ} placeholder="Buscar por nome, e-mail, cidade ou equipe" placeholderTextColor="#666" autoCapitalize="none" />
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {[['todos', 'Todos'], ['org', 'Organizadores'], ['comp', 'Competidores']].map(([k, t]) => (
              <TouchableOpacity key={k} style={chip(filtro === k)} onPress={() => setFiltro(k)}><Text style={[st.btn2Tx, filtro === k && { color: '#0c1014' }]}>{t}</Text></TouchableOpacity>
            ))}
          </View>
          {vis.map((u) => (
            <View key={u.uid} style={[st.card, { marginBottom: 6 }]}>
              <Text style={st.v}>{u.perfil?.nome || u.email || u.uid}</Text>
              <Text style={st.tipTx}>{u.email || '—'}</Text>
              <Text style={{ color: org(u) ? '#4fc3f7' : '#ff7a2e', fontWeight: '700', marginTop: 2 }}>{[org(u) && 'Organizador', comp(u) && 'Competidor'].filter(Boolean).join(' · ') || 'Sem papel escolhido'}</Text>
              {(() => {
                const em = String(u.email || '').toLowerCase();
                if (!em) return null;
                if (MASTERS.includes(em)) return <Text style={{ color: '#4caf50', fontWeight: '800', marginTop: 4 }}>★ MASTER (dono)</Text>;
                const eh = masters.includes(em);
                const alterna = () => Alert.alert(eh ? 'Remover master?' : 'Tornar master?', `${u.perfil?.nome || em} ${eh ? 'perde' : 'passa a ter'} acesso à lista de usuários e ao poder de promover outros masters.`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: eh ? 'Remover' : 'Tornar master', style: eh ? 'destructive' : 'default', onPress: () => salvarMasters(eh ? masters.filter((x) => x !== em) : [...masters, em]).catch((e) => Alert.alert('Não salvou', String(e?.message || e))) },
                ]);
                return <TouchableOpacity onPress={alterna}><Text style={{ color: eh ? '#ff5252' : '#4fc3f7', fontWeight: '800', marginTop: 6 }}>{eh ? '★ Master · remover' : 'Tornar master'}</Text></TouchableOpacity>;
              })()}
              {(u.perfil?.cidade || u.perfil?.equipe || u.perfil?.telefone) ? <Text style={st.tipTx}>{[u.perfil?.cidade, u.perfil?.equipe, u.perfil?.telefone].filter(Boolean).join(' · ')}</Text> : null}
            </View>
          ))}
          {vis.length === 0 && <Text style={st.tipTx}>Ninguém encontrado.</Text>}
        </>
      )}
    </View>
  );
}
