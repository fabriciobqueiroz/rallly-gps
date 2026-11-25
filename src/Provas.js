// Lista "Minhas provas": criar (com nome), abrir, renomear e apagar (com dupla confirmação).
import { useEffect, useState } from 'react';
import Tela from './Tela';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { COR, Cab } from './Pos';
import { DateTimePickerAndroid } from './pickers';
import { File } from 'expo-file-system';
import { apagarProvaNuvem, criarProva, ouvirMinhasProvas, salvarProva } from './firebase';
import { apagarJson, loadJson, saveJson } from './persist';
import { parseDataBR } from './Fluxo';

export const slugProva = (p) => String(p).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
// Apaga tudo o que o celular guardou sobre um código de prova (o código pode ser sorteado de novo mais tarde).
export function limparProvaLocal(code) {
  const c = slugProva(code);
  ['lev_', 'levpend_', 'levbak_', 'levw_', 'base_', 'prova_'].forEach((k) => apagarJson(k + c));
  const limpa = (nome, ok) => { const o = loadJson(nome, {}); let mudou = false; Object.keys(o).forEach((k) => { if (!ok(k)) { delete o[k]; mudou = true; } }); if (mudou) saveJson(nome, o); };
  limpa('dlstat', (k) => !k.startsWith(c + '_'));
  limpa('largm', (k) => k !== c);
}
const km3 = (m) => ((m || 0) / 1000).toFixed(3).replace('.', ',');

export default function ListaProvas({ onTab, onMenu, st, org, onAbrir, onSairOrg, onApagou }) {
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
  const lista = nuvem.map((n) => { const l = idx.find((x) => x.code === n.code) || {}; return { ...l, code: n.code, nome: n.nome || l.nome || '', data: n.data, cidade: n.cidade }; });

  // Provas antigas só tinham o nome no celular: copia para a nuvem para o site e os outros aparelhos verem.
  useEffect(() => {
    nuvem.forEach((n) => { const l = idx.find((x) => x.code === n.code); if (!n.nome && l && l.nome) salvarProva(n.code, { nome: l.nome }).catch(() => {}); });
  }, [nuvem]);

  const criar = async () => {
    const nome = novo.trim();
    if (!nome) return Alert.alert('Falta o nome', 'Dê um nome para a nova prova.');
    const ts = parseDataBR(dataTx);
    if (ts == null) return Alert.alert('Data da prova', 'Escolha a data da prova no calendário.');
    setBusy(true);
    try {
      const code = await criarProva(nome, cidade.trim(), dataTx.trim(), ts);
      limparProvaLocal(code);
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
    limparProvaLocal(it.code);
    onApagou && onApagou(it.code);
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
    salvarProva(it.code, { nome: n }).catch(() => {});
    setRenom(null);
  };

  const [busca, setBusca] = useState('');
  const { height } = useWindowDimensions();
  const web = Platform.OS === 'web';
  const filtradas = lista.filter((it) => !busca.trim() || (it.nome + ' ' + it.code + ' ' + (it.cidade || '')).toLowerCase().includes(busca.trim().toLowerCase()));
  const opcoes = (it) => Alert.alert(it.nome || it.code, 'O que fazer com este evento?', [
    { text: 'Renomear', onPress: () => { setRenom(it.code); setNomeEd(it.nome || ''); } },
    { text: 'Apagar', style: 'destructive', onPress: () => pedeApagar(it) },
    { text: 'Cancelar', style: 'cancel' },
  ]);
  const CAMPO = { color: COR.tx, fontSize: 16, borderBottomWidth: 1, borderBottomColor: '#b8c4cc', paddingVertical: 8, marginBottom: 14 };
  return (
    <View style={{ minHeight: Math.max(height, 640), backgroundColor: web ? '#fafafa' : COR.fundo }}>
      <View style={{ backgroundColor: web ? '#31b9d3' : '#6cc4ec', paddingTop: web ? 0 : 46 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: web ? 46 : undefined, paddingHorizontal: 16, justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: web ? 22 : 26, fontWeight: '900' }}>Rally GPS</Text></View>
          {web ? <Text style={{ color: '#fff', fontSize: 20, fontWeight: '500' }}>Eventos</Text> : null}
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            {web ? <Text style={{ color: '#fff', fontSize: 11, marginRight: 10 }}>Versão: {VERSAO}</Text> : null}
            {onMenu ? <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 14, right: 6 }}><Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', paddingHorizontal: 6 }}>⋮</Text></TouchableOpacity> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: web ? 4 : 10 }}>
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 3, borderBottomColor: '#fff' }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Eventos</Text></View>
          <TouchableOpacity onPress={() => onTab && onTab('trilhas')} style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 3, borderBottomColor: 'transparent' }}><Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }}>Trilhas</Text></TouchableOpacity>
        </View>
      </View>
      <View style={{ padding: 16, paddingBottom: 100, width: '100%', maxWidth: web ? 484 : undefined, alignSelf: 'center' }}>
        <Text style={{ color: COR.tx, fontSize: 19, fontWeight: '600' }}>Selecionar Evento <Text style={{ color: COR.azulTx }}>({lista.length})</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
          <TextInput style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: web ? '#333' : '#cfd8dc', borderRadius: web ? 8 : 4, paddingHorizontal: 12, paddingVertical: web ? 12 : 8, color: COR.tx }} value={busca} onChangeText={setBusca} placeholder="🔍  Buscar por nome, estado ou MM/AAAA" placeholderTextColor="#9aa5ae" />
          <TouchableOpacity onPress={() => setNuvem((n) => [...n])} style={{ paddingHorizontal: 14 }}><Text style={{ color: COR.azulTx, fontSize: 22 }}>↻</Text></TouchableOpacity>
        </View>
        {filtradas.length === 0 && <Text style={{ color: COR.tx2 }}>{lista.length ? 'Nenhum evento encontrado.' : 'Nenhum evento ainda. Toque em + para criar o primeiro.'}</Text>}
        {filtradas.map((it) => (
          <View key={it.code} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
            {renom === it.code ? (
              <View>
                <TextInput style={CAMPO} value={nomeEd} onChangeText={setNomeEd} placeholder="Nome do evento" placeholderTextColor="#9aa5ae" />
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity onPress={() => renomear(it)} style={{ paddingVertical: 8, paddingRight: 24 }}><Text style={{ color: COR.azulTx, fontWeight: '700' }}>SALVAR</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setRenom(null)} style={{ paddingVertical: 8 }}><Text style={{ color: COR.tx2, fontWeight: '700' }}>CANCELAR</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity activeOpacity={0.8} onPress={() => abrir(it)} onLongPress={() => opcoes(it)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COR.tx, fontSize: 17, fontWeight: '500' }}>{it.nome || '(sem nome)'}</Text>
                  <Text style={{ color: COR.tx2, fontSize: 13, marginTop: 3 }}>{[it.data, it.cidade].filter(Boolean).join(' - ') || 'Código ' + it.code}</Text>
                  <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 2 }}>Código {it.code} · {it.marcas || 0} marca(s) · {km3(it.km)} km</Text>
                </View>
                <TouchableOpacity onPress={() => opcoes(it)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }} style={{ paddingHorizontal: 8 }}><Text style={{ color: COR.tx2, fontSize: 22, fontWeight: '900' }}>⋮</Text></TouchableOpacity>
                <Text style={{ color: COR.tx2, fontSize: 24 }}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {apagando && (
          <View style={{ backgroundColor: '#fff', borderRadius: 6, padding: 14, marginTop: 6, borderWidth: 1, borderColor: COR.verm }}>
            <Text style={{ color: COR.verm, fontWeight: '700', fontSize: 16 }}>Apagar "{apagando.nome || apagando.code}"?</Text>
            <Text style={{ color: COR.tx2, marginVertical: 6 }}>Não dá para desfazer. Para confirmar, digite o nome do evento (ou o código, se não tiver nome).</Text>
            <TextInput style={CAMPO} value={conf} onChangeText={setConf} placeholder={apagando.nome || apagando.code} placeholderTextColor="#9aa5ae" />
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => setApagando(null)} style={{ paddingVertical: 8, paddingRight: 24 }}><Text style={{ color: COR.tx2, fontWeight: '700' }}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { if (conf.trim().toLowerCase() !== String(apagando.nome || apagando.code).trim().toLowerCase()) return Alert.alert('Nome diferente', 'Digite exatamente o nome ou o código do evento.'); apagar(); }} style={{ paddingVertical: 8 }}><Text style={{ color: COR.verm, fontWeight: '700' }}>APAGAR DEFINITIVAMENTE</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={() => setForm(true)} style={{ position: web ? 'fixed' : 'absolute', right: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: COR.azul, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}><Text style={{ color: '#fff', fontSize: 32, lineHeight: 34 }}>+</Text></TouchableOpacity>
      <Tela visible={form} onRequestClose={() => setForm(false)} fundo={COR.fundo}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COR.fundo }} behavior="padding">
          <Cab titulo="Novo evento" azul onVoltar={() => setForm(false)} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
            <Text style={{ color: COR.azulTx, fontSize: 13 }}>Nome do evento</Text>
            <TextInput style={CAMPO} value={novo} onChangeText={setNovo} placeholderTextColor="#9aa5ae" />
            <Text style={{ color: COR.azulTx, fontSize: 13 }}>Cidade - UF</Text>
            <TextInput style={CAMPO} value={cidade} onChangeText={setCidade} placeholderTextColor="#9aa5ae" />
            <Text style={{ color: COR.azulTx, fontSize: 13 }}>Data do evento</Text>
            <TouchableOpacity style={[CAMPO, { justifyContent: 'center' }]} onPress={escolherData}><Text style={{ color: dataTx ? COR.tx : '#9aa5ae', fontSize: 16 }}>{dataTx ? `📅  ${dataTx}` : '📅  Escolher a data no calendário'}</Text></TouchableOpacity>
            <Text style={{ color: COR.tx2, fontSize: 12 }}>O código (4 números) é gerado sozinho. Os competidores veem o evento quando você inscreve o e-mail deles.</Text>
          </ScrollView>
          <TouchableOpacity onPress={criar} disabled={busy} style={{ backgroundColor: COR.azul, paddingVertical: 18, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{busy ? 'CRIANDO…' : 'CRIAR EVENTO'}</Text></TouchableOpacity>
        </KeyboardAvoidingView>
      </Tela>
    </View>
  );
}
