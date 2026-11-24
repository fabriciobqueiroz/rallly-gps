// Gera o roadbook em PDF para imprimir (tabela com parcial, total, tulipa e tipo de trecho).
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { desenhoSvgStr } from './Desenho';
import { comContinuacao } from './rally';

const km2 = (m) => (m / 1000).toFixed(3).replace('.', ',');
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function tulSvg(e, size) {
  if (e.dw && e.dw.length) return desenhoSvgStr(e.dw, size);
  const c = 50, R = 40, b = e.b || [];
  const base = e.i >= 0 && b[e.i] != null ? b[e.i] : 180;
  const rot = (x) => x - base + 180;
  const pt = (ang, r) => { const a = (ang * Math.PI) / 180; return [c + r * Math.sin(a), c - r * Math.cos(a)]; };
  let s = `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff" stroke="#999"/>`;
  b.forEach((ang, j) => {
    const [x, y] = pt(rot(ang), R);
    const on = j === e.i || j === e.o;
    s += `<line x1="50" y1="50" x2="${x}" y2="${y}" stroke="${on ? '#000' : '#999'}" stroke-width="${on ? 7 : 3}" stroke-linecap="round"/>`;
  });
  if (e.ty === 'roundabout' || e.ty === 'rotary' || e.ty === 'roundabout turn') {
    s += `<circle cx="50" cy="50" r="13" fill="#fff" stroke="#000" stroke-width="3"/>${e.ex ? `<text x="50" y="55" font-size="15" font-weight="bold" text-anchor="middle">${e.ex}</text>` : ''}`;
  }
  if (e.o >= 0 && b[e.o] != null) {
    const o = rot(b[e.o]), t = pt(o, R + 4), bs = pt(o, R - 12);
    const nx = -(t[1] - bs[1]) / 16, ny = (t[0] - bs[0]) / 16;
    s += `<polygon points="${t[0]},${t[1]} ${bs[0] + nx * 7},${bs[1] + ny * 7} ${bs[0] - nx * 7},${bs[1] - ny * 7}" fill="#000"/>`;
  }
  return s + '<circle cx="50" cy="88" r="4" fill="#d32f2f"/></svg>';
}

function tipo(nx) {
  if (!nx) return '';
  if (nx.t === 'D') return `<div style="background:#ffe600;padding:3px 6px;font-weight:bold">D ${nx.min}'</div>`;
  const txt = Array.isArray(nx.v) ? nx.v.map((x, i) => `${String.fromCharCode(65 + i)} ${x}`).join(' · ') : `${nx.kg} (G/M) · ${nx.ka} (A)`;
  return `<div style="background:#2e7d32;color:#fff;padding:3px 6px;font-weight:bold">V ${txt}</div>`;
}

const hms = (sec) => { const t = Math.max(0, Math.round(sec)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const velHtml = (nx) => {
  if (!nx) return '';
  if (nx.t === 'D') return `<div style="border:2px solid #000;padding:2px 6px;text-align:center;font-weight:bold">D<br>${nx.min}'</div>`;
  const vs = Array.isArray(nx.v) ? nx.v : [nx.kg, nx.ka];
  return vs.map((v, i) => `<div style="border:2px solid #000;padding:2px 6px;text-align:center;font-weight:bold;margin-bottom:2px">${vs.length > 1 ? String.fromCharCode(65 + i) + ' ' : ''}V<br><span style="font-size:18px">${v}</span><br><span style="font-size:10px">Km/h</span></div>`).join('');
};

export function roadbookHtml(prova, tul0, org) {
  const tul = comContinuacao(org ? tul0 : tul0.filter((e) => e.t !== 'P' || e.nt > 0));
  const rows = tul.map((e) => {
    const km = `<td style="width:70px;text-align:right"><div style="font-size:11px">${km2(e.p)}</div><div style="font-size:18px;font-weight:bold">${km2(e.dz ?? e.d)}</div>${e.zero ? '<div style="background:#000;color:#fff;font-weight:bold;text-align:center;margin-top:2px">0.000</div>' : ''}</td>`;
    if (e.t === 'T') {
      const tempo = e.tm ? e.tm.map((t, i) => `<div style="font-weight:bold">${e.tm.length > 1 ? String.fromCharCode(65 + i) + ' ' : ''}${hms(t)}</div>`).join('') + `<div style="font-size:11px">T${e.tn}</div>` : '';
      return `<tr>${km}<td style="text-align:center">${tulSvg(e, 90)}<div style="font-size:11px">${e.rn ?? ''}</div></td><td style="width:70px">${velHtml(e.nx)}</td><td style="width:80px;text-align:center">${tempo}</td><td>${e.nm || ''}</td></tr>`;
    }
    const mid = `<div style="font-weight:bold;font-size:16px">${e.t === 'L' ? 'LARGADA' : e.t === 'C' ? 'CHEGADA' : (org ? (e.nt > 0 && e.pn == null ? 'NEUTRO' : 'PC ' + (e.pn ?? e.n)) : 'NEUTRO')}</div>` +
      (e.nt > 0 ? `<div style="background:#c0392b;color:#fff;padding:3px 6px;font-weight:bold">N · PARE ${mmss(e.nt)}</div>` : '');
    return `<tr>${km}<td>${mid}</td><td style="width:70px">${velHtml(e.nx)}</td><td></td><td></td></tr>`;
  }).join('');
  return `<html><body style="font-family:sans-serif;margin:16px"><h2 style="margin:0 0 8px">Roadbook · prova ${prova}</h2>
  <div style="font-size:11px;margin-bottom:8px">Colunas: parcial e total (km) · tulipa e nº da referência · velocidade do trecho (só no início dele) · tempo de prova e nº do trecho · observação. Chegue pela rua de baixo e siga a seta. Letras = grupos de média (ver categorias).</div>
  <table style="width:100%;border-collapse:collapse" border="1" cellpadding="5">${rows}</table></body></html>`;
}

export async function compartilharPdf(prova, tul, org) {
  if (Platform.OS === 'web') return Print.printAsync({ html: roadbookHtml(prova, tul, org) });
  const { uri } = await Print.printToFileAsync({ html: roadbookHtml(prova, tul, org) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Roadbook ${prova}` });
}

export async function compartilharResultadosPdf(prova, linhas) {
  const por = {};
  linhas.forEach((r) => { (por[r.classe] = por[r.classe] || []).push(r); });
  const html = `<html><body style="font-family:sans-serif;margin:16px"><h2>Resultado oficial · ${prova}</h2>` + Object.keys(por).map((c) =>
    `<h3 style="background:#1b6b85;color:#fff;padding:4px 8px">${c}</h3><table style="width:100%;border-collapse:collapse" border="1" cellpadding="5">` +
    por[c].map((r, i) => `<tr><td style="width:40px">${r.nc ? 'NC' : i + 1 + 'º'}</td><td>#${r.numero} ${r.nome}</td><td style="width:60px">${r.nc ? '' : r.npcs + ' PC'}</td><td style="width:90px;text-align:right">${r.nc ? 'N/A' : Number(r.pontos).toFixed(1) + ' pts'}</td></tr>`).join('') + '</table>').join('') + '</body></html>';
  if (Platform.OS === 'web') return Print.printAsync({ html });
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Resultado ${prova}` });
}
