// Relógio de prova: horário do GPS (bem mais exato que o do celular) + ajuste fino para casar com o relógio do outro organizador.
import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Diferença (ms) entre o relógio do GPS e o do celular: pega o ponto recebido com menor atraso nos últimos 20.
export function offsetGps(points) {
  let melhor = null;
  for (let i = Math.max(0, points.length - 20); i < points.length; i++) {
    const p = points[i];
    if (!p || p.rx == null || p.t == null || p.rx - p.t > 8000) continue; // ponto atrasado (entrega em lote)
    const d = p.t - p.rx;
    if (melhor == null || d > melhor) melhor = d;
  }
  return melhor == null ? 0 : melhor;
}

export const fmtMs = (ms) => {
  const a = Math.abs(ms), s = Math.floor(a / 1000), r = a % 1000;
  return `${ms < 0 ? '−' : '+'}${s} s ${String(Math.round(r)).padStart(3, '0')} ms`;
};
const hmsMs = (t) => { const d = new Date(t); const p = (n, k = 2) => String(n).padStart(k, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`; };

// Mediana circular das frações de segundo: cada toque marca onde a "virada do segundo" caiu no nosso relógio.
function ajusteDosToques(fr, compMs) {
  // desvio em (−500, 500]: quanto o nosso relógio está adiantado (+) ou atrasado (−) em relação à virada do outro
  const dev = fr.map((f) => { let x = (f - compMs) % 1000; if (x < 0) x += 1000; return x > 500 ? x - 1000 : x; });
  dev.sort((a, b) => a - b);
  const med = dev[Math.floor(dev.length / 2)];
  const bons = dev.filter((x) => Math.abs(x - med) <= 150); // descarta toques fora do padrão
  const m = bons.reduce((a, b) => a + b, 0) / (bons.length || 1);
  return { ajuste: -Math.round(m), n: bons.length, de: dev.length };
}

// Painel: relógio atual com milésimos, ajuste manual e sincronização pelo toque na virada do segundo.
export function RelogioPainel({ st, agora, bruto, ajuste, setAjuste, comGps }) {
  const [aberto, setAberto] = useState(false);
  const [toques, setToques] = useState([]); // frações (ms) do relógio SEM ajuste
  const [comp, setComp] = useState('0');
  const [txt, setTxt] = useState('');
  const toque = () => setToques((o) => [...o, bruto() % 1000]);
  const aplicar = () => {
    if (toques.length < 3) return Alert.alert('Poucos toques', 'Toque pelo menos 3 vezes (o ideal é de 8 a 10), sempre na virada do segundo do outro relógio.');
    const r = ajusteDosToques(toques, parseInt(comp, 10) || 0);
    setAjuste((a) => { const inteiro = Math.round(a / 1000) * 1000; return inteiro + r.ajuste; }); // mantém os segundos inteiros, refina a fração
    setToques([]);
    Alert.alert('Sincronizado', `Fração de segundo ajustada com ${r.n} de ${r.de} toques.\nSe os segundos inteiros diferirem, acerte-os com os botões ±1 s.`);
  };
  const digitado = () => { const v = parseFloat(String(txt).replace(',', '.')); if (isNaN(v)) return Alert.alert('Valor', 'Digite o ajuste em segundos (ex.: 0,35 ou −1,2).'); setAjuste(Math.round(v * 1000)); setTxt(''); };
  return (
    <View style={st.card}>
      <TouchableOpacity onPress={() => setAberto((o) => !o)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={st.tip}>Relógio da prova {aberto ? '▾' : '▸'}</Text>
            <Text style={st.tipTx}>{comGps ? 'Base: horário do GPS' : 'Base: relógio do celular (ligue o GPS para usar o do GPS)'} · ajuste {fmtMs(ajuste)}</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{hmsMs(agora)}</Text>
        </View>
      </TouchableOpacity>
      {aberto ? (
        <View style={{ marginTop: 8 }}>
          <Text style={st.tipTx}>Ajuste para casar com o relógio do outro organizador. Adiante (+) se o relógio dele estiver à frente do nosso, atrase (−) se estiver atrás.</Text>
          <View style={st.row}>
            {[-1000, -100, -10, 10, 100, 1000].map((m) => <TouchableOpacity key={m} style={[st.btn2, { paddingHorizontal: 4 }]} onPress={() => setAjuste((a) => a + m)}><Text style={st.btn2Tx}>{m > 0 ? '+' : ''}{Math.abs(m) >= 1000 ? m / 1000 + ' s' : m + ' ms'}</Text></TouchableOpacity>)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <TextInput style={[st.input, { flex: 1 }]} value={txt} onChangeText={setTxt} placeholder="ajuste em segundos (ex.: 0,35)" placeholderTextColor="#666" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={[st.btn2, { flex: 0, paddingHorizontal: 14 }]} onPress={digitado}><Text style={st.btn2Tx}>Definir</Text></TouchableOpacity>
          </View>
          <Text style={[st.tip, { marginTop: 10 }]}>Sincronizar pelo toque</Text>
          <Text style={st.tipTx}>Olhe o relógio do outro sistema e toque no botão exatamente quando o segundo virar. Repita 8 a 10 vezes e toque em "Aplicar".</Text>
          <TouchableOpacity style={[st.btn2, { backgroundColor: '#ff7a2e', marginTop: 6, paddingVertical: 22 }]} onPressIn={toque} activeOpacity={0.6}><Text style={[st.btn2Tx, { color: '#0c1014', fontSize: 18 }]}>VIROU O SEGUNDO · toques: {toques.length}</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <Text style={st.tipTx}>Atraso do seu dedo (ms)</Text>
            <TextInput style={[st.input, { width: 80 }]} value={comp} onChangeText={setComp} keyboardType="number-pad" />
          </View>
          <View style={st.row}>
            <TouchableOpacity style={st.btn2} onPress={aplicar}><Text style={st.btn2Tx}>Aplicar</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setToques([])}><Text style={st.btn2Tx}>Limpar toques</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => setAjuste(0)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Zerar ajuste</Text></TouchableOpacity>
          </View>
          <Text style={st.tipTx}>O dedo costuma atrasar de 0,1 a 0,2 s em relação ao olho. Ponha esse atraso no campo acima, ou corrija depois com os botões de ms.</Text>
        </View>
      ) : null}
    </View>
  );
}
