// Planilhas do evento (estilo Kraken): cartão da planilha, criar/baixar/importar, configurações e análises de encontros.
import { useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { COR, Cab } from './Pos';
import { loadJson, saveJson } from './persist';
import { salvarProva } from './firebase';

const p2 = (n) => String(n).padStart(2, '0');
const dh = (ms) => { if (!ms || ms < 1e11) return '—'; const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} - ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const SOMBRA = { elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } };

function Botao({ t, onPress }) {
  return <TouchableOpacity onPress={onPress} style={{ paddingVertical: 16, paddingHorizontal: 6 }}><Text style={{ color: COR.azulTx, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 }}>{t}</Text></TouchableOpacity>;
}
function Radio({ on, t, press }) {
  return (
    <TouchableOpacity onPress={press} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? COR.azul : '#9aa5ae', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COR.azul }} /> : null}</View>
      <Text style={{ color: COR.tx, fontSize: 15 }}>{t}</Text>
    </TouchableOpacity>
  );
}

function Config({ code, nome, grupos, onVoltar, onEditar }) {
  const [c, setC] = useState(() => ({ casas: 2, cuneta: 'aviso', compass: true, autoOdo: false, ...loadJson('plcfg_' + code, {}) }));
  const [med, setMed] = useState(() => loadJson('plcfg_' + code, {}).medias || {});
  const salva = (n) => { setC(n); const o = { ...n, medias: med }; saveJson('plcfg_' + code, o); salvarProva(code, { plcfg: o }).catch(() => {}); };
  const marca = (g) => { const m = { ...med, [g]: med[g] === false }; setMed(m); const o = { ...c, medias: m }; saveJson('plcfg_' + code, o); salvarProva(code, { plcfg: o }).catch(() => {}); };
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Cab titulo="Configurar planilha" azul onVoltar={onVoltar} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
        <View style={{ borderWidth: 1, borderColor: '#cfd8dc', borderRadius: 4, padding: 12 }}><Text style={{ color: COR.tx2, fontSize: 12 }}>Nome da planilha</Text><Text style={{ color: COR.tx, fontSize: 16, marginTop: 2 }}>{nome || 'Planilha'}</Text></View>
        <Text style={{ color: COR.tx, fontSize: 17, textAlign: 'center', marginVertical: 16 }}>Médias</Text>
        {grupos.map((g, i) => (
          <TouchableOpacity key={g.nome} onPress={() => marca(g.nome)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f6f8', borderRadius: 4, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: COR.azulTx, width: 26 }}>{String.fromCharCode(65 + i)}:</Text>
            <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: med[g.nome] === false ? '#9aa5ae' : COR.azul, backgroundColor: med[g.nome] === false ? '#fff' : COR.azul, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRadius: 3 }}>{med[g.nome] === false ? null : <Text style={{ color: '#fff', fontSize: 13, lineHeight: 15 }}>✓</Text>}</View>
            <Text style={{ color: COR.tx, fontSize: 15, flex: 1 }}>{g.nome}</Text>
          </TouchableOpacity>
        ))}
        <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 14 }}>Precisão do odômetro de referências parciais</Text>
        <Radio on={c.casas === 2} t="2 casas decimais" press={() => salva({ ...c, casas: 2 })} />
        <Radio on={c.casas === 3} t="3 casas decimais" press={() => salva({ ...c, casas: 3 })} />
        <Text style={{ color: COR.tx2, fontSize: 12, marginTop: 10 }}>Tipo de cuneta</Text>
        <Radio on={c.cuneta === 'aviso'} t="! Aviso" press={() => salva({ ...c, cuneta: 'aviso' })} />
        <Radio on={c.cuneta === 'perigo'} t="☠ Perigo" press={() => salva({ ...c, cuneta: 'perigo' })} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
          <View style={{ flex: 1 }}><Text style={{ color: COR.tx, fontSize: 15 }}>Permite usar sensor externo</Text><Text style={{ color: COR.tx2, fontSize: 12 }}>Se desativado, o odômetro fica só no GPS do celular.</Text></View>
          <Switch value={c.compass} onValueChange={(v) => salva({ ...c, compass: v })} trackColor={{ true: '#9be3f0' }} thumbColor={c.compass ? COR.azul : '#eee'} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
          <View style={{ flex: 1 }}><Text style={{ color: COR.tx, fontSize: 15 }}>Permite correção automática do odômetro</Text><Text style={{ color: COR.tx2, fontSize: 12 }}>Ajusta o odômetro nos pontos de referência.</Text></View>
          <Switch value={c.autoOdo} onValueChange={(v) => salva({ ...c, autoOdo: v })} trackColor={{ true: '#9be3f0' }} thumbColor={c.autoOdo ? COR.azul : '#eee'} />
        </View>
      </ScrollView>
      <TouchableOpacity onPress={onEditar} style={{ backgroundColor: COR.azul, margin: 16, paddingVertical: 14, alignItems: 'center', borderRadius: 4 }}><Text style={{ color: '#fff', fontWeight: '700' }}>✎  EDITAR PLANILHA</Text></TouchableOpacity>
    </View>
  );
}

function Baixar({ nome, grupos, pub, onVoltar, onBaixar }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Cab titulo="Baixar planilha" azul onVoltar={onVoltar} />
      <ScrollView>
        {pub ? (
          <View>
            <View style={{ backgroundColor: '#8fcfe6', paddingVertical: 8, paddingHorizontal: 16 }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{nome || 'Planilha'}</Text></View>
            <TouchableOpacity onPress={onBaixar} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: COR.linha }}>
              <Text style={{ color: COR.tx2, fontSize: 13 }}>{dh(pub)}</Text>
              <Text style={{ color: COR.tx2, fontSize: 13 }}>{grupos.map((g) => g.nome).join(', ')}</Text>
              <Text style={{ color: COR.azulTx, fontSize: 13, marginTop: 4 }}>Versão publicada na nuvem · toque para baixar</Text>
            </TouchableOpacity>
          </View>
        ) : <Text style={{ color: COR.tx2, textAlign: 'center', margin: 30 }}>Nenhuma planilha publicada para este evento ainda.</Text>}
      </ScrollView>
    </View>
  );
}

// Props: code, nome, grupos, pub (ms), levEm (ms), onCriar, onEditar, onBaixar, onSimular, onTracklogs
export default function Planilhas({ code, nome, grupos, pub, levEm, onCriar, onEditar, onBaixar, onSimular, onTracklogs, aviso }) {
  const [sub, setSub] = useState(null);
  const [menu, setMenu] = useState(false);
  const tem = !!pub || levEm > 0;
  const nuvemOk = pub && (!levEm || pub >= levEm - 5000);
  if (sub === 'config') return <View style={{ minHeight: 640 }}><Config code={code} nome={nome} grupos={grupos} onVoltar={() => setSub(null)} onEditar={() => { setSub(null); onEditar(); }} /></View>;
  if (sub === 'baixar') return <View style={{ minHeight: 640 }}><Baixar nome={nome} grupos={grupos} pub={pub} onVoltar={() => setSub(null)} onBaixar={() => { setSub(null); Alert.alert('Planilha baixada', 'A versão publicada na nuvem foi carregada para edição.'); onBaixar(); }} /></View>;
  return (
    <View>
      {tem ? (
        <TouchableOpacity activeOpacity={0.85} onPress={onEditar} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 16, marginBottom: 6, ...SOMBRA }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COR.tx, fontSize: 17, fontWeight: '600', textTransform: 'uppercase' }}>{nome || 'Planilha'}</Text>
              <Text style={{ color: COR.tx2, fontSize: 13, marginTop: 6 }}>{grupos.map((g) => g.nome).join(', ')}</Text>
              <Text style={{ color: COR.tx2, fontSize: 13, marginTop: 8 }}>Atualizado em: {dh(pub || levEm)}</Text>
              {levEm > 0 ? <Text style={{ color: COR.tx2, fontSize: 13 }}>Levantamento salvo em: {dh(levEm)}</Text> : null}
            </View>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setMenu((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}><Text style={{ color: COR.tx2, fontSize: 24, fontWeight: '900' }}>⋮</Text></TouchableOpacity>
              <Text style={{ color: nuvemOk ? COR.verde : '#b26a00', fontSize: 22, marginTop: 8 }}>{nuvemOk ? '☁✓' : '☁'}</Text>
            </View>
          </View>
          {menu ? (
            <View style={{ position: 'absolute', right: 14, top: 36, backgroundColor: '#fff', borderRadius: 4, ...SOMBRA, elevation: 8, paddingVertical: 4, minWidth: 190, zIndex: 5 }}>
              <TouchableOpacity onPress={() => { setMenu(false); setSub('config'); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}><Text style={{ color: COR.tx, fontSize: 15 }}>⚙  Configurações</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setMenu(false); onEditar(); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}><Text style={{ color: COR.tx, fontSize: 15 }}>✎  Editar planilha</Text></TouchableOpacity>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : <View style={{ backgroundColor: '#fff', borderRadius: 6, padding: 16, ...SOMBRA }}><Text style={{ color: COR.tx2 }}>Este evento ainda não tem planilha. Toque em CRIAR PLANILHA.</Text></View>}
      <View style={{ marginTop: 6 }}>
        <Botao t="＋  CRIAR PLANILHA" onPress={onCriar} />
        <Botao t="⬇  BAIXAR PLANILHA" onPress={() => setSub('baixar')} />
        <Botao t="⇪  IMPORTAR PLANILHA (da nuvem)" onPress={() => { Alert.alert('Importar planilha', 'Buscar a versão mais recente publicada (por outro celular ou pelo navegador)?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Importar', onPress: onBaixar }]); }} />
      </View>
      {aviso ? <Text style={{ color: COR.tx2, fontSize: 12, marginBottom: 6 }}>{aviso}</Text> : null}
      <Text style={{ color: COR.tx, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 8 }}>Análises de encontros</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onSimular} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 16, flexDirection: 'row', alignItems: 'center', ...SOMBRA }}>
        <Text style={{ color: COR.azulTx, fontSize: 22, marginRight: 12 }}>⇄</Text>
        <View style={{ flex: 1 }}><Text style={{ color: COR.tx, fontSize: 15, fontWeight: '600' }}>Encontros entre categorias</Text><Text style={{ color: COR.tx2, fontSize: 13, marginTop: 2 }}>Simule a grade de largada e veja onde as categorias se encontram nos pontos de encontro das planilhas.</Text></View>
        <Text style={{ color: COR.tx2, fontSize: 22 }}>›</Text>
      </TouchableOpacity>
      <Text style={{ color: COR.tx, fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8 }}>Tracklogs oficiais</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onTracklogs} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 16, flexDirection: 'row', alignItems: 'center', ...SOMBRA }}>
        <View style={{ flex: 1 }}><Text style={{ color: COR.tx, fontSize: 15, fontWeight: '600' }}>Track logs dos competidores</Text><Text style={{ color: COR.tx2, fontSize: 13, marginTop: 2 }}>Veja os dataloggers enviados para este evento.</Text></View>
        <Text style={{ color: COR.tx2, fontSize: 22 }}>›</Text>
      </TouchableOpacity>
    </View>
  );
}
