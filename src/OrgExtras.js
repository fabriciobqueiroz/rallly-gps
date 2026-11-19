// Painéis do organizador: categorias e médias, inscrições com largada, liberações, gravação dirigindo e resultado oficial.
import { useEffect, useRef, useState } from 'react';
import { loadJson, saveJson } from './persist';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { atualizarInscricao, enviarResultado, inscrever, ouvirDataloggers, ouvirRanking, removerInscricao, salvarProva } from './firebase';
import { compartilharResultadosPdf } from './pdf';
import { cumulative, oficialDeTrilha, pcsDoLogger, pontos, rank } from './rally';
import { getState } from './store';

export const CATS_PADRAO = [{ nome: 'TURISMO LIGHT', g: 0 }, { nome: 'TURISMO', g: 0 }, { nome: 'GRADUADO', g: 0 }, { nome: 'MASTER', g: 0 }];
const LETRAS = 'ABCDEF';
const p2 = (x) => String(x).padStart(2, '0');
export const parseHMS = (t) => { const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(t || '').trim()); return m ? +m[1] * 3600 + +m[2] * 60 + (+m[3] || 0) : null; };
export const fmtHMS = (s) => `${p2(Math.floor(s / 3600) % 24)}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`;
const parseDT = (t) => { const d = new Date(String(t || '').trim().replace(' ', 'T')); return isNaN(d) ? null : d.getTime(); };

// Situação da janela de liberação da planilha. Sem período definido = sempre liberada.
export function planilhaLiberada(lib, now = Date.now()) {
  const a = parseDT(lib?.ini), b = parseDT(lib?.fim);
  if (a == null && b == null) return true;
  return (a == null || now >= a) && (b == null || now <= b);
}

const Chip = ({ st, on, onPress, children, small }) => (
  <TouchableOpacity style={[st.btn2, { flex: 0, paddingHorizontal: small ? 10 : 14, paddingVertical: small ? 4 : 6 }, on && { backgroundColor: '#ff7a2e' }]} onPress={onPress}>
    <Text style={[st.btn2Tx, on && { color: '#0c1014' }]}>{children}</Text>
  </TouchableOpacity>
);
const Wrap = ({ children }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>{children}</View>;

// ---------- Categorias e grupos de média ----------
export function OrgCategorias({ st, prova, categorias }) {
  const [novo, setNovo] = useState('');
  const cats = categorias.length ? categorias : CATS_PADRAO;
  const ng = Math.max(...cats.map((c) => c.g || 0)) + 1;
  const salvar = (next) => salvarProva(prova, { categorias: next }).catch((e) => Alert.alert('Não salvou', String(e?.message || e)));
  const add = () => {
    const nome = novo.trim().toUpperCase();
    if (!nome) return;
    if (cats.some((c) => c.nome === nome)) return Alert.alert('Já existe', nome);
    salvar([...cats, { nome, g: 0 }]); setNovo('');
  };
  return (
    <View style={st.card}>
      <Text style={st.tip}>Categorias e grupos de média</Text>
      <Text style={st.tipTx}>Categorias do mesmo grupo (mesma letra) usam a mesma média em cada trecho. Ex.: todas no grupo A, ou separe as que terão média diferente. Os competidores escolhem a categoria na inscrição.</Text>
      {cats.map((c) => (
        <View key={c.nome} style={{ borderTopWidth: 1, borderTopColor: '#262b32', paddingVertical: 8 }}>
          <View style={st.line}>
            <Text style={st.v}>{c.nome}</Text>
            <TouchableOpacity onPress={() => salvar(cats.filter((x) => x.nome !== c.nome))}><Text style={{ color: '#ff5252', fontWeight: '700' }}>remover</Text></TouchableOpacity>
          </View>
          <Wrap>
            {Array.from({ length: Math.min(ng + 1, 6) }, (_, g) => (
              <Chip key={g} st={st} small on={(c.g || 0) === g} onPress={() => salvar(cats.map((x) => (x.nome === c.nome ? { ...x, g } : x)))}>Grupo {LETRAS[g]}</Chip>
            ))}
          </Wrap>
        </View>
      ))}
      <View style={[st.row, { marginTop: 10, marginBottom: 0 }]}>
        <TextInput style={[st.field, { flex: 1, marginTop: 0 }]} value={novo} onChangeText={setNovo} placeholder="Nova categoria" placeholderTextColor="#666" autoCapitalize="characters" />
        <TouchableOpacity style={[st.btn2, { flex: 0, paddingHorizontal: 16 }]} onPress={add}><Text style={st.btn2Tx}>Adicionar</Text></TouchableOpacity>
      </View>
      {categorias.length === 0 && (
        <TouchableOpacity style={[st.btn2, { marginTop: 10 }]} onPress={() => salvar(CATS_PADRAO)}><Text style={st.btn2Tx}>Usar estas categorias na prova</Text></TouchableOpacity>
      )}
      <Text style={st.tipTx}>{ng} grupo(s) de média. As médias de cada trecho são preenchidas na aba Planilha.</Text>
    </View>
  );
}

// ---------- Inscrições, largada e sorteio ----------
export function OrgInscricoes({ st, prova, inscritos, categorias }) {
  const cats = (categorias.length ? categorias : CATS_PADRAO).map((c) => c.nome);
  const bk = 'base_' + String(prova).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const [base, setBaseRaw] = useState(() => loadJson(bk, { h: '09:00:00' }).h);
  const setBase = (v) => { setBaseRaw(v); saveJson(bk, { h: v }); };
  const iv = '60'; // intervalo fixo entre carros: 60 s
  const [f, setF] = useState({ numero: '', piloto: '', navegador: '', email: '', classe: cats[0] });
  const [edit, setEdit] = useState({});
  const ordenados = [...cats, ...inscritos.map((p) => p.classe).filter((c) => !cats.includes(c))];

  const aplicar = (lista) => {
    const b = parseHMS(base);
    if (b == null) return Alert.alert('Horário inválido', 'Use HH:MM:SS, ex.: 09:00:00');
    const step = parseFloat(String(iv).replace(',', '.')) || 0;
    lista.forEach((p, k) => atualizarInscricao(prova, p.numero, { ordem: k + 1, largada: fmtHMS(Math.round(b + k * step)) }).catch(() => {}));
  };
  const porCat = (c) => inscritos.filter((p) => p.classe === c);
  const embaralha = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const sortearTudo = () => aplicar(ordenados.flatMap((c) => embaralha(porCat(c))));
  const sortearCat = (cat) => aplicar(ordenados.flatMap((c) => (c === cat ? embaralha(porCat(c)) : porCat(c))));
  const porNumero = () => aplicar(ordenados.flatMap((c) => [...porCat(c)].sort((a, b) => Number(a.numero) - Number(b.numero))));
  const add = async () => {
    if (!f.numero.trim() || !f.piloto.trim()) return Alert.alert('Falta preencher', 'Informe número e piloto.');
    try { await inscrever({ prova, numero: f.numero.trim(), piloto: f.piloto.trim(), navegador: f.navegador.trim(), classe: f.classe, email: f.email.trim() }); setF({ ...f, numero: '', piloto: '', navegador: '', email: '' }); }
    catch (e) { Alert.alert('Não inscreveu', String(e?.message || e)); }
  };
  const salvarLarg = (p) => {
    const v = edit[p.numero];
    if (v == null) return;
    const s = parseHMS(v);
    if (s == null) return Alert.alert('Horário inválido', 'Use HH:MM:SS');
    atualizarInscricao(prova, p.numero, { largada: fmtHMS(s) }).catch(() => {});
    setEdit((e) => { const n = { ...e }; delete n[p.numero]; return n; });
  };

  return (
    <View>
      <View style={st.card}>
        <Text style={st.tip}>Largada e sorteio</Text>
        <View style={st.row}>
          <TextInput style={[st.field, { flex: 1 }]} value={base} onChangeText={setBase} placeholder="Primeiro carro HH:MM:SS" placeholderTextColor="#666" keyboardType="numbers-and-punctuation" />
          <View style={[st.field, { flex: 1, justifyContent: 'center' }]}><Text style={st.v}>Intervalo: 60 s</Text></View>
        </View>
        <View style={st.row}>
          <TouchableOpacity style={st.btn2} onPress={sortearTudo}><Text style={st.btn2Tx}>Sortear tudo</Text></TouchableOpacity>
          <TouchableOpacity style={st.btn2} onPress={porNumero}><Text style={st.btn2Tx}>Ordem por número</Text></TouchableOpacity>
        </View>
        <Text style={st.tipTx}>A ordem segue as categorias na ordem cadastrada. O horário de cada carro vai direto para o celular do competidor.</Text>
      </View>
      <View style={st.card}>
        <Text style={st.tip}>Adicionar inscrição</Text>
        <TextInput style={st.field} value={f.numero} onChangeText={(v) => setF({ ...f, numero: v })} placeholder="Número" placeholderTextColor="#666" keyboardType="number-pad" />
        <TextInput style={st.field} value={f.piloto} onChangeText={(v) => setF({ ...f, piloto: v })} placeholder="Piloto" placeholderTextColor="#666" />
        <TextInput style={st.field} value={f.navegador} onChangeText={(v) => setF({ ...f, navegador: v })} placeholder="Navegador" placeholderTextColor="#666" />
        <TextInput style={st.field} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} placeholder="E-mail" placeholderTextColor="#666" autoCapitalize="none" keyboardType="email-address" />
        <Wrap>{cats.map((c) => <Chip key={c} st={st} small on={f.classe === c} onPress={() => setF({ ...f, classe: c })}>{c}</Chip>)}</Wrap>
        <TouchableOpacity style={[st.btn, { marginTop: 10, marginBottom: 0 }]} onPress={add}><Text style={st.btnTx}>Adicionar inscrição</Text></TouchableOpacity>
      </View>
      <View style={st.card}>
        <Text style={st.tip}>Inscrições · total {inscritos.length}</Text>
        {inscritos.length === 0 && <Text style={st.tipTx}>Ninguém inscrito ainda. Os competidores se inscrevem na aba Gravar.</Text>}
        {ordenados.filter((c) => porCat(c).length).map((c) => (
          <View key={c} style={{ marginTop: 8 }}>
            <View style={[st.line, { backgroundColor: '#1b6b85', borderRadius: 8, paddingHorizontal: 10, alignItems: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{c} ({porCat(c).length})</Text>
              <TouchableOpacity onPress={() => sortearCat(c)}><Text style={{ color: '#fff', fontWeight: '700' }}>sortear</Text></TouchableOpacity>
            </View>
            {porCat(c).map((p) => (
              <View key={p.numero} style={{ borderBottomWidth: 1, borderBottomColor: '#262b32', paddingVertical: 8 }}>
                <View style={st.line}>
                  <Text style={st.v}>#{p.numero} {p.piloto}{p.navegador ? ` / ${p.navegador}` : ''}</Text>
                  <TouchableOpacity onPress={() => removerInscricao(prova, p.numero).catch(() => {})}><Text style={{ color: '#ff5252', fontWeight: '700' }}>remover</Text></TouchableOpacity>
                </View>
                {p.email ? <Text style={st.tipTx}>{p.email}</Text> : null}
                <View style={st.line}>
                  <Text style={st.k}>Largada {p.ordem ? `(${p.ordem}º)` : ''}</Text>
                  <TextInput style={st.input} value={edit[p.numero] ?? p.largada ?? ''} placeholder="--:--:--" placeholderTextColor="#666"
                    onChangeText={(v) => setEdit((e) => ({ ...e, [p.numero]: v }))} onEndEditing={() => salvarLarg(p)} keyboardType="numbers-and-punctuation" />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------- Liberações ----------
export function OrgLiberacao({ st, prova, lib }) {
  const [ini, setIni] = useState(lib.ini || '');
  const [fim, setFim] = useState(lib.fim || '');
  useEffect(() => { setIni(lib.ini || ''); setFim(lib.fim || ''); }, [lib.ini, lib.fim]);
  const ok = planilhaLiberada({ ini, fim });
  const salvar = (patch) => salvarProva(prova, { lib: patch }).catch((e) => Alert.alert('Não salvou', String(e?.message || e)));
  const semPeriodo = !parseDT(ini) && !parseDT(fim);
  return (
    <View style={st.card}>
      <Text style={st.tip}>Liberação para os competidores</Text>
      <Text style={st.tipTx}>Período em que as tulipas e o roadbook ficam visíveis aos competidores. Formato AAAA-MM-DD HH:MM. Vazio = sempre liberado.</Text>
      <TextInput style={st.field} value={ini} onChangeText={setIni} placeholder="Início, ex.: 2026-08-15 18:00" placeholderTextColor="#666" autoCapitalize="none" />
      <TextInput style={st.field} value={fim} onChangeText={setFim} placeholder="Fim, ex.: 2026-08-16 20:00" placeholderTextColor="#666" autoCapitalize="none" />
      <Text style={[st.tipTx, { color: semPeriodo ? '#a8a8a8' : ok ? '#4caf50' : '#ffb300' }]}>{semPeriodo ? 'Sem período de liberação definido' : ok ? 'Liberada agora' : 'Fora do período agora'}</Text>
      <TouchableOpacity style={[st.btn2, { marginVertical: 8 }]} onPress={() => salvar({ ini: ini.trim(), fim: fim.trim() })}><Text style={st.btn2Tx}>Salvar período</Text></TouchableOpacity>
      <View style={st.line}>
        <Text style={[st.k, { flex: 1 }]}>Liberar resultado geral no app{'\n'}<Text style={{ fontSize: 12 }}>Só habilite após a premiação.</Text></Text>
        <Switch value={lib.resultado !== false} onValueChange={(v) => salvar({ resultado: v })} />
      </View>
      <View style={st.line}>
        <Text style={[st.k, { flex: 1 }]}>Liberar soma de pontos no app</Text>
        <Switch value={lib.soma !== false} onValueChange={(v) => salvar({ soma: v })} />
      </View>
      <Text style={st.tipTx}>Nos testes tudo começa liberado. O organizador sempre vê tudo.</Text>
    </View>
  );
}

// ---------- Gravar planilha dirigindo ----------
export function Dirigindo({ st, last, wps, setWps, refs, setRefs, nPend }) {
  const ini = useRef(null);
  const pronto = () => {
    const { points } = getState();
    const l = points[points.length - 1];
    if (!l || (l.acc != null && l.acc > 25) || Date.now() - l.t > 6000) { Alert.alert('GPS sem sinal bom', 'Inicie a gravação na aba Gravar e espere o GPS ficar verde.'); return null; }
    return { points, l };
  };
  const largada = () => { const r = pronto(); if (!r) return; ini.current = r.points.length - 1; nPend.current = new Set(); setRefs([]); setWps([[r.l.lat, r.l.lon]]); };
  const pc = (neutro) => {
    const r = pronto(); if (!r) return;
    if (!wps.length) return Alert.alert('Marque a largada primeiro');
    if (neutro) nPend.current.add(wps.length - 1);
    setWps((w) => [...w, [r.l.lat, r.l.lon]]);
  };
  const ref = () => {
    const r = pronto(); if (!r) return;
    if (ini.current == null) return Alert.alert('Marque a largada primeiro');
    const cum = cumulative(r.points);
    const km = Math.max(0, (cum[cum.length - 1] - (cum[Math.min(ini.current, cum.length - 1)] || 0)) / 1000);
    setRefs((o) => [...o, { n: o.length + 1, lat: Math.round(r.l.lat * 1e6) / 1e6, lon: Math.round(r.l.lon * 1e6) / 1e6, hdg: r.l.hdg != null && r.l.hdg >= 0 ? Math.round(r.l.hdg) : null, km: Math.round(km * 1000) / 1000 }]);
  };
  const B = ({ cor, tx, on, fg }) => (
    <TouchableOpacity style={{ flex: 1, backgroundColor: cor, borderRadius: 10, paddingVertical: 16, alignItems: 'center' }} onPress={on}>
      <Text style={{ color: fg || '#000', fontWeight: '900', fontSize: 16 }}>{tx}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={st.card}>
      <Text style={st.tip}>Gravar planilha dirigindo</Text>
      <Text style={st.tipTx}>Com a gravação ligada na aba Gravar, dirija o percurso e toque em cada ponto exatamente onde ele fica. O app grava coordenada e direção reais.</Text>
      <View style={[st.row, { marginTop: 8 }]}>
        <B cor="#4caf50" tx="LARGADA" on={largada} />
        <B cor="#ffe600" tx="REF" on={ref} />
        <B cor="#ff5a1f" tx="PC" on={() => pc(false)} />
        <B cor="#c0392b" fg="#fff" tx="PC N" on={() => pc(true)} />
      </View>
      <Text style={st.tipTx}>REF = marco de referência (corrige o odômetro do competidor). PC N = PC com neutro (60 s, ajustável depois). Para a chegada, toque PC no último ponto.</Text>
      <Text style={st.tipTx}>{wps.length} ponto(s) · {refs.length} REF(s){last ? ` · GPS ${last.acc != null ? last.acc.toFixed(0) + ' m' : ''}` : ' · sem GPS'}</Text>
      {refs.map((r) => (
        <View key={r.n} style={st.line}><Text style={st.k}>REF {r.n} · {r.km.toFixed(3)} km</Text><Text style={st.v}>{r.hdg != null ? `${r.hdg}°` : 'sem direção'}</Text></View>
      ))}
      {refs.length > 0 && <TouchableOpacity style={[st.btn2, { marginTop: 6 }]} onPress={() => setRefs((o) => o.slice(0, -1))}><Text style={st.btn2Tx}>Desfazer última REF</Text></TouchableOpacity>}
    </View>
  );
}

// ---------- Resultado oficial ----------
export function OrgResultados({ st, prova, provaMap, grupos, inscritos, categorias }) {
  const [rows, setRows] = useState([]);
  const [dls, setDls] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => ouvirRanking(prova, (r) => setRows(r), () => {}), [prova]);
  useEffect(() => ouvirDataloggers(prova, setDls, () => {}), [prova]);
  const cats = (categorias.length ? categorias : CATS_PADRAO).map((c) => c.nome);

  const calcular = async () => {
    if (!provaMap.wps.length || !provaMap.trechos.length) return Alert.alert('Sem planilha', 'Publique a prova (aba Planilha) antes de calcular o oficial.');
    if (!dls.length) return Alert.alert('Sem dataloggers', 'Nenhum competidor enviou o datalogger ainda.');
    setMsg('Calculando…');
    let ok = 0;
    for (const dl of dls) {
      try {
        const pcs = oficialDeTrilha(pcsDoLogger(dl), provaMap.wps, provaMap.trechos, dl.classe, grupos, dl.tIni || dl.t0);
        await enviarResultado({ prova, numero: dl.numero, nome: dl.nome, classe: dl.classe, pcs, pontos: pontos(pcs), oficial: true });
        ok++;
      } catch (e) { setMsg('Erro: ' + String(e?.message || e)); }
    }
    setMsg(`Oficial calculado para ${ok} de ${dls.length} competidor(es).`);
  };

  const classes = [...cats, ...rows.map((r) => r.classe).filter((c) => !cats.includes(c))].filter((c, i, a) => a.indexOf(c) === i);
  const linhas = classes.flatMap((c) => {
    const rs = rank(rows.filter((r) => r.classe === c && r.oficial));
    const nc = inscritos.filter((p) => p.classe === c && !rs.some((r) => String(r.numero) === String(p.numero))).map((p) => ({ numero: p.numero, nome: p.piloto, classe: c, nc: true }));
    return [...rs, ...nc];
  });
  const por = (c) => linhas.filter((l) => l.classe === c);

  return (
    <View>
      <View style={st.card}>
        <Text style={st.tip}>Resultado oficial</Text>
        <Text style={st.tipTx}>Os competidores enviam o datalogger (trilha completa) pela aba Gravar. O oficial refaz cada PC pelo instante em que o carro passou pelo ponto do mapa, sem depender de calibração ou de toque no botão.</Text>
        <Text style={st.tip}>Dataloggers recebidos: {dls.length}</Text>
        {dls.map((d) => <Text key={d.numero} style={st.tipTx}>#{d.numero} {d.nome} · {d.classe} · {d.t.length} pontos</Text>)}
        <TouchableOpacity style={[st.btn, { marginTop: 10 }]} onPress={calcular}><Text style={st.btnTx}>Calcular resultado oficial</Text></TouchableOpacity>
        {msg ? <Text style={st.tipTx}>{msg}</Text> : null}
      </View>
      <View style={st.card}>
        <Text style={st.tip}>Classificação oficial</Text>
        {linhas.length === 0 && <Text style={st.tipTx}>Ainda sem resultado oficial.</Text>}
        {classes.filter((c) => por(c).length).map((c) => (
          <View key={c} style={{ marginTop: 8 }}>
            <View style={[st.line, { backgroundColor: '#1b6b85', borderRadius: 8, paddingHorizontal: 10 }]}><Text style={{ color: '#fff', fontWeight: '800' }}>{c}</Text></View>
            {por(c).map((r, i) => (
              <View key={r.numero} style={st.line}>
                <Text style={st.k}>{r.nc ? 'NC' : `${i + 1}º`}  #{r.numero} {r.nome}{r.nc ? '' : ` · ${r.npcs} PC`}</Text>
                <Text style={st.v}>{r.nc ? 'N/A' : `${Number(r.pontos).toFixed(1)} pts`}</Text>
              </View>
            ))}
          </View>
        ))}
        {linhas.length > 0 && (
          <TouchableOpacity style={[st.btn2, { marginTop: 10 }]} onPress={() => compartilharResultadosPdf(prova, linhas).catch((e) => Alert.alert('Não gerou o PDF', String(e?.message || e)))}>
            <Text style={st.btn2Tx}>Gerar PDF do resultado</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
