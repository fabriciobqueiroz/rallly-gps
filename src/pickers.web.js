// Navegador: seletor próprio de data e hora (calendário desenhado na página, sem depender do balão do navegador).
const p2 = (x) => String(x).padStart(2, '0');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEM = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const AZ = '#2a8fd6';

function el(tag, css, txt) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }

export const DateTimePickerAndroid = {
  open({ value, mode, onChange }) {
    const d0 = value instanceof Date ? value : new Date();
    let fechado = false;
    const fundo = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Montserrat,Arial,sans-serif');
    const cx = el('div', 'background:#fff;color:#222;border-radius:10px;width:320px;max-width:94vw;box-shadow:0 8px 32px rgba(0,0,0,.4);overflow:hidden');
    fundo.appendChild(cx);
    const fim = (ok, r) => {
      if (fechado) return; fechado = true;
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
      if (!ok) return onChange({ type: 'dismissed' }, undefined);
      onChange({ type: 'set' }, r);
    };
    fundo.addEventListener('mousedown', (ev) => { if (ev.target === fundo) fim(false); });
    const botoes = (aoOk) => {
      const b = el('div', 'display:flex;justify-content:flex-end;gap:8px;padding:10px 14px');
      const c = el('button', `border:0;background:none;color:${AZ};font-weight:700;font-size:14px;padding:8px 12px;cursor:pointer`, 'CANCELAR');
      const o = el('button', `border:0;background:${AZ};color:#fff;font-weight:700;font-size:14px;padding:8px 18px;border-radius:4px;cursor:pointer`, 'OK');
      c.onclick = () => fim(false); o.onclick = aoOk; b.appendChild(c); b.appendChild(o); return b;
    };
    if (mode === 'time') {
      let h = d0.getHours(), m = d0.getMinutes();
      const topo = el('div', `background:${AZ};color:#fff;padding:14px 18px;font-size:13px`, 'Hora');
      const vis = el('div', 'font-size:44px;font-weight:700;text-align:center;padding:12px 0 4px');
      const hh = el('div', 'display:flex;flex-wrap:wrap;gap:4px;padding:6px 14px;justify-content:center');
      const mm = el('div', 'display:flex;flex-wrap:wrap;gap:4px;padding:6px 14px;justify-content:center');
      const pinta = () => {
        vis.textContent = `${p2(h)}:${p2(m)}`;
        [...hh.children].forEach((x, i) => { x.style.background = i === h ? AZ : '#eef1f5'; x.style.color = i === h ? '#fff' : '#333'; });
        [...mm.children].forEach((x, i) => { x.style.background = i * 5 === m ? AZ : '#eef1f5'; x.style.color = i * 5 === m ? '#fff' : '#333'; });
      };
      const bt = (t, on) => { const b = el('button', 'border:0;border-radius:4px;width:42px;height:32px;font-size:14px;cursor:pointer', t); b.onclick = on; return b; };
      for (let i = 0; i < 24; i++) hh.appendChild(bt(p2(i), () => { h = i; pinta(); }));
      for (let i = 0; i < 12; i++) mm.appendChild(bt(p2(i * 5), () => { m = i * 5; pinta(); }));
      const l1 = el('div', 'text-align:center;font-size:12px;color:#888', 'Hora'), l2 = el('div', 'text-align:center;font-size:12px;color:#888;margin-top:6px', 'Minuto');
      cx.append(topo, vis, l1, hh, l2, mm, botoes(() => { const r = new Date(d0); r.setHours(h, m, 0, 0); fim(true, r); }));
      pinta();
    } else {
      let sel = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
      let ver = new Date(sel.getFullYear(), sel.getMonth(), 1);
      const topo = el('div', `background:${AZ};color:#fff;padding:14px 18px`);
      const nav = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px');
      const grade = el('div', 'display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:4px 10px 6px');
      const tit = el('div', 'font-weight:700;font-size:15px');
      const seta = (t, dm) => { const b = el('button', 'border:0;background:none;font-size:22px;cursor:pointer;color:#555;padding:2px 12px', t); b.onclick = () => { ver = new Date(ver.getFullYear(), ver.getMonth() + dm, 1); pinta(); }; return b; };
      nav.append(seta('‹', -1), tit, seta('›', 1));
      const pinta = () => {
        topo.innerHTML = ''; topo.append(el('div', 'font-size:12px;opacity:.85', String(sel.getFullYear())), el('div', 'font-size:24px;font-weight:700', `${p2(sel.getDate())}/${p2(sel.getMonth() + 1)}`));
        tit.textContent = `${MESES[ver.getMonth()]} ${ver.getFullYear()}`;
        grade.innerHTML = '';
        SEM.forEach((s) => grade.appendChild(el('div', 'text-align:center;font-size:12px;color:#999;padding:4px 0', s)));
        const ini = ver.getDay(), n = new Date(ver.getFullYear(), ver.getMonth() + 1, 0).getDate();
        for (let i = 0; i < ini; i++) grade.appendChild(el('div'));
        for (let dia = 1; dia <= n; dia++) {
          const ehSel = sel.getFullYear() === ver.getFullYear() && sel.getMonth() === ver.getMonth() && sel.getDate() === dia;
          const hoje = new Date(); const ehHoje = hoje.getFullYear() === ver.getFullYear() && hoje.getMonth() === ver.getMonth() && hoje.getDate() === dia;
          const b = el('button', `border:${ehHoje && !ehSel ? '1px solid ' + AZ : '0'};border-radius:50%;height:36px;font-size:14px;cursor:pointer;background:${ehSel ? AZ : 'transparent'};color:${ehSel ? '#fff' : '#222'}`, String(dia));
          b.onclick = () => { sel = new Date(ver.getFullYear(), ver.getMonth(), dia); pinta(); };
          b.ondblclick = () => { const r = new Date(d0); r.setFullYear(sel.getFullYear(), sel.getMonth(), sel.getDate()); fim(true, r); };
          grade.appendChild(b);
        }
      };
      cx.append(topo, nav, grade, botoes(() => { const r = new Date(d0); r.setFullYear(sel.getFullYear(), sel.getMonth(), sel.getDate()); fim(true, r); }));
      pinta();
    }
    document.body.appendChild(fundo);
  },
};
