// Lista "Minhas provas": criar (com nome), abrir, renomear e apagar (com dupla confirmação).
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { File } from 'expo-file-system';
import { apagarProvaNuvem, criarProva, ouvirMinhasProvas } from './firebase';
import { apagarJson, loadJson, saveJson } from './persist';
import { parseDataBR } from './Fluxo';

export const slugProva = (p) => String(p).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
const km3 = (m) => ((m || 0) / 1000).toFixed(3).replace('.', ',');

export default function ListaProvas({ st, org, onAbrir, onSairOrg }) {
  const [idx, setIdx] = useState(() => loadJson('lev_index', []));
  const [novo, setNovo] = useState('');
  const [cidade, setCidade] = useState('');
  const [dataObj, setDataObj] = useState(null);
  const [form, setForm] = useState(false);
  const dataTx = dataObj ? `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')}/${dataObj.getFullYear()}` : '';
  const escolherData = () => DateTimePickerAndroid.open({ value: dataObj || new Date(), mode: 'date', onChange: (_, d) => { if (d) setDataObj(d); } });
  const [nuvem, setNuvem] = useState([]);
  const [busy, setBusy] = useState(false);
  const [apagando, setApagando] = useState(null);
  const [conf, setConf] = useState('');
  const [renom, setRenom] = useState(null);
  const [nomeEd, setNomeEd] = useState('');
  useEffect(() => ouvirMinhasProvas(setNuvem, () => {}), []);

  const salva = (l) => { setIdx(l); saveJson('lev_index', l); };
  // A lista vem da nuvem (provas criadas na conta); o que o celular guarda (marcas, km) complementa.
  const lista = nuvem.map((n) => { const l = idx.find((x) => x.code === n.code) || {}; return { ...l, code: n.code, nome: n.nome || l.nome || '' }; });

  const criar = async () => {
    const nome = novo.trim();
    if (!nome) return Alert.alert('Falta o nome', 'Dê um nome para a nova prova.');
    const ts = parseDataBR(dataTx);
    if (ts == null) return Alert.alert('Data da prova', 'Escolha a data da prova no calendário.');
    setBusy(true);
    try {
      const code = await criarProva(nome, cidade.trim(), dataTx.trim(), ts);
      saveJson('lev_' + slugProva(code), { iniT: null, marks: [], nome });
      salva([{ code, nome, marcas: 0, km: 0, ts: Date.now() }, ...idx]);
      setNovo(''); setCidade(''); setDataObj(null); setForm(false);
      onAbrir(code, true);
    } catch (e) { Alert.alert('Não criou a prova', String(e?.message || e)); }
    setBusy(false);
  };
  const abrir = (it) => onAbrir(it.code, false);
  const pedeApagar = (it) => Alert.alert('Apagar prova', `Apagar "${it.nome || it.code}"? A prova, as inscrições e os resultados saem da nuvem e as marcas e fotos saem deste celular.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Continuar', style: 'destructive', onPress: () => { setApagando(it); setConf(''); } },
  ]);
  const apagar = async () => {
    const it = apagando;
    try { await apagarProvaNuvem(it.code); } catch (e) { return Alert.alert('Não apagou', String(e?.message || e)); }
    (loadJson('lev_' + slugProva(it.code), { marks: [] }).marks || []).forEach((m) => { try { if (m.foto && String(m.foto).includes('foto_')) new File(m.foto).delete(); } catch {} });
    apagarJson('lev_' + slugProva(it.code));
    apagarJson('base_' + slugProva(it.code));
    salva(idx.filter((x) => x.code !== it.code));
    if (org && org.prova === it.code) onSairOrg();
    setApagando(null);
  };
  const renomear = (it) => {
    const n = nomeEd.trim().slice(0, 60);
    const l = idx.some((x) => x.code === it.code) ? idx.map((x) => (x.code === it.code ? { ...x, nome: n } : x)) : [{ ...it, nome: n }, ...idx];
    salva(l);
    const d = loadJson('lev_' + slugProva(it.code), { iniT: null, marks: [] });
    saveJson('lev_' + slugProva(it.code), { ...d, nome: n });
    setRenom(null);
  };

  return (
    <View>
      <View style={st.card}>
        <Text style={st.tip}>Minhas provas</Text>
        {lista.length === 0 && <Text style={st.tipTx}>Nenhuma prova ainda. Crie a primeira abaixo.</Text>}
        {lista.map((it) => (
          <View key={it.code} style={{ borderTopWidth: 2, borderTopColor: '#444', paddingVertical: 8, marginTop: 6 }}>
            <Text style={st.v}>{it.nome || '(sem nome)'}</Text>
            <Text style={st.tipTx}>Código {it.code} · {it.marcas || 0} marca(s) · {km3(it.km)} km</Text>
            {renom === it.code ? (
              <View>
                <TextInput style={st.field} value={nomeEd} onChangeText={setNomeEd} placeholder="Nome da prova" placeholderTextColor="#666" />
                <View style={[st.row, { marginTop: 6, marginBottom: 0 }]}>
                  <TouchableOpacity style={st.btn2} onPress={() => renomear(it)}><Text style={st.btn2Tx}>Salvar nome</Text></TouchableOpacity>
                  <TouchableOpacity style={st.btn2} onPress={() => setRenom(null)}><Text style={st.btn2Tx}>Cancelar</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[st.row, { marginTop: 6, marginBottom: 0 }]}>
                <TouchableOpacity style={st.btn2} onPress={() => abrir(it)}><Text style={st.btn2Tx}>Abrir</Text></TouchableOpacity>
                <TouchableOpacity style={st.btn2} onPress={() => { setRenom(it.code); setNomeEd(it.nome || ''); }}><Text style={st.btn2Tx}>Renomear</Text></TouchableOpacity>
                <TouchableOpacity style={st.btn2} onPress={() => pedeApagar(it)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar</Text></TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>
      {apagando && (
        <View style={[st.card, { borderColor: '#ff5252', borderWidth: 1 }]}>
          <Text style={[st.tip, { color: '#ff5252' }]}>Apagar "{apagando.nome || apagando.code}"?</Text>
          <Text style={st.tipTx}>Não dá para desfazer. Para confirmar, digite o nome da prova (ou o código, se não tiver nome).</Text>
          <TextInput style={st.field} value={conf} onChangeText={setConf} placeholder={apagando.nome || apagando.code} placeholderTextColor="#666" />
          <View style={[st.row, { marginTop: 8, marginBottom: 0 }]}>
            <TouchableOpacity style={st.btn2} onPress={() => setApagando(null)}><Text style={st.btn2Tx}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[st.btn2, { borderColor: '#ff5252' }]} onPress={() => { if (conf.trim().toLowerCase() !== String(apagando.nome || apagando.code).trim().toLowerCase()) return Alert.alert('Nome diferente', 'Digite exatamente o nome da prova para apagar.'); apagar(); }}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Sim, apagar</Text></TouchableOpacity>
          </View>
        </View>
      )}
      <View style={st.card}>
        <TouchableOpacity style={[st.btn, { marginBottom: 0 }]} onPress={() => setForm(true)}><Text style={st.btnTx}>+ NOVA PROVA</Text></TouchableOpacity>
        <Text style={st.tipTx}>O código (4 números) é gerado sozinho. Os competidores veem a prova em "Provas" quando você inscreve o e-mail deles.</Text>
      </View>
      <Modal visible={form} animationType="slide" onRequestClose={() => setForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0c1014' }} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 50 }}>
            <Text style={[st.tip, { fontSize: 20 }]}>Nova prova</Text>
            <TextInput style={st.field} value={novo} onChangeText={setNovo} placeholder="Nome da prova" placeholderTextColor="#666" />
            <TextInput style={st.field} value={cidade} onChangeText={setCidade} placeholder="Cidade - UF" placeholderTextColor="#666" />
            <TouchableOpacity style={[st.field, { justifyContent: 'center' }]} onPress={escolherData}>
              <Text style={{ color: dataTx ? '#fff' : '#666', fontSize: 16 }}>{dataTx ? `📅  ${dataTx}` : '📅  Escolher a data no calendário'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.btn, { marginTop: 14 }]} onPress={criar} disabled={busy}><Text style={st.btnTx}>{busy ? 'Criando…' : 'Criar prova'}</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setForm(false)}><Text style={st.btn2Tx}>Cancelar</Text></TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
