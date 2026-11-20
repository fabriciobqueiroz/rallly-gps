// Versão do navegador: guarda no localStorage em vez de arquivo.
const ls = () => { try { return window.localStorage; } catch { return null; } };
export const recFile = () => null;
export const loadRoteiro = () => { try { return ls().getItem('rally_roteiro') || ''; } catch { return ''; } };
export const saveRoteiro = (txt) => { try { ls().setItem('rally_roteiro', txt); } catch {} };
export const loadJson = (name, fallback) => { try { const v = JSON.parse(ls().getItem('rally_' + name)); return v == null ? fallback : v; } catch { return fallback; } };
export const saveJson = (name, obj) => { try { ls().setItem('rally_' + name, JSON.stringify(obj)); } catch {} };
export const apagarJson = (name) => { try { ls().removeItem('rally_' + name); } catch {} };
