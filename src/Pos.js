// Telas claras do competidor depois da prova (estilo Kraken): Performance (ficha de passagem) e Resultados.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { ouvirMeuDatalogger, ouvirRanking } from './firebase';
import { calcDl } from './TrackLog';
import { gruposDe, rank } from './rally';

export const COR = { fundo: '#f3f6f8', azul: '#00b3d6', azulTx: '#00a3c4', faixa: '#bfe9f2', tx: '#263238', tx2: '#546e7a', linha: '#cfd8dc', verde: '#2e7d32', verm: '#c62828' };

const p2 = (x) => String(x).padStart(2, '0');
const relogio = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p2(Math.floor(d.getMilliseconds() / 10))}`; };
const milhar = (n) => Math.round(n).toLocaleString('pt-BR');

export function Cab({ titulo, onVoltar, azul }) {
  return (
    <View style={{ backgroundColor: azul ? COR.azul : COR.fundo, paddingTop: 52, paddingBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
      {onVoltar ? <TouchableOpacity onPress={onVoltar} style={{ position: 'absolute', left: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 10 }}><Text style={{ color: azul ? '#fff' : COR.azulTx, fontSize: 30, lineHeight: 30 }}>‹</Text></TouchableOpacity> : null}
      <Text style={{ color: azul ? '#fff' : COR.tx, fontSize: 18, fontWeight: '500' }}>{titulo}</Text>
    </View>
  );
}

// Ficha de passagem do próprio competidor: PC, ideal, passagem e pontos (verde atrasado, vermelho adiantado).
export function Performance({ user, x, provaMap, onVoltar }) {
  const [dl, setDl] = useState(undefined);
  const [erro, setErro] = useState('');
  useEffect(() => ouvirMeuDatalogger(x.insc.prova, user.uid, (l) => { setErro(''); setDl(l[0] || null); }, () => { setErro('Ainda não liberado pelo organizador.'); setDl(null); }), [x.insc.prova, user.uid]);
  const grupos = useMemo(() => gruposDe(provaMap.categorias), [provaMap]);
  const r = useMemo(() => (dl ? calcDl(dl, provaMap, grupos) : null), [dl, provaMap, grupos]);
  const Col = ({ t, w, c, a, b }) => <Text style={{ width: w, color: c || COR.tx, fontSize: 14, fontWeight: b ? '500' : '400', textAlign: a || 'left' }}>{t}</Text>;
  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <Cab titulo="Performance" onVoltar={onVoltar} />
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COR.linha }}>
        <Col t="PC" w="11%" b /><Col t="IDEAL" w="31%" b a="center" /><Col t="PASSAGEM" w="31%" b a="center" /><Col t="PONTOS" w="27%" b a="right" />
      </View>
      {dl === undefined ? <ActivityIndicator style={{ marginTop: 40 }} color={COR.azul} /> : !r ? (
        <Text style={{ color: COR.tx2, textAlign: 'center', margin: 24 }}>{erro || 'Seu datalogger ainda não foi enviado.'}</Text>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {r.rows.filter((q) => !q.neu).map((q) => {
            const falta = q.falta;
            const val = falta ? r.max : q.tipo === 'D' ? 0 : q.diff != null ? Math.round(q.diff * r.esc) : null;
            const cor = falta || (val != null && val > 0) ? COR.verde : val != null && val < 0 ? COR.verm : COR.tx;
            return (
              <View key={q.n} style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 5 }}>
                <Col t={q.lab} w="11%" />
                <Col t={q.prev != null ? relogio(q.prev) : '—'} w="31%" a="center" />
                <Col t={q.real != null && !falta ? relogio(q.real) : '--:--:--'} w="31%" a="center" />
                <Col t={val == null ? '—' : (val > 0 ? '+' : val < 0 ? '−' : '') + Math.abs(val)} w="27%" a="right" c={cor} />
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
      <View style={{ backgroundColor: COR.azul, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'flex-end' }}>
        <Text style={{ color: '#fff', fontSize: 14 }}>Total: <Text style={{ fontSize: 20, fontWeight: '500' }}>{r ? milhar(r.total) : '—'}</Text></Text>
      </View>
    </View>
  );
}

const MEDALHA = ['#f0b429', '#9aa5ad', '#a8742c'];

// Resultados do evento por categoria.
export function ResultadosEvento({ x, provaMap, onVoltar }) {
  const [rows, setRows] = useState(null);
  useEffect(() => ouvirRanking(x.code, (r) => setRows(rank(r)), () => setRows([])), [x.code]);
  const lib = provaMap.lib || {};
  const grupos = useMemo(() => {
    const m = new Map();
    (rows || []).forEach((r) => { const k = r.classe || 'GERAL'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return [...m.entries()];
  }, [rows]);
  return (
    <View style={{ flex: 1, backgroundColor: COR.fundo }}>
      <Cab titulo="Resultados" onVoltar={onVoltar} />
      {lib.resultado === false ? <Text style={{ color: COR.tx2, textAlign: 'center', margin: 24 }}>Resultado ainda não liberado pelo organizador.</Text>
        : rows === null ? <ActivityIndicator style={{ marginTop: 40 }} color={COR.azul} />
        : rows.length === 0 ? <Text style={{ color: COR.tx2, textAlign: 'center', margin: 24 }}>Nenhum resultado ainda.</Text>
        : (
          <ScrollView style={{ flex: 1 }}>
            {grupos.map(([cat, lista]) => (
              <View key={cat}>
                <View style={{ backgroundColor: COR.faixa, paddingVertical: 5, alignItems: 'center' }}><Text style={{ color: COR.tx, fontSize: 14, fontWeight: '500' }}>{String(cat).toUpperCase()}</Text></View>
                {lista.map((r, i) => (
                  <View key={r.numero} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COR.linha }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: i < 3 ? MEDALHA[i] : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Text style={{ color: i < 3 ? '#fff' : COR.tx, fontSize: 13, fontWeight: '500' }}>{i + 1}º</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COR.tx, fontSize: 15 }}>{r.nome}{r.oficial ? ' ✔' : ''}</Text>
                      <Text style={{ color: COR.tx2, fontSize: 12 }}>#{r.numero}{r.classif === false || r.classif === 0 ? ' · não classificado' : ''}</Text>
                    </View>
                    {lib.soma !== false && <Text style={{ color: COR.azulTx, fontSize: 18 }}>{milhar(Number(r.pontos) || 0)}</Text>}
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
    </View>
  );
}

// Tela clara de passo do fluxo de início (seta de voltar, conteúdo e barra azul embaixo).
export function Passo({ onVoltar, children, rodape, onRodape, rodapeOff }) {
  const { height } = useWindowDimensions();
  return (
    <View style={{ marginHorizontal: -16, marginTop: -56, marginBottom: -40, height, backgroundColor: '#fafafa' }}>
      <View style={{ paddingTop: 52, paddingHorizontal: 6 }}>
        {onVoltar ? <TouchableOpacity onPress={onVoltar} style={{ paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }}><Text style={{ color: COR.tx, fontSize: 34, lineHeight: 34 }}>‹</Text></TouchableOpacity> : null}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}>{children}</ScrollView>
      {rodape ? <TouchableOpacity onPress={onRodape} style={{ backgroundColor: COR.azul, paddingVertical: 18, paddingBottom: 30, alignItems: 'center', opacity: rodapeOff ? 0.6 : 1 }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '500', letterSpacing: 0.5 }}>{rodape}</Text></TouchableOpacity> : null}
    </View>
  );
}

export function OpcaoClara({ icone, t, d, sub, onPress, linha }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 38, borderTopWidth: linha ? 1 : 0, borderTopColor: COR.linha }}>
      <Text style={{ color: COR.azulTx, fontSize: 26, width: 44 }}>{icone}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: COR.tx, fontSize: 20, fontWeight: '500' }}>{t}</Text>
        {sub ? <Text style={{ color: COR.tx, fontSize: 16, marginTop: 4 }}>{sub}</Text> : null}
        {d ? <Text style={{ color: COR.tx2, fontSize: 15, marginTop: 4 }}>{d}</Text> : null}
      </View>
      <Text style={{ color: COR.tx, fontSize: 30 }}>›</Text>
    </TouchableOpacity>
  );
}
