// Editor do layout da tela de prova: arrastar, redimensionar, adicionar, remover e ordenar blocos.
import { useRef, useState } from 'react';
import { useEffect } from 'react';
import { Alert, Modal, PanResponder, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Bloco } from './Blocos';
import Seguro from './Seguro';
import { BLOCOS, novoId } from './NavLayout';

export const TOPO = 44; // faixa superior igual na prova e no editor, para o desenho ficar idêntico
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snap = (v) => Math.round(v * 100) / 100;

const EXEMPLO = {
  spd: 10, tnav: 2.3, fx: { bg: '#f5e50f', fg: '#000' }, odoM: 43, regRef: 45, regTrc: 820, pa: { tx: '36', d: false }, pp: { tx: '27', d: false },
  clock: Date.now(), acc: 4, trN: '3/13', refN: '12/41', kmAcum: 1250, bat: 0.8, elapsed: 95, rbLinhas: null, classe: '', grupos: [], edit: true, onAdj: () => {}, onPc: () => {},
};

function Item({ it, sel, cv, onSel, onSet, d, nome }) {
  const P = useRef({}); P.current = { it, cv, onSel, onSet };
  const ini = useRef(null);
  // Durante o arrasto só este bloco é redesenhado (posição local); o layout inteiro é atualizado ao soltar.
  const [drag, setDrag] = useState(null);
  const dragR = useRef(null);
  const fim = () => { if (dragR.current) P.current.onSet(dragR.current); dragR.current = null; setDrag(null); };
  const mover = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { ini.current = { x: P.current.it.x, y: P.current.it.y }; dragR.current = null; P.current.onSel(); },
    onPanResponderMove: (_, g) => {
      const { it: a, cv: c } = P.current;
      if (!ini.current) return;
      const v = { x: snap(clamp(ini.current.x + g.dx / c.w, 0, 1 - a.w)), y: snap(clamp(ini.current.y + g.dy / c.h, 0, 1 - a.h)) };
      dragR.current = v; setDrag(v);
    },
    onPanResponderRelease: fim,
    onPanResponderTerminate: fim,
  })).current;
  const redim = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { ini.current = { w: P.current.it.w, h: P.current.it.h }; dragR.current = null; P.current.onSel(); },
    onPanResponderMove: (_, g) => {
      const { it: a, cv: c } = P.current;
      if (!ini.current) return;
      const v = { w: snap(clamp(ini.current.w + g.dx / c.w, 0.06, 1 - a.x)), h: snap(clamp(ini.current.h + g.dy / c.h, 0.04, 1 - a.y)) };
      dragR.current = v; setDrag(v);
    },
    onPanResponderRelease: fim,
    onPanResponderTerminate: fim,
  })).current;
  const q = drag ? { ...it, ...drag } : it;
  const W = Math.max(8, q.w * cv.w), H = Math.max(8, q.h * cv.h);
  return (
    <View style={{ position: 'absolute', left: q.x * cv.w, top: q.y * cv.h, width: W, height: H }}>
      <View pointerEvents="none"><Bloco tipo={it.tipo} d={d} w={W} h={H} /></View>
      <View {...mover.panHandlers} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: sel ? 2 : 0, borderColor: '#4fc3f7' }} />
      {sel && <View {...redim.panHandlers} style={{ position: 'absolute', right: -10, bottom: -10, width: 26, height: 26, backgroundColor: '#fff', borderWidth: 2, borderColor: '#4fc3f7', borderRadius: 4 }} />}
    </View>
  );
}

export default function LayoutEditor({ layout, cfg, piloto, onSalvar, onClose }) {
  const [nome] = useState(layout.nome);
  const [orient, setOrient] = useState(layout.orient || 'v');
  useEffect(() => {
    ScreenOrientation.lockAsync(orient === 'h' ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); };
  }, [orient]);
  const [items, setItems] = useState(() => layout.items.map((x) => ({ ...x })));
  const [sel, setSel] = useState(null);
  const [menu, setMenu] = useState(false);
  const [add, setAdd] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cv, setCv] = useState({ w: 360, h: 600 });
  const set = (id, patch) => { setDirty(true); setItems((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x))); };
  const d = { ...EXEMPLO, cfg };
  const selIt = items.find((x) => x.id === sel);

  const ordem = (front) => {
    if (!selIt) return Alert.alert('Selecione um bloco', 'Toque num bloco da tela primeiro.');
    setDirty(true);
    setItems((l) => { const r = l.filter((x) => x.id !== sel); return front ? [...r, selIt] : [selIt, ...r]; });
    setMenu(false);
  };
  const remover = () => {
    if (!selIt) return Alert.alert('Selecione um bloco', 'Toque num bloco da tela primeiro.');
    setDirty(true); setItems((l) => l.filter((x) => x.id !== sel)); setSel(null); setMenu(false);
  };
  const adicionar = (tipo) => {
    const b = BLOCOS[tipo] || { w: 0.3, h: 0.1 };
    const id = novoId();
    setDirty(true);
    setItems((l) => [...l, { id, tipo, x: 0.1, y: 0.1, w: Math.min(b.w, 0.8), h: Math.min(b.h, 0.8) }]);
    setSel(id); setAdd(false);
  };
  const salvar = () => { onSalvar({ ...layout, orient, items }); setDirty(false); setMenu(false); onClose(); };
  const fechar = () => {
    setMenu(false);
    if (!dirty) return onClose();
    Alert.alert('Sair sem salvar?', 'As mudanças deste layout serão perdidas.', [{ text: 'Continuar editando', style: 'cancel' }, { text: 'Sair sem salvar', style: 'destructive', onPress: onClose }]);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={fechar}><Seguro>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 26 }}>
        <View style={{ height: TOPO, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: '#111' }}>
          <TouchableOpacity onPress={fechar}><Text style={{ color: '#4fc3f7', fontWeight: '800', fontSize: 16 }}>‹ Fechar</Text></TouchableOpacity>
          <Text style={{ flex: 1, color: '#fff', textAlign: 'center', fontSize: 13 }} numberOfLines={1}>{selIt ? ((BLOCOS[selIt.tipo] || {}).nome || selIt.tipo) : nome + ' · ' + (orient === 'h' ? 'horizontal' : 'vertical') + (dirty ? ' •' : '')}</Text>
          <TouchableOpacity onPress={() => setMenu((m) => !m)} style={{ padding: 8 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>⋮</Text></TouchableOpacity>
        </View>
        <View style={{ flex: 1 }} onLayout={(e) => setCv({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} onStartShouldSetResponder={() => { setSel(null); return false; }} />
          {items.map((it) => <Item key={it.id} it={it} sel={it.id === sel} cv={cv} d={d} onSel={() => { setSel(it.id); setMenu(false); }} onSet={(p) => set(it.id, p)} />)}
        </View>
        {menu && (
          <View style={{ position: 'absolute', top: 26 + TOPO, right: 8, zIndex: 9, backgroundColor: '#fff', borderRadius: 10, padding: 4, elevation: 10, minWidth: 210 }}>
            {[['+  Adicionar item', () => { setMenu(false); setAdd(true); }], ['Remover item', remover], ['Trazer para frente', () => ordem(true)], ['Enviar para trás', () => ordem(false)], [orient === 'h' ? 'Usar na vertical' : 'Usar na horizontal', () => { setOrient(orient === 'h' ? 'v' : 'h'); setDirty(true); setMenu(false); }], ['Salvar layout', salvar]].map(([tx, fn]) => (
              <TouchableOpacity key={tx} style={{ padding: 13 }} onPress={fn}><Text style={{ fontSize: 16, color: '#000' }}>{tx}</Text></TouchableOpacity>
            ))}
          </View>
        )}
        <Modal visible={add} animationType="slide" transparent onRequestClose={() => setAdd(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', paddingTop: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#000', paddingHorizontal: 16, paddingBottom: 6 }}>Adicionar item</Text>
              <ScrollView>
                {Object.keys(BLOCOS).filter((k) => !(piloto && BLOCOS[k].btn)).map((k) => (
                  <TouchableOpacity key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: '#eee' }} onPress={() => adicionar(k)}>
                    <Text style={{ fontSize: 16, color: BLOCOS[k].breve ? '#888' : '#000' }}>{BLOCOS[k].nome}</Text><Text style={{ fontSize: 20, color: '#1a7' }}>+</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} onPress={() => setAdd(false)}><Text style={{ fontSize: 16, color: '#c0392b', fontWeight: '800' }}>Cancelar</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Seguro></Modal>
  );
}
