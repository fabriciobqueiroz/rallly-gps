// Gera o roadbook em PDF para imprimir (tabela com parcial, total, tulipa e tipo de trecho).
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { desenhoSvgStr } from './Desenho';

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

export function roadbookHtml(prova, tul0, org) {
  const tul = org ? tul0 : tul0.filter((e) => e.t !== 'P' || e.nt > 0);
  const rows = tul.map((e) => {
    const mid = e.t === 'T'
      ? `<div style="display:flex;align-items:center;gap:10px">${tulSvg(e, 90)}<span>${e.nm || ''}</span></div>`
      : `<div style="font-weight:bold;font-size:16px">${e.t === 'L' ? 'LARGADA' : e.t === 'C' ? 'CHEGADA' : (org ? 'PC ' + e.n : 'NEUTRO')}</div>` +
        (e.nt > 0 ? `<div style="background:#c0392b;color:#fff;padding:3px 6px;font-weight:bold">N · PARE ${mmss(e.nt)}</div>` : '') + tipo(e.nx);
    return `<tr><td style="width:70px"><div style="font-size:12px">${km2(e.p)}</div><div style="font-size:18px;font-weight:bold">${km2(e.d)}</div></td><td>${mid}</td></tr>`;
  }).join('');
  return `<html><body style="font-family:sans-serif;margin:16px"><h2 style="margin:0 0 8px">Roadbook · prova ${prova}</h2>
  <div style="font-size:11px;margin-bottom:8px">Esquerda: parcial e total (km). Chegue pela rua de baixo e siga a seta. Letras = grupos de média (ver categorias).</div>
  <table style="width:100%;border-collapse:collapse" border="1" cellpadding="5">${rows}</table></body></html>`;
}

export async function compartilharPdf(prova, tul, org) {
  const { uri } = await Print.printToFileAsync({ html: roadbookHtml(prova, tul, org) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Roadbook ${prova}` });
}

export async function compartilharResultadosPdf(prova, linhas) {
  const por = {};
  linhas.forEach((r) => { (por[r.classe] = por[r.classe] || []).push(r); });
  const html = `<html><body style="font-family:sans-serif;margin:16px"><h2>Resultado oficial · ${prova}</h2>` + Object.keys(por).map((c) =>
    `<h3 style="background:#1b6b85;color:#fff;padding:4px 8px">${c}</h3><table style="width:100%;border-collapse:collapse" border="1" cellpadding="5">` +
    por[c].map((r, i) => `<tr><td style="width:40px">${r.nc ? 'NC' : i + 1 + 'º'}</td><td>#${r.numero} ${r.nome}</td><td style="width:60px">${r.nc ? '' : r.npcs + ' PC'}</td><td style="width:90px;text-align:right">${r.nc ? 'N/A' : Number(r.pontos).toFixed(1) + ' pts'}</td></tr>`).join('') + '</table>').join('') + '</body></html>';
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Resultado ${prova}` });
}
