// Editor de desenho da tulipa: peças prontas, marcos, caneta (dedo) e texto, com a foto da referência como fundo para decalcar.
import { useRef, useState } from 'react';
import { Image, Modal, PanResponder, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Circle } from 'react-native-svg';
import { CRUZAMENTOS, DesenhoSvg, SIMBOLOS, centro, mover } from './Desenho';

const COR = '#ff7a2e';

export default function EditorDesenho({ visible, inicial, foto, sat, hdg = 0, onApagarFoto, onCancel, onSave }) {
  const { width } = useWindowDimensions();
  const S = Math.min(width - 24, 380);
  const [items, setItems] = useState(inicial || []);
  const [aba, setAba] = useState('cruz');
  const [fundo, setFundo] = useState(foto ? 'foto' : sat ? 'sat' : 'nada');
  const [sel, setSel] = useState(null);
  const [live, setLive] = useState(null);
  const [grosso, setGrosso] = useState(3);
  const [txt, setTxt] = useState('');
  const hist = useRef([]);
  const R = useRef({});
  R.current = { items, aba, sel, grosso, S };
  const push = () => { hist.current = [...hist.current.slice(-30), R.current.items]; };
  const desfazer = () => { if (!hist.current.length) return; const p = hist.current[hist.current.length - 1]; hist.current = hist.current.slice(0, -1); setItems(p); setSel(null); };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { aba: a, items: it, S: s, grosso: g } = R.current;
      const x = (e.nativeEvent.locationX / s) * 100, y = (e.nativeEvent.locationY / s) * 100;
      R.current.last = [x, y];
      if (a === 'pen') { R.current.stroke = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]; setLive([...R.current.stroke]); setSel(null); return; }
      let best = null, bd = 18;
      it.forEach((q, i) => { const [cx, cy] = centro(q); const d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = i; } });
      setSel(best);
      if (best != null) push();
    },
    onPanResponderMove: (e) => {
      const { aba: a, S: s, sel: sl } = R.current;
      const x = (e.nativeEvent.locationX / s) * 100, y = (e.nativeEvent.locationY / s) * 100;
      if (a === 'pen') {
        const st = R.current.stroke;
        if (!st) return;
        const lx = st[st.length - 2], ly = st[st.length - 1];
        if (Math.hypot(x - lx, y - ly) >= 1.2) { st.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10); setLive([...st]); }
        return;
      }
      const [px, py] = R.current.last || [x, y];
      R.current.last = [x, y];
      if (sl != null) setItems((o) => o.map((q, i) => (i === sl ? mover(q, x - px, y - py) : q)));
    },
    onPanResponderRelease: () => {
      const { aba: a, grosso: g } = R.current;
      if (a === 'pen' && R.current.stroke && R.current.stroke.length >= 4) {
        push();
        const p = R.current.stroke;
        setItems((o) => [...o, { k: 'pen', p, w: g }]);
      }
      R.current.stroke = null; setLive(null);
    },
  })).current;

  const add = (it) => { push(); setSel(R.current.items.length); setItems((o) => [...o, it]); };
  const alt = (patch) => { if (sel == null) return; push(); setItems((o) => o.map((q, i) => (i === sel ? patch(q) : q))); };
  const Btn = ({ tx, on, cor, press, flex }) => (
    <TouchableOpacity onPress={press} style={{ borderWidth: 1, borderColor: cor || COR, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', flex, backgroundColor: on ? cor || COR : 'transparent' }}>
      <Text style={{ color: on ? '#0c1014' : cor || COR, fontWeight: '800', fontSize: 13 }}>{tx}</Text>
    </TouchableOpacity>
  );
  const it0 = sel != null ? items[sel] : null;
  const realce = it0 ? (() => { const [cx, cy] = centro(it0); return <Circle cx={cx} cy={cy} r={10} fill="#ffe600" fillOpacity={0.45} />; })() : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: '#0c1014', paddingTop: 36 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 8, alignItems: 'center' }}>
          <Text style={{ color: '#f5f5f5', fontWeight: '800', fontSize: 16 }}>Desenho da tulipa</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn tx="Desfazer" press={desfazer} />
            <Btn tx="Limpar" cor="#ff5252" press={() => { push(); setItems([]); setSel(null); }} />
          </View>
        </View>
        <View style={{ alignSelf: 'center', width: S, height: S, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden' }}>
          {fundo === 'foto' && foto ? <Image source={{ uri: foto }} style={{ position: 'absolute', width: S, height: S, opacity: 0.4 }} resizeMode="cover" /> : null}
          {fundo === 'sat' && sat ? <Image source={{ uri: sat }} style={{ position: 'absolute', width: S, height: S, opacity: 0.55, transform: [{ rotate: `${-hdg}deg` }, { scale: 1.42 }] }} resizeMode="cover" /> : null}
          <View style={{ position: 'absolute' }}>
            <DesenhoSvg items={live ? [...items, { k: 'pen', p: live, w: grosso }] : items} size={S} fundo={fundo === 'nada'}>{realce}</DesenhoSvg>
          </View>
          <View style={{ position: 'absolute', width: S, height: S }} {...pan.panHandlers} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: 6 }}>
          {foto ? <Btn flex={1} on={fundo === 'foto'} tx="Foto" press={() => setFundo('foto')} /> : null}
          {sat ? <Btn flex={1} on={fundo === 'sat'} tx="Satélite" press={() => setFundo('sat')} /> : null}
          <Btn flex={1} on={fundo === 'nada'} tx="Sem fundo" press={() => setFundo('nada')} />
          {foto && onApagarFoto ? <Btn flex={1} cor="#ff5252" tx="Apagar foto" press={() => { setFundo(sat ? 'sat' : 'nada'); onApagarFoto(); }} /> : null}
        </View>
        <Text style={{ color: '#a8a8a8', textAlign: 'center', fontSize: 12, marginTop: 4 }}>
          {aba === 'pen' ? 'Desenhe com o dedo no quadro.' : fundo !== 'nada' ? 'O fundo é só para decalcar: NÃO aparece no roadbook nem para o competidor. Toque numa peça para mover.' : 'Toque numa peça para selecioná-la e arraste para mover.'}
        </Text>
        {it0 && it0.k !== 'pen' && (
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: 6 }}>
            <Btn flex={1} tx="−" press={() => alt((q) => ({ ...q, s: Math.max(0.3, (q.s || 1) - 0.15) }))} />
            <Btn flex={1} tx="+" press={() => alt((q) => ({ ...q, s: Math.min(3, (q.s || 1) + 0.15) }))} />
            <Btn flex={1} tx="↺" press={() => alt((q) => ({ ...q, r: ((q.r || 0) - 45 + 360) % 360 }))} />
            <Btn flex={1} tx="↻" press={() => alt((q) => ({ ...q, r: ((q.r || 0) + 45) % 360 }))} />
            <Btn flex={1} tx="Apagar" cor="#ff5252" press={() => { push(); setItems((o) => o.filter((_, i) => i !== sel)); setSel(null); }} />
          </View>
        )}
        {it0 && it0.k === 'pen' && (
          <View style={{ paddingHorizontal: 12, marginTop: 6 }}><Btn tx="Apagar este traço" cor="#ff5252" press={() => { push(); setItems((o) => o.filter((_, i) => i !== sel)); setSel(null); }} /></View>
        )}
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: 8 }}>
          <Btn flex={1} on={aba === 'cruz'} tx="Cruzamentos" press={() => setAba('cruz')} />
          <Btn flex={1} on={aba === 'marc'} tx="Marcos" press={() => setAba('marc')} />
          <Btn flex={1} on={aba === 'pen'} tx="Caneta" press={() => { setAba('pen'); setSel(null); }} />
          <Btn flex={1} on={aba === 'txt'} tx="Texto" press={() => setAba('txt')} />
        </View>
        <ScrollView style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {aba === 'cruz' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CRUZAMENTOS.map((c, i) => (
                <TouchableOpacity key={i} onPress={() => add({ k: 'tpl', arms: c.arms, out: c.out, x: 50, y: 55, s: 0.85, r: 0 })}>
                  <DesenhoSvg items={[{ k: 'tpl', arms: c.arms, out: c.out, x: 50, y: 55, s: 0.85, r: 0 }]} size={72} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {aba === 'marc' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.keys(SIMBOLOS).map((n) => (
                <TouchableOpacity key={n} onPress={() => add({ k: 'sym', n, x: 78, y: 24, s: 1 })} style={{ alignItems: 'center' }}>
                  <DesenhoSvg items={[{ k: 'sym', n, x: 50, y: 50, s: 2 }]} size={72} />
                  <Text style={{ color: '#a8a8a8', fontSize: 11 }}>{SIMBOLOS[n].nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {aba === 'pen' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn flex={1} on={grosso === 1.5} tx="Fina" press={() => setGrosso(1.5)} />
              <Btn flex={1} on={grosso === 3} tx="Média" press={() => setGrosso(3)} />
              <Btn flex={1} on={grosso === 6} tx="Grossa" press={() => setGrosso(6)} />
            </View>
          )}
          {aba === 'txt' && (
            <View>
              <TextInput style={{ color: '#f5f5f5', borderWidth: 1, borderColor: '#262b32', borderRadius: 8, padding: 10 }} value={txt} onChangeText={setTxt} placeholder="Texto curto (ex.: Posto, Km 5)" placeholderTextColor="#666" />
              <View style={{ marginTop: 8 }}><Btn tx="Adicionar texto" press={() => { if (txt.trim()) { add({ k: 'txt', tx: txt.trim().slice(0, 18), x: 50, y: 20, s: 1 }); setTxt(''); } }} /></View>
            </View>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
          <Btn flex={1} tx="Cancelar" cor="#ff5252" press={onCancel} />
          <Btn flex={1} on tx="OK" cor="#4caf50" press={() => onSave(items)} />
        </View>
      </View>
    </Modal>
  );
}
