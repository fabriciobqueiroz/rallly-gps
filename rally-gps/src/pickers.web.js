// Navegador: abre o seletor nativo de data/hora do próprio navegador.
const p2 = (x) => String(x).padStart(2, '0');
export const DateTimePickerAndroid = {
  open({ value, mode, onChange }) {
    const d = value instanceof Date ? value : new Date();
    const inp = document.createElement('input');
    inp.type = mode === 'time' ? 'time' : 'date';
    inp.value = mode === 'time' ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    inp.style.cssText = 'position:fixed;left:50%;top:40%;z-index:99999;font-size:20px;padding:8px';
    document.body.appendChild(inp);
    const fim = (ok) => { const v = inp.value; if (inp.parentNode) inp.parentNode.removeChild(inp); if (!ok || !v) return onChange({ type: 'dismissed' }, undefined); const r = new Date(d); if (mode === 'time') { const [h, m] = v.split(':'); r.setHours(+h, +m, 0, 0); } else { const [y, mo, da] = v.split('-'); r.setFullYear(+y, +mo - 1, +da); } onChange({ type: 'set' }, r); };
    inp.addEventListener('change', () => fim(true));
    inp.addEventListener('blur', () => setTimeout(() => { if (inp.parentNode) fim(false); }, 150));
    inp.focus();
    try { inp.showPicker(); } catch {}
  },
};
