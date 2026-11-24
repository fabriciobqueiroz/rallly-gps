// Roadbook externo (.nbp): prova criada em outro sistema. O arquivo traz só o roadbook (imagens das tulipas + roteiro
// com distância, média e tempo ideal); a conferência é feita depois pelo rastreador do outro organizador.
// Aqui o app importa o arquivo e guia a corrida pelo hodômetro (distância do GPS) e pelo tempo ideal.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { unzipSync } from 'fflate';
import { loadJson, saveJson } from './persist';
import { cumulative } from './rally';
import { RelogioPainel, offsetGps } from './relogio';

const latin1 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
const num = (t) => parseFloat(String(t || '0').replace(',', '.')) || 0;
const secs = (t) => { const m = /^(\d+):(\d+):(\d+(?:[.,]\d+)?)$/.exec(String(t || '').trim()); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + num(m[3]) : 0; };
const slugDe = (s) => String(s || 'PROVA').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 24) || 'PROVA';
const p2 = (n) => String(n).padStart(2, '0');
const hms = (s) => { const x = Math.max(0, s); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), r = x - h * 3600 - m * 60; return `${h}:${p2(m)}:${r.toFixed(2).padStart(5, '0')}`; };
const sgn = (s) => `${s > 0 ? '+' : s < 0 ? '−' : ''}${Math.abs(s).toFixed(2)} s`;
const km3 = (k) => k.toFixed(3).replace('.', ',');

// Lê o texto do roteiro. Cada linha: n;tulipa;tipo(V/D/N);distância km;média km/h (V) ou duração (D/N);tempo ideal;trecho;distância da próxima;0
export function lerRoteiro(txt) {
  const linhas = txt.split(/\r?\n/);
  const cab = {};
  linhas.slice(0, 6).forEach((l) => { const m = /^(\w+)\s*=\s*(.*)$/.exec(l.trim()); if (m) cab[m[1].toLowerCase()] = m[2].trim(); });
  const rows = [];
  linhas.forEach((l) => {
    const c = l.split(';');
    if (c.length < 9 || !/^\d+$/.test(c[0]) || !/^\d+$/.test(c[1])) return;
    const tipo = c[2];
    rows.push({ n: +c[1], tipo, d: num(c[3]), v: tipo === 'V' ? num(c[4]) : 0, dur: tipo === 'V' ? 0 : secs(c[4]), t: secs(c[5]), tr: +c[6], dn: num(c[7]) });
  });
  return { nome: cab.prova || 'Prova', cat: cab.categoria || '', data: cab.data || '', rows };
}

async function importar(onOk) {
  if (Platform.OS === 'web') return Alert.alert('Só no celular', 'Importe o arquivo .nbp no aplicativo do celular.');
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return;
  try {
    const bytes = await new File(r.assets[0].uri).bytes();
    const files = unzipSync(bytes);
    const tplK = Object.keys(files).find((k) => /\.tpl$/i.test(k));
    if (!tplK) throw new Error('Este arquivo não tem o roteiro (.tpl). É mesmo um .nbp?');
    const rot = lerRoteiro(latin1(files[tplK]));
    if (!rot.rows.length) throw new Error('Não encontrei tulipas no roteiro.');
    const slug = slugDe(rot.nome);
    let nImg = 0;
    Object.keys(files).forEach((k) => {
      const m = /^(REF\d+(?:_\d+)?)\.gif$/i.exec(k.split('/').pop());
      if (!m) return;
      try { const f = new File(Paths.document, `nbp_${slug}_${m[1].toUpperCase()}.gif`); if (f.exists) f.delete(); f.create(); f.write(files[k]); nImg++; } catch {}
    });
    saveJson('nbp_' + slug, rot);
    const idx = loadJson('nbp_index', []).filter((x) => x.slug !== slug);
    saveJson('nbp_index', [{ slug, nome: rot.nome, cat: rot.cat, data: rot.data, n: rot.rows.length, imgs: nImg }, ...idx]);
    onOk(slug);
    Alert.alert('Importado', `${rot.nome}\n${rot.rows.length} tulipas · ${nImg} imagens.`);
  } catch (e) { Alert.alert('Não consegui ler o arquivo', String(e?.message || e)); }
}

const imgUri = (slug, n) => { try { const f = new File(Paths.document, `nbp_${slug}_REF${String(n).padStart(4, '0')}.gif`); return f.exists ? f.uri : null; } catch { return null; } };

function Cartao({ slug, row, altura }) {
  const uri = row ? imgUri(slug, row.n) : null;
  if (!row) return null;
  return uri
    ? <Image source={{ uri }} style={{ width: '100%', height: altura, backgroundColor: '#fff', borderRadius: 6 }} resizeMode="contain" />
    : <View style={{ height: altura, backgroundColor: '#262b32', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff' }}>Tulipa {row.n} (sem imagem)</Text></View>;
}

function Corrida({ st, slug, points, running, start, voltar }) {
  const dados = useMemo(() => loadJson('nbp_' + slug, null), [slug]);
  const rows = dados ? dados.rows : [];
  const [t0, setT0] = useState(() => loadJson('nbpt0_' + slug, 0));
  const [base, setBase] = useState(() => loadJson('nbpbase_' + slug, 0)); // metros acumulados do GPS na última zerada
  const [adj, setAdj] = useState(0); // ajuste manual em metros
  const [idx, setIdx] = useState(() => loadJson('nbpidx_' + slug, 0));
  const [hora, setHora] = useState('');
  const [ajuste, setAjusteS] = useState(() => loadJson('nbpadj_' + slug, 0)); // ms
  const setAjuste = (f) => setAjusteS((a) => { const v = typeof f === 'function' ? f(a) : f; saveJson('nbpadj_' + slug, v); return v; });
  const offG = useMemo(() => offsetGps(points), [points]);
  const offRef = useRef(0); offRef.current = offG;
  const adjRef = useRef(0); adjRef.current = ajuste;
  const bruto = () => Date.now() + offRef.current; // horário do GPS, sem o ajuste
  const relogio = () => Date.now() + offRef.current + adjRef.current;
  const [agora, setAgora] = useState(() => Date.now());
  const [aviso, setAviso] = useState('');
  const [parada, setParada] = useState(0); // início da contagem do neutro (ms)
  useEffect(() => { const id = setInterval(() => setAgora(Date.now() + offRef.current + adjRef.current), 100); return () => clearInterval(id); }, []);
  const cum = useMemo(() => cumulative(points), [points]);
  const gpsM = cum.length ? cum[cum.length - 1] : 0;
  const odo = Math.max(0, (gpsM - base + adj) / 1000); // km desde o último zero
  const salva = (k, v) => saveJson(k + slug, v);
  const r = rows[idx], prox = rows[idx + 1];

  // Avanço automático pela distância do hodômetro.
  const idxRef = useRef(idx); idxRef.current = idx;
  const paradaRef = useRef(0); paradaRef.current = parada;
  useEffect(() => {
    if (!rows.length || !t0) return;
    let i = idxRef.current, mexeu = false, novoBase = null;
    for (let guarda = 0; guarda < 4; guarda++) {
      const a = rows[i], b = rows[i + 1];
      if (!b) break;
      if (a.tipo === 'N' && !(paradaRef.current && relogio() - paradaRef.current >= a.dur * 1000) && odo < a.d + 0.03) break; // neutro: só segue depois da parada (ou se o carro já saiu)
      if (b.d === 0 && a.dn > 0) { // próximo ponto zera o hodômetro: quando chegar ao fim do trecho, zera sozinho
        if (odo >= a.dn - 0.004) { i++; mexeu = true; novoBase = gpsM; setAviso('Hodômetro zerado automaticamente. Se o carro não zerou neste ponto, use "Zerar agora" onde for certo.'); }
        break;
      }
      if (odo >= b.d - 0.004) { i++; mexeu = true; } else break;
    }
    if (mexeu) { setParada(0); setIdx(i); salva('nbpidx_', i); if (novoBase != null) { setBase(novoBase); setAdj(0); salva('nbpbase_', novoBase); } }
  }, [odo, t0, agora]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dados) return <View style={st.card}><Text style={st.tipTx}>Roteiro não encontrado.</Text></View>;

  const largarAgora = () => { const t = relogio(); setT0(t); salva('nbpt0_', t); setBase(gpsM); setAdj(0); salva('nbpbase_', gpsM); setIdx(0); salva('nbpidx_', 0); setAviso(''); if (!running) start(); };
  const largarAs = () => {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hora.trim());
    if (!m) return Alert.alert('Horário', 'Digite no formato hh:mm:ss (ex.: 08:30:00).');
    const d = new Date(relogio()); d.setHours(+m[1], +m[2], +(m[3] || 0), 0);
    if (d.getTime() < relogio() - 60000) d.setDate(d.getDate() + 1);
    setT0(d.getTime()); salva('nbpt0_', d.getTime()); setIdx(0); salva('nbpidx_', 0); setAviso(''); if (!running) start();
  };
  const zerarAgora = () => { setBase(gpsM); setAdj(0); salva('nbpbase_', gpsM); };
  const ir = (i) => { const k = Math.max(0, Math.min(rows.length - 1, i)); setIdx(k); salva('nbpidx_', k); };
  const ajusta = (m) => setAdj((a) => a + m);
  const reiniciar = () => Alert.alert('Recomeçar', 'Apagar largada e posição desta prova?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Recomeçar', style: 'destructive', onPress: () => { setT0(0); salva('nbpt0_', 0); setIdx(0); salva('nbpidx_', 0); setBase(0); salva('nbpbase_', 0); setAdj(0); setParada(0); setAviso(''); } }]);

  const decorrido = t0 ? (agora - t0) / 1000 : null; // s desde a largada (negativo = faltam)
  // Tempo ideal na posição atual: dentro de um trecho V avança pela média; D e N ficam no tempo da linha.
  let ideal = r ? r.t : 0;
  if (r && r.tipo === 'V' && r.v > 0) ideal = r.t + ((odo - r.d) * 3600) / r.v;
  if (r && prox && r.tipo === 'V' && prox.t > r.t) ideal = Math.min(ideal, prox.t);
  const dif = decorrido != null && decorrido >= 0 ? decorrido - ideal : null; // + atrasado, − adiantado
  const neutro = r && r.tipo === 'N' ? r : null;
  const restaN = neutro && parada ? neutro.dur - (agora - parada) / 1000 : null;
  const proxMetros = prox ? Math.round((prox.d - odo) * 1000) : null;

  return (
    <View>
      <View style={st.card}>
        <Text style={st.tip}>{dados.nome}{dados.cat ? ` · ${dados.cat}` : ''}</Text>
        <Text style={st.tipTx}>{dados.data}</Text>
        <TouchableOpacity style={st.btn2} onPress={voltar}><Text style={st.btn2Tx}>‹ Provas importadas</Text></TouchableOpacity>
      </View>

      <RelogioPainel st={st} agora={agora} bruto={bruto} ajuste={ajuste} setAjuste={setAjuste} comGps={points.length > 0} />

      {!t0 ? (
        <View style={st.card}>
          <Text style={st.tip}>Largada</Text>
          <Text style={st.tipTx}>O tempo ideal do roteiro conta a partir da sua largada (00:00:00). Ligue o GPS e largue agora, ou informe o horário da sua largada.</Text>
          <TouchableOpacity style={[st.btn2, { backgroundColor: '#4caf50', marginVertical: 6 }]} onPress={largarAgora}><Text style={[st.btn2Tx, { color: '#0c1014' }]}>LARGAR AGORA</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput style={[st.input, { flex: 1 }]} value={hora} onChangeText={setHora} placeholder="hh:mm:ss" placeholderTextColor="#666" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={[st.btn2, { flex: 0, paddingHorizontal: 14 }]} onPress={largarAs}><Text style={st.btn2Tx}>Largar neste horário</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      {t0 ? (
        <View style={st.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View><Text style={st.tipTx}>HODÔMETRO (km)</Text><Text style={{ color: '#fff', fontSize: 40, fontWeight: '900' }}>{km3(odo)}</Text></View>
            <View style={{ alignItems: 'flex-end' }}><Text style={st.tipTx}>TEMPO DE PROVA</Text><Text style={{ color: decorrido < 0 ? '#ffb300' : '#fff', fontSize: 30, fontWeight: '900' }}>{decorrido < 0 ? `−${hms(-decorrido)}` : hms(decorrido)}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <View><Text style={st.tipTx}>IDEAL AGORA</Text><Text style={{ color: '#d0d6de', fontSize: 22, fontWeight: '800' }}>{hms(ideal)}</Text></View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={st.tipTx}>{dif == null ? '' : dif > 0 ? 'ATRASADO' : 'ADIANTADO'}</Text>
              <Text style={{ color: dif == null ? '#888' : Math.abs(dif) < 1 ? '#4caf50' : dif > 0 ? '#ff5252' : '#29b6f6', fontSize: 28, fontWeight: '900' }}>{dif == null ? '—' : sgn(dif)}</Text>
            </View>
          </View>
          {r && r.tipo === 'V' ? <Text style={[st.tip, { marginTop: 4 }]}>Média do trecho: {r.v} km/h · trecho {r.tr}</Text> : null}
          {r && r.tipo === 'D' ? <Text style={[st.tip, { marginTop: 4, color: '#ffe600' }]}>Deslocamento: tempo livre até {hms(r.t + r.dur)} de prova</Text> : null}
          {neutro ? (
            <View style={{ backgroundColor: '#6a1b9a', borderRadius: 10, padding: 10, marginTop: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>NEUTRO · pare {hms(neutro.dur)}</Text>
              {parada ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 32 }}>{restaN > 0 ? hms(restaN) : 'PODE SEGUIR'}</Text>
                : <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={() => setParada(relogio())}><Text style={st.btn2Tx}>Parei — iniciar contagem</Text></TouchableOpacity>}
            </View>
          ) : null}
          {!running ? <TouchableOpacity style={[st.btn2, { backgroundColor: '#4caf50', marginTop: 8 }]} onPress={start}><Text style={[st.btn2Tx, { color: '#0c1014' }]}>LIGAR GPS</Text></TouchableOpacity> : null}
          {aviso ? <Text style={[st.tipTx, { color: '#ffb300', marginTop: 6 }]}>{aviso}</Text> : null}
        </View>
      ) : null}

      <View style={st.card}>
        <Text style={st.tip}>Tulipa {r ? r.n : '—'} de {rows.length}</Text>
        <Cartao slug={slug} row={r} altura={230} />
        {prox ? (
          <View style={{ marginTop: 8 }}>
            <Text style={st.tipTx}>Próxima: tulipa {prox.n} · {proxMetros != null && prox.d > 0 ? `faltam ${Math.max(0, proxMetros)} m` : 'após zerar o hodômetro'}</Text>
            <Cartao slug={slug} row={prox} altura={150} />
          </View>
        ) : <Text style={st.tipTx}>Última tulipa.</Text>}
      </View>

      <View style={st.card}>
        <Text style={st.tip}>Ajustes</Text>
        <View style={st.row}>
          {[-50, -10, 10, 50].map((m) => <TouchableOpacity key={m} style={st.btn2} onPress={() => ajusta(m)}><Text style={st.btn2Tx}>{m > 0 ? '+' : ''}{m} m</Text></TouchableOpacity>)}
        </View>
        <View style={st.row}>
          <TouchableOpacity style={st.btn2} onPress={() => ir(idx - 1)}><Text style={st.btn2Tx}>‹ Tulipa anterior</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={() => ir(idx + 1)}><Text style={st.btn2Tx}>Próxima tulipa ›</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={zerarAgora}><Text style={st.btn2Tx}>Zerar hodômetro agora</Text></TouchableOpacity>
        <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={reiniciar}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Recomeçar esta prova</Text></TouchableOpacity>
        <Text style={st.tipTx}>Os ajustes de metros e de tulipa servem para casar o app com o hodômetro do carro. O rastro continua sendo gravado normalmente.</Text>
      </View>
    </View>
  );
}

export default function NbpTela({ st, points, running, start }) {
  const [lista, setLista] = useState(() => loadJson('nbp_index', []));
  const [sel, setSel] = useState(null);
  const recarrega = () => setLista(loadJson('nbp_index', []));
  const apagar = (x) => Alert.alert('Apagar', `Remover "${x.nome}" deste aparelho?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => {
    saveJson('nbp_index', loadJson('nbp_index', []).filter((y) => y.slug !== x.slug)); saveJson('nbp_' + x.slug, null);
    ['nbpt0_', 'nbpbase_', 'nbpidx_', 'nbpadj_'].forEach((k) => saveJson(k + x.slug, 0));
    try { Paths.document.list().forEach((f) => { if (f.name && f.name.startsWith(`nbp_${x.slug}_`)) f.delete(); }); } catch {}
    recarrega();
  } }]);
  if (sel) return <Corrida st={st} slug={sel} points={points} running={running} start={start} voltar={() => { setSel(null); recarrega(); }} />;
  return (
    <View>
      <View style={st.card}>
        <Text style={st.tip}>Roadbook de outro sistema (.nbp)</Text>
        <Text style={st.tipTx}>Para provas criadas em outro sistema: o organizador fornece o arquivo .nbp e confere depois com o rastreador dele. Aqui você importa o arquivo e corre a prova guiado pelo hodômetro e pelo tempo ideal.</Text>
        <TouchableOpacity style={[st.btn2, { marginTop: 8, backgroundColor: '#ff7a2e' }]} onPress={() => importar((slug) => { recarrega(); setSel(slug); })}><Text style={[st.btn2Tx, { color: '#0c1014' }]}>Importar arquivo .nbp</Text></TouchableOpacity>
      </View>
      {lista.map((x) => (
        <View key={x.slug} style={st.card}>
          <Text style={st.tip}>{x.nome}</Text>
          <Text style={st.tipTx}>{x.cat} · {x.data} · {x.n} tulipas</Text>
          <View style={st.row}>
            <TouchableOpacity style={st.btn2} onPress={() => setSel(x.slug)}><Text style={st.btn2Tx}>Abrir para correr</Text></TouchableOpacity>
            <TouchableOpacity style={st.btn2} onPress={() => apagar(x)}><Text style={[st.btn2Tx, { color: '#ff5252' }]}>Apagar</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      {lista.length === 0 ? <Text style={st.tipTx}>Nenhum roadbook importado ainda.</Text> : null}
    </View>
  );
}
