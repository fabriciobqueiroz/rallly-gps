// Overlay de transmissão ao vivo (Fonte de Navegador do OBS) e painel do organizador para controlá-lo.
// URL: <site>/?overlay=CODIGO&delay=SEGUNDOS[&car=NUMERO]   (fundo transparente)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Login from './Login';
import { st } from './estilos';
import { ouvirAoVivo, ouvirAuth, ouvirInscritos, ouvirProva, salvarProva } from './firebase';
import { escalaDe } from './TrackLog';
import { parseHMS } from './OrgExtras';

const LARANJA = '#ff7a2e';
const fmt1 = (n) => (n == null ? '—' : (Math.round(n * 10) / 10).toFixed(1).replace('.', ','));
const corDiff = (d) => (d == null ? '#9aa3ad' : Math.abs(d) < 1 ? '#4caf50' : Math.abs(d) < 3 ? '#ffb300' : '#ff5252');

// Pontos de um carro nos K primeiros PCs (neutro/deslocamento = null não pontua).
const pontosAte = (pcs, K, esc) => (pcs || []).slice(0, K).reduce((a, d) => a + (d == null ? 0 : Math.abs(d) * esc), 0);

// Classificação parcial: compara só até o último PC que pelo menos 2 carros da categoria já passaram.
export function classificar(carros, lib) {
  const cont = (c) => (c.pcs || []).length;
  const ns = carros.map(cont).sort((a, b) => b - a);
  const K = carros.length > 1 ? ns[1] : ns[0] || 0;
  const linhas = carros.map((c) => ({ c, passou: cont(c) >= K, pts: pontosAte(c.pcs, K, escalaDe(lib, c.classe)) }));
  linhas.sort((a, b) => (b.passou - a.passou) || (a.pts - b.pts) || (cont(b.c) - cont(a.c)));
  return { K, linhas };
}

// Estado mostrado = o que o carro enviou há `delay` segundos (para casar com o atraso do vídeo).
function useAoVivo(code, delay) {
  const [lista, setLista] = useState([]);
  const hist = useRef({});
  const [tick, setTick] = useState(0);
  useEffect(() => ouvirAoVivo('prova', code, (docs) => {
    const agora = Date.now();
    docs.forEach((d) => {
      const k = d.numero || d.uid;
      const h = hist.current[k] || (hist.current[k] = []);
      if (!h.length || h[h.length - 1].d.em !== d.em) { h.push({ at: agora, d }); if (h.length > 400) h.shift(); }
    });
    setTick((x) => x + 1);
  }, () => {}), [code]);
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 500); return () => clearInterval(id); }, []);
  useEffect(() => {
    const alvo = Date.now() - delay * 1000;
    const out = [];
    Object.keys(hist.current).forEach((k) => {
      const h = hist.current[k];
      let it = null;
      for (let i = h.length - 1; i >= 0; i--) if (h[i].at <= alvo) { it = h[i]; break; }
      if (it) out.push({ ...it.d, visto: it.at });
    });
    setLista(out);
  }, [tick, delay]);
  return lista;
}

const FONTE = '"Barlow Condensed","Arial Narrow",Impact,sans-serif';
const T = (o) => ({ fontFamily: FONTE, ...o });
const PAINEL = { backgroundColor: 'rgba(25,29,38,0.94)', borderRadius: 18 };
const mmss = (sec) => (sec == null ? '—' : `${Math.floor(sec / 60)}:${(Math.floor((sec % 60) * 10) / 10).toFixed(1).padStart(4, '0')}`);
const hmsT = (sec) => { const x = Math.max(0, sec); const m = Math.floor(x / 60), r = x - m * 60; return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`; };
const sinal = (d) => (d == null ? 'N' : (d > 0 ? '+' : d < 0 ? '−' : '') + fmt1(Math.abs(d)) + 's');

// Linha do percurso em metros a partir do primeiro ponto, com distâncias acumuladas.
function usaLinha(prova) {
  return useMemo(() => {
    const f = (prova && prova.rota) || [];
    const pts = [];
    for (let i = 0; i + 1 < f.length; i += 2) pts.push([f[i], f[i + 1]]);
    if (pts.length < 2) return null;
    const la0 = pts[0][0], lo0 = pts[0][1], kx = Math.cos((la0 * Math.PI) / 180) * 111320, ky = 110540;
    const xy = pts.map((q) => [(q[1] - lo0) * kx, (q[0] - la0) * ky]);
    const cum = [0];
    for (let i = 1; i < xy.length; i++) cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
    return { xy, cum, len: cum[cum.length - 1] || 1, la0, lo0, kx, ky };
  }, [prova && prova.rota]);
}

function Minimapa({ L, dest, outros, S }) {
  const R = S / 2, esc = (R - 18) / 320;
  if (!L || !dest || dest.lat == null) return <View style={{ width: S, height: S, borderRadius: R, backgroundColor: 'rgba(25,29,38,0.94)' }} />;
  const cx = (dest.lon - L.lo0) * L.kx, cy = (dest.lat - L.la0) * L.ky, h = ((dest.hdg || 0) * Math.PI) / 180;
  const tr = (x, y) => { const e = x - cx, n = y - cy; return [R + (e * Math.cos(h) - n * Math.sin(h)) * esc, R - (e * Math.sin(h) + n * Math.cos(h)) * esc]; };
  const d = L.xy.map((q, i) => { const [x, y] = tr(q[0], q[1]); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join(' ');
  return (
    <svg width={S} height={S} style={{ display: 'block' }}>
      <defs><clipPath id="mm"><circle cx={R} cy={R} r={R - 3} /></clipPath></defs>
      <circle cx={R} cy={R} r={R - 1} fill="#141b2b" stroke="#0c1014" strokeWidth="6" />
      <g clipPath="url(#mm)">
        <circle cx={R} cy={R} r={R * 0.5} fill="none" stroke="#243049" strokeWidth="1.5" />
        <path d={d} fill="none" stroke="rgba(255,122,46,0.35)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#ff7a2e" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        {outros.map((o) => { const [x, y] = tr((o.lon - L.lo0) * L.kx, (o.lat - L.la0) * L.ky); return <g key={o.numero}><circle cx={x} cy={y} r="15" fill="#29b6f6" stroke="#fff" strokeWidth="2" /><text x={x} y={y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0c1014" fontFamily="Arial">{o.pos}</text></g>; })}
      </g>
      <polygon points={`${R},${R - 26} ${R + 17},${R + 18} ${R},${R + 8} ${R - 17},${R + 18}`} fill="#fff" stroke="#0c1014" strokeWidth="2" />
      <circle cx={R} cy={36} r="17" fill="#0c1014" stroke="#fff" strokeWidth="2" transform={`rotate(${-(dest.hdg || 0)} ${R} ${R})`} />
      <text x={R} y={42} textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" fontFamily="Arial" transform={`rotate(${-(dest.hdg || 0)} ${R} ${R})`}>N</text>
    </svg>
  );
}

function Velocimetro({ v, max, maxTrecho }) {
  const S = 340, c = S / 2, r = 138, ang = (a) => [c + r * Math.cos((a * Math.PI) / 180), c + r * Math.sin((a * Math.PI) / 180)];
  const arco = (a0, a1) => { const [x0, y0] = ang(a0), [x1, y1] = ang(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const f = Math.min(1, Math.max(0, (v || 0) / max));
  return (
    <View style={[PAINEL, { width: S, height: S, alignItems: 'center', justifyContent: 'center' }]}>
      <svg width={S} height={S} style={{ position: 'absolute' }}>
        <path d={arco(135, 405)} fill="none" stroke="#2c3446" strokeWidth="16" strokeLinecap="round" />
        {f > 0.005 && <path d={arco(135, 135 + 270 * f)} fill="none" stroke="#ff7a2e" strokeWidth="16" strokeLinecap="round" />}
      </svg>
      <Text style={T({ color: '#fff', fontWeight: '800', fontSize: 120, lineHeight: 120 })}>{v != null ? v : '—'}</Text>
      <Text style={T({ color: '#fff', fontWeight: '700', fontSize: 28, letterSpacing: 4, marginTop: -4 })}>KM/H</Text>
      <Text style={T({ color: '#9aa3ad', fontWeight: '600', fontSize: 22, marginTop: 8 })}>máx. no trecho <Text style={{ color: '#fff', fontWeight: '800' }}>{maxTrecho || '—'}</Text></Text>
    </View>
  );
}

function Overlay({ code, delay, car, teste }) {
  const [prova, setProva] = useState(null);
  const [insc, setInsc] = useState([]);
  const vivos = useAoVivo(code, delay);
  const [agora, setAgora] = useState(Date.now());
  const progRef = useRef({});
  const maxRef = useRef({});
  useEffect(() => ouvirProva(code, setProva, () => {}), [code]);
  useEffect(() => ouvirInscritos(code, setInsc, () => {}), [code]);
  useEffect(() => { const id = setInterval(() => setAgora(Date.now()), 200); return () => clearInterval(id); }, []);
  const L = usaLinha(prova);
  const lib = (prova && prova.lib) || {};
  const trechos = (prova && prova.trechos) || [];
  const porNum = useMemo(() => Object.fromEntries(insc.map((i) => [String(i.numero), i])), [insc]);
  const carros = vivos.map((v) => { const i = porNum[String(v.numero)] || {}; return { ...v, nome: i.piloto || v.nome, nav: i.navegador, equipe: i.equipe, classe: i.classe || v.classe, largada: i.largada }; });
  const destNum = String(car || lib.destaque || (carros[0] && carros[0].numero) || '');
  const dest = carros.find((c) => String(c.numero) === destNum) || null;
  const mesmaCat = carros.filter((c) => dest && c.classe === dest.classe);
  const { K, linhas } = classificar(mesmaCat, lib);
  const pos = dest ? linhas.findIndex((l) => l.c === dest) + 1 : 0;
  const meus = dest ? linhas.find((l) => l.c === dest) : null;
  const semSinal = dest && agora - (dest.em || 0) - delay * 1000 > 20000;

  // km percorridos: ponto mais próximo da linha, sem voltar atrás (o percurso pode cruzar a si mesmo)
  const kmTot = trechos.reduce((a, t) => a + (t.km || 0), 0) || (L ? L.len / 1000 : 0);
  const prog = (c) => {
    if (!L || !c || c.lat == null) return 0;
    const x = (c.lon - L.lo0) * L.kx, y = (c.lat - L.la0) * L.ky, ant = progRef.current[c.numero] ?? 0;
    let bi = -1, bd = 1e12;
    for (let i = 0; i < L.xy.length; i++) { const m = L.cum[i]; if (m < ant - 150 || m > ant + 900) continue; const dd = (L.xy[i][0] - x) ** 2 + (L.xy[i][1] - y) ** 2; if (dd < bd) { bd = dd; bi = i; } }
    if (bi < 0 || bd > 80 * 80) for (let i = 0; i < L.xy.length; i++) { const dd = (L.xy[i][0] - x) ** 2 + (L.xy[i][1] - y) ** 2; if (dd < bd) { bd = dd; bi = i; } }
    progRef.current[c.numero] = L.cum[bi];
    return (L.cum[bi] / L.len) * kmTot;
  };
  const kmAtual = dest ? prog(dest) : 0;
  const nPcs = dest ? (dest.pcs || []).length : 0;
  const trAtual = Math.min(trechos.length || 1, (dest && dest.trecho) || nPcs + 1);
  let acc = 0; const fins = trechos.map((t) => (acc += t.km || 0));
  const fimTr = fins[trAtual - 1] ?? kmTot;
  if (dest) { const m = maxRef.current[dest.numero] || (maxRef.current[dest.numero] = {}); if (m.tr !== trAtual) { m.tr = trAtual; m.max = 0; } if ((dest.spd || 0) > m.max) m.max = dest.spd; }
  const maxTr = dest ? (maxRef.current[dest.numero] || {}).max : 0;
  const hora = (t) => { const d = new Date(t); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000; };
  const lg = dest && dest.largada ? parseHMS(dest.largada) : null;
  const tempo = lg != null ? hora(agora - delay * 1000) - lg : null;
  const melhorPc = (i) => { const ds = mesmaCat.map((c) => (c.pcs || [])[i]).filter((x) => x != null); return ds.length > 1 && (dest.pcs || [])[i] != null && Math.abs(dest.pcs[i]) === Math.min(...ds.map((x) => Math.abs(x))); };
  const outrosMapa = dest ? carros.filter((c) => c !== dest && c.lat != null).map((c) => ({ ...c, pos: Math.max(1, linhas.findIndex((l) => l.c === c) + 1) })) : [];
  // linhas da tabela de trechos: do mais recente para trás, no máximo 5
  const ate = Math.min(trechos.length, Math.max(trAtual, 1));
  const ini = Math.max(0, ate - 5);
  const rows = []; for (let i = ini; i < ate; i++) rows.push(i);

  if (!dest) return teste ? (
    <View style={{ flex: 1, backgroundColor: '#0c1014', padding: 30 }}>
      <Text style={{ color: '#ff7a2e', fontSize: 28, fontWeight: '800' }}>Overlay conectado · prova {code}</Text>
      <Text style={{ color: '#fff', fontSize: 20, marginTop: 10 }}>{prova ? 'Prova encontrada: ' + (prova.nome || code) : 'Prova não encontrada (confira o código)'}</Text>
      <Text style={{ color: '#fff', fontSize: 20, marginTop: 6 }}>Carros enviando ao vivo: {carros.length}{delay ? ` (atraso ${delay}s: os dados aparecem ${delay}s depois)` : ''}</Text>
      <Text style={{ color: '#b0b8c4', fontSize: 18, marginTop: 6 }}>Inicie o trecho no app com o GPS ligado. Sem &teste=1 esta tela fica transparente.</Text>
    </View>
  ) : <View style={{ flex: 1, backgroundColor: 'transparent' }} />;
  return (
    <View style={{ width: 1920, height: 1080, backgroundColor: 'transparent' }}>
      {/* Cartão do carro (topo esquerdo) */}
      <View style={[PAINEL, { position: 'absolute', left: 48, top: 40, width: 640, overflow: 'hidden' }]}>
        <View style={{ backgroundColor: '#ff7a2e', height: 54, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={T({ color: '#0c1014', fontWeight: '800', fontSize: 30, letterSpacing: 1 })} numberOfLines={1}>{((prova && prova.nome) || 'RALLY').toUpperCase()}</Text>
          <Text style={T({ color: semSinal ? '#7a0000' : '#0c1014', fontWeight: '800', fontSize: 24 })}>{semSinal ? '● SEM SINAL' : '● AO VIVO'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
          <View style={{ width: 96, height: 96, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={T({ color: '#0c1014', fontWeight: '800', fontSize: 64 })}>{String(dest.numero).padStart(2, '0')}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 18 }}>
            <Text style={T({ color: '#fff', fontWeight: '800', fontSize: 40 })} numberOfLines={1}>{dest.nome}{dest.nav ? ` / ${dest.nav}` : ''}</Text>
            <Text style={T({ color: '#b0b8c4', fontSize: 24 })} numberOfLines={1}>{[dest.classe, dest.equipe].filter(Boolean).join(' · ')} · {fmt1(kmTot)} km</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={T({ color: '#b0b8c4', fontSize: 20, letterSpacing: 2 })}>TEMPO</Text>
            <Text style={T({ color: '#fff', fontWeight: '800', fontSize: 52 })}>{tempo != null ? hmsT(tempo) : '--:--.-'}</Text>
          </View>
        </View>
      </View>

      {/* Trechos (topo direito) */}
      <View style={[PAINEL, { position: 'absolute', right: 48, top: 40, width: 620, padding: 20 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <Text style={T({ color: '#fff', fontWeight: '800', fontSize: 36, letterSpacing: 2 })}>TRECHOS</Text>
          <Text style={T({ color: '#9aa3ad', fontSize: 18, letterSpacing: 1 })}>MÉDIA · TEMPO · DIF.</Text>
        </View>
        {rows.length === 0 && <Text style={T({ color: '#9aa3ad', fontSize: 24 })}>Aguardando o primeiro PC…</Text>}
        {rows.map((i) => {
          const atual = i === trAtual - 1 && (dest.pcs || []).length <= i;
          const d = (dest.pcs || [])[i];
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: 58, marginBottom: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: atual ? 2 : 0, borderColor: '#ff7a2e' }}>
              <Text style={T({ color: '#fff', fontWeight: '700', fontSize: 26, width: 190 })}>T{i + 1} · {fmt1((trechos[i] || {}).km)} km</Text>
              <Text style={T({ color: atual ? '#ff7a2e' : '#fff', fontWeight: '800', fontSize: 32, width: 110 })}>{fmt1(atual ? dest.avg : (dest.pav || [])[i])}</Text>
              <Text style={T({ color: '#d0d6de', fontSize: 26, width: 130 })}>{atual ? 'em curso' : mmss((dest.pel || [])[i])}</Text>
              <Text style={T({ color: atual ? '#9aa3ad' : melhorPc(i) ? '#c792ff' : corDiff(d), fontWeight: '800', fontSize: 28, flex: 1, textAlign: 'right' })}>{atual ? (dest.avg != null && dest.alvo ? sinal(null) && (dest.avg - dest.alvo >= 0 ? '+' : '−') + fmt1(Math.abs(dest.avg - dest.alvo)) + ' km/h' : '') : melhorPc(i) ? 'MELHOR' : sinal(d)}</Text>
            </View>
          );
        })}
      </View>

      {/* Classificação (abaixo dos trechos) */}
      <View style={[PAINEL, { position: 'absolute', right: 48, top: 40 + 20 + 20 + 50 + Math.max(1, rows.length) * 66 + 36, width: 620, padding: 20 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Text style={T({ color: '#ff7a2e', fontWeight: '800', fontSize: 30, letterSpacing: 2 })}>{(dest.classe || 'CLASSIFICAÇÃO').toUpperCase()}</Text>
          <Text style={T({ color: '#9aa3ad', fontSize: 18 })}>{K > 0 ? `PARCIAL APÓS ${K} PC${K > 1 ? 'S' : ''} · MENOS PONTOS VENCE` : 'AGUARDANDO O 1º PC'}</Text>
        </View>
        {linhas.slice(0, 6).map((l, i) => (
          <View key={l.c.numero + '_' + i} style={{ flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 10, borderRadius: 8, backgroundColor: l.c === dest ? 'rgba(255,122,46,0.28)' : 'transparent' }}>
            <Text style={T({ width: 44, color: '#fff', fontWeight: '800', fontSize: 28 })}>{l.passou ? i + 1 : '–'}</Text>
            <Text style={T({ width: 76, color: '#ff7a2e', fontWeight: '800', fontSize: 28 })}>#{l.c.numero}</Text>
            <Text style={T({ flex: 1, color: '#f0f2f5', fontSize: 26 })} numberOfLines={1}>{l.c.nome}</Text>
            <Text style={T({ color: l.passou ? '#fff' : '#9aa3ad', fontWeight: '800', fontSize: 28 })}>{l.passou ? Math.round(l.pts) + ' pts' : `PC ${(l.c.pcs || []).length}`}</Text>
          </View>
        ))}
      </View>

      {/* Minimapa (base esquerda) */}
      <View style={{ position: 'absolute', left: 48, bottom: 78 }}>
        <Minimapa L={L} dest={dest} outros={outrosMapa} S={380} />
        <View style={{ position: 'absolute', bottom: -34, left: 0, right: 0, alignItems: 'center' }}>
          <Text style={T({ color: '#fff', fontWeight: '700', fontSize: 24, backgroundColor: 'rgba(25,29,38,0.94)', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 14 })}>FIM DO T{trAtual} em {fmt1(Math.max(0, fimTr - kmAtual)).replace(',', ',')} km</Text>
        </View>
      </View>

      {/* Barra de progresso (base central) */}
      <View style={[PAINEL, { position: 'absolute', left: 470, width: 820, bottom: 78, paddingHorizontal: 28, paddingVertical: 18, borderRadius: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={T({ color: '#9aa3ad', fontSize: 20, letterSpacing: 2 })}>LARGADA</Text>
          <Text style={T({ color: '#fff', fontWeight: '800', fontSize: 30 })}>KM {fmt1(kmAtual)} <Text style={{ color: '#9aa3ad', fontWeight: '600' }}>/ {fmt1(kmTot)}</Text></Text>
          <Text style={T({ color: '#9aa3ad', fontSize: 20, letterSpacing: 2 })}>CHEGADA</Text>
        </View>
        <View style={{ height: 18, borderRadius: 9, backgroundColor: '#2c3446', marginTop: 10, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (kmAtual / (kmTot || 1)) * 100)}%`, borderRadius: 9, backgroundColor: '#ff7a2e' }} />
          {fins.slice(0, -1).map((f, i) => <View key={i} style={{ position: 'absolute', left: `${(f / (kmTot || 1)) * 100}%`, top: -4, bottom: -4, width: 3, backgroundColor: '#fff' }} />)}
          <View style={{ position: 'absolute', left: `${Math.min(100, (kmAtual / (kmTot || 1)) * 100)}%`, marginLeft: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 3, borderColor: '#ff7a2e' }} />
        </View>
        <View style={{ height: 30 }}>
          {fins.map((f, i) => { const ini2 = i ? fins[i - 1] : 0; const meio = ((ini2 + f) / 2 / (kmTot || 1)) * 100; return <Text key={i} style={T({ position: 'absolute', left: `${meio}%`, marginLeft: -14, top: 6, color: i === trAtual - 1 ? '#fff' : '#9aa3ad', fontWeight: i === trAtual - 1 ? '800' : '500', fontSize: 22 })}>T{i + 1}</Text>; })}
        </View>
      </View>

      {/* Média / posição e velocímetro (base direita) */}
      <View style={{ position: 'absolute', right: 48, bottom: 78, flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
        <View style={[PAINEL, { width: 250, height: 300, padding: 18, justifyContent: 'space-between' }]}>
          <View>
            <Text style={T({ color: '#9aa3ad', fontSize: 20, letterSpacing: 2 })}>MÉDIA</Text>
            <Text style={T({ color: '#fff', fontWeight: '800', fontSize: 58, lineHeight: 60 })}>{fmt1(dest.avg)}</Text>
            <Text style={T({ color: '#b0b8c4', fontSize: 22 })}>alvo {fmt1(dest.alvo)} km/h</Text>
          </View>
          <View>
            <Text style={T({ color: '#9aa3ad', fontSize: 20, letterSpacing: 2 })}>POSIÇÃO</Text>
            <Text style={T({ color: '#fff', fontWeight: '800', fontSize: 64, lineHeight: 66 })}>{pos && meus && meus.passou ? pos + 'º' : '—'}</Text>
            <Text style={T({ color: '#ff7a2e', fontWeight: '800', fontSize: 24 })}>{meus && meus.passou && K ? Math.round(meus.pts) + ' pts · ' + nPcs + ' PCs' : nPcs + ' PCs'}</Text>
          </View>
        </View>
        <Velocimetro v={dest.spd} max={Math.max(120, Math.ceil(Math.max(dest.spd || 0, maxTr || 0) / 20) * 20)} maxTrecho={maxTr} />
      </View>
    </View>
  );
}

// Raiz do overlay: login uma vez (o OBS guarda a sessão) e fundo transparente.
export default function OverlayRoot({ code, delay, car, teste }) {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    if (Platform.OS === 'web') { try { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&display=swap'; document.head.appendChild(l); } catch {} }
    return ouvirAuth((u) => setUser(u || null));
  }, []);
  if (user === undefined) return <View style={{ flex: 1 }} />;
  if (!user) return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0c1014' }} contentContainerStyle={{ padding: 20, maxWidth: 520, alignSelf: 'center', width: '100%' }}>
      <Text style={st.h1}>Overlay · entre uma vez</Text>
      <Text style={st.sub}>Entre com a conta do organizador. Depois o OBS lembra o login.</Text>
      <Login st={st} soOrganizador onEntrou={() => {}} />
    </ScrollView>
  );
  return <Overlay code={String(code).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')} delay={delay} car={car} teste={teste} />;
}

// ---------- Painel do organizador: escolher o carro em destaque e ligar o modo transmissão ----------
export function PainelTransmissao({ st: s, prova, lib }) {
  const [vivos, setVivos] = useState([]);
  const [insc, setInsc] = useState([]);
  const [delay, setDelay] = useState('15');
  useEffect(() => ouvirAoVivo('prova', prova, setVivos, () => {}), [prova]);
  useEffect(() => ouvirInscritos(prova, setInsc, () => {}), [prova]);
  const base = Platform.OS === 'web' ? window.location.origin + window.location.pathname : 'https://fabriciobqueiroz.github.io/rallly-gps/';
  const url = `${base}?overlay=${prova}&delay=${Number(delay) || 0}`;
  const salvar = (patch) => salvarProva(prova, { lib: patch }).catch(() => {});
  const nomes = Object.fromEntries(insc.map((i) => [String(i.numero), i]));
  return (
    <View style={s.card}>
      <Text style={s.tip}>Transmissão ao vivo (OBS / YouTube)</Text>
      <View style={s.line}>
        <Text style={[s.k, { flex: 1 }]}>Modo transmissão{'\n'}<Text style={{ fontSize: 12 }}>Os celulares enviam a telemetria a cada 2 s (consome mais bateria e dados).</Text></Text>
        <TouchableOpacity style={[s.chip, { paddingHorizontal: 14, paddingVertical: 8 }, lib.transmissao && { backgroundColor: '#2e7d32' }]} onPress={() => salvar({ transmissao: !lib.transmissao })}><Text style={[s.btn2Tx, lib.transmissao && { color: '#fff' }]}>{lib.transmissao ? 'LIGADO' : 'Desligado'}</Text></TouchableOpacity>
      </View>
      <Text style={[s.tip, { marginTop: 10 }]}>Carro em destaque</Text>
      {vivos.length === 0 && <Text style={s.tipTx}>Nenhum carro enviando ao vivo agora. Quem iniciou o trecho com o app ligado aparece aqui.</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {vivos.map((v) => {
          const on = String(lib.destaque) === String(v.numero);
          return <TouchableOpacity key={v.uid} style={[s.chip, { paddingHorizontal: 14, paddingVertical: 8 }, on && { backgroundColor: LARANJA }]} onPress={() => salvar({ destaque: String(v.numero) })}><Text style={[s.btn2Tx, on && { color: '#0c1014' }]}>#{v.numero} {((nomes[String(v.numero)] || {}).piloto || v.nome || '').split(' ')[0]}</Text></TouchableOpacity>;
        })}
      </View>
      <Text style={[s.tip, { marginTop: 12 }]}>Endereço do overlay para o OBS</Text>
      <Text style={s.k}>Atraso do vídeo (s)</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
        {['0', '10', '15', '20', '30'].map((d) => <TouchableOpacity key={d} style={[s.chip, { paddingHorizontal: 12, paddingVertical: 6 }, delay === d && { backgroundColor: LARANJA }]} onPress={() => setDelay(d)}><Text style={[s.btn2Tx, delay === d && { color: '#0c1014' }]}>{d}s</Text></TouchableOpacity>)}
      </View>
      <Text selectable style={{ color: '#4fc3f7', fontSize: 13 }}>{url}</Text>
      <Text style={s.tipTx}>No OBS: Fontes → + → Navegador → cole o endereço, largura 1920, altura 1080. O fundo é transparente. Para mudar o carro em destaque, toque num número acima.</Text>
    </View>
  );
}
