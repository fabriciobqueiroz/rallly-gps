// Gera o roadbook em PDF para imprimir (tabela com parcial, total, tulipa e tipo de trecho).
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { desenhoSvgStr } from './Desenho';
import { comContinuacao, rotNeutro } from './rally';

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

const dot = (m, d) => (m / 1000).toFixed(d);
const hmsc = (sec) => { const x = Math.max(0, sec); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), r = x - h * 3600 - m * 60; return `${h}:${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`; };
const BORD = '2px solid #000';

// Uma tabela no padrão da planilha: DISTÂNCIA | TULIPA | MÉDIA | TEMPO | OBSERVAÇÕES (uma por categoria).
function tabelaHtml(tul, gi, org) {
  const rows = tul.map((e) => {
    const neutro = e.t === 'P' && e.nt > 0 && !e.cont;
    const grande = !!e.nx || neutro || e.zero || e.t !== 'T';
    const km = `<td style="border:${BORD};width:17%;vertical-align:top;padding:4px 6px"><div style="font-size:14px;font-weight:bold">${dot(e.p || 0, 2)}</div><div style="font-size:24px;font-weight:bold;text-align:center;margin-top:4px">${dot(e.dz ?? e.d, grande ? 3 : 2)}</div>${e.zero ? '<div style="background:#000;color:#fff;font-weight:bold;text-align:center;font-size:18px;margin:6px -6px -4px">0.000</div>' : ''}</td>`;
    let tulC;
    if (e.t === 'T' || neutro) {
      tulC = `<div style="position:relative;text-align:center">${tulSvg(e, 92)}<span style="position:absolute;right:2px;bottom:0;font-size:11px">${e.rn ?? ''}</span></div>`;
    } else {
      const nome = e.t === 'L' ? 'LARGADA' : e.t === 'C' ? 'CHEGADA' : `PC ${e.pn ?? e.n}`;
      tulC = `<div style="font-weight:bold;font-size:18px;text-align:center">${nome}</div>`;
    }
    const tulTd = `<td style="border:${BORD};width:22%;padding:2px">${tulC}</td>`;
    let media = '';
    if (neutro) {
      media = `<div style="border:3px solid #000;text-align:center;font-weight:bold;line-height:1.15;padding:3px 0"><div style="font-size:22px">N</div><div style="font-size:24px">${rotNeutro(e.nt)}</div><div style="font-size:16px">${e.nt < 60 ? 'Seg' : 'min'}</div></div>`;
    } else if (e.nx) {
      if (e.nx.t === 'D') media = `<div style="border:3px solid #000;background:#ffe600;text-align:center;font-weight:bold;line-height:1.15;padding:3px 0"><div style="font-size:22px">D</div><div style="font-size:24px">${e.nx.min}</div><div style="font-size:16px">min</div></div>`;
      else {
        const v = Array.isArray(e.nx.v) ? (e.nx.v[gi] ?? e.nx.v[0]) : e.nx.kg;
        media = `<div style="border:3px solid #000;text-align:center;font-weight:bold;line-height:1.15;padding:3px 0"><div style="font-size:22px">V</div><div style="font-size:24px">${v}</div><div style="font-size:16px">Km/h</div></div>`;
      }
    }
    const mediaTd = `<td style="border:${BORD};width:14%;padding:3px">${media}</td>`;
    const tm = e.tm ? (e.tm[gi] ?? e.tm[0]) : null;
    const tempoTd = `<td style="border:${BORD};width:20%;padding:0;text-align:center"><div style="font-size:15px;font-weight:bold;border-bottom:1px solid #999;padding:3px 0">${e.tl || ''}</div><div style="font-size:20px;font-weight:bold;padding:14px 2px">${tm != null ? hmsc(tm) : ''}</div></td>`;
    const obs = [e.nm ? `<div style="font-size:17px;font-weight:bold">${String(e.nm).toUpperCase()}</div>` : '', neutro ? '<div style="font-size:17px;font-weight:bold">NEUTRO</div>' : '', e.zero ? '<div style="background:#000;color:#fff;font-weight:bold;font-size:16px;padding:3px 0;margin-top:6px">ZERE SEU ODÔMETRO</div>' : ''].join('');
    const obsTd = `<td style="border:${BORD};padding:4px 6px;text-align:center;vertical-align:middle">${obs}</td>`;
    return `<tr style="height:112px;page-break-inside:avoid">${km}${tulTd}${mediaTd}${tempoTd}${obsTd}</tr>`;
  }).join('');
  const th = (t, w) => `<th style="border:${BORD};padding:5px;font-size:16px;width:${w}">${t}</th>`;
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr>${th('DISTÂNCIA', '17%')}${th('TULIPA', '22%')}${th('MÉDIA', '14%')}${th('TEMPO', '20%')}${th('OBSERVAÇÕES', '27%')}</tr></thead><tbody>${rows}</tbody></table>`;
}

export function roadbookHtml(prova, tul0, org, grupos, classe, nome) {
  const tul = comContinuacao(org ? tul0 : tul0.filter((e) => e.t !== 'P' || e.nt > 0));
  const nomes = grupos && grupos.length ? grupos : [''];
  const gis = classe ? [Math.max(0, nomes.findIndex((n) => String(n).toUpperCase() === String(classe).toUpperCase()))] : nomes.map((_, i) => i);
  const titulo = nome || `Prova ${prova}`;
  const paginas = gis.map((gi, k) => `<div style="${k ? 'page-break-before:always;' : ''}"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><h2 style="margin:0;font-size:24px">${titulo}</h2><div style="font-size:18px;font-weight:bold">${nomes[gi] || ''}</div></div>${tabelaHtml(tul, gi, org)}</div>`).join('');
  return `<html><body style="font-family:Arial,Helvetica,sans-serif;margin:14px">${paginas}</body></html>`;
}

export async function compartilharPdf(prova, tul, org, grupos, classe, nome) {
  const html = roadbookHtml(prova, tul, org, grupos, classe, nome);
  if (Platform.OS === 'web') return Print.printAsync({ html });
  const { uri } = await Print.printToFileAsync({ html });
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
