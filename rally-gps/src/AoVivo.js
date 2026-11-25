// Painel ao vivo do organizador: posição dos competidores/participantes sobre o traçado.
import { useEffect, useMemo, useState } from 'react';
import { Text, View, Platform } from 'react-native';
import MapaWeb from './MapaWeb';
import { ouvirAoVivo } from './firebase';
import { haversine } from './store';
const O = (p) => ({ lat: p[0], lon: p[1] });

// progresso (km) ao longo do traçado: vértice mais próximo
function progresso(rota, cum, p) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < rota.length; i++) { const d = haversine(O(rota[i]), p); if (d < bd) { bd = d; bi = i; } }
  return { km: cum[bi] / 1000, fora: bd };
}

export default function PainelAoVivo({ st, kind, id, rota = [] }) {
  const [lista, setLista] = useState([]);
  const [, tick] = useState(0);
  useEffect(() => ouvirAoVivo(kind, id, setLista, () => {}), [kind, id]);
  useEffect(() => { const x = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(x); }, []);
  const cum = useMemo(() => { const c = [0]; for (let i = 1; i < rota.length; i++) c.push(c[i - 1] + haversine(O(rota[i - 1]), O(rota[i]))); return c; }, [rota]);
  const agora = Date.now();
  const linhas = lista.map((x) => {
    const idade = Math.max(0, Math.round((agora - (x.em || x.t)) / 1000));
    const pr = rota.length > 1 ? progresso(rota, cum, x) : null;
    return { ...x, idade, km: pr ? pr.km : null, fora: pr ? pr.fora : null };
  }).sort((a, b) => (b.km ?? -1) - (a.km ?? -1) || a.idade - b.idade);
  const rotulo = (x) => (x.numero ? `${x.numero}` : (x.nome || '?').split(' ')[0]);
  const marks = linhas.map((x) => ({ lat: x.lat, lon: x.lon, txt: rotulo(x), cls: x.idade > 90 ? 'c' : 'l' }));
  const fmtIdade = (s) => (s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h`);
  return (
    <View style={st.card}>
      <Text style={st.tip}>Ao vivo · {linhas.length} {kind === 'prova' ? 'competidor(es)' : 'participante(s)'}</Text>
      <Text style={st.tipTx}>Posição enviada pelos celulares a cada ~8 s. Só informativo: o resultado oficial continua vindo do datalogger. Vermelho = sem sinal há mais de 90 s.</Text>
      <MapaWeb wps={rota.length > 1 ? [rota[0], rota[rota.length - 1]] : []} coords={rota} marks={marks} height={Platform.OS === 'web' ? 460 : 320} />
      {linhas.length === 0 && <Text style={st.tipTx}>Ninguém transmitindo agora. Os pontos aparecem quando o competidor está em prova (ou o participante gravando) com internet.</Text>}
      {linhas.map((x, i) => (
        <View key={x.uid} style={[st.line, { borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 6 }]}>
          <Text style={[st.v, { flex: 1 }]}>{i + 1}º · {x.numero ? `#${x.numero} ` : ''}{x.nome}</Text>
          <Text style={{ color: x.idade > 90 ? '#ff5252' : '#4caf50', fontWeight: '800' }}>
            {x.km != null ? `km ${x.km.toFixed(1)} · ` : ''}{x.spd != null ? `${x.spd} km/h · ` : ''}{x.idade > 90 ? `sem sinal há ${fmtIdade(x.idade)}` : `há ${fmtIdade(x.idade)}`}
          </Text>
        </View>
      ))}
    </View>
  );
}
