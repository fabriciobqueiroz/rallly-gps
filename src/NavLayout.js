// Layouts da tela de prova: cada layout é uma lista de blocos livres (posição e tamanho em fração da tela).
import { loadJson, saveJson } from './persist';

export const BLOCOS = {
  tnav: { nome: 'T.NAV', w: 0.45, h: 0.12 },
  regref: { nome: 'REG REF', w: 0.34, h: 0.11 },
  regref2: { nome: 'REG REF da próxima', w: 0.34, h: 0.11 },
  vel: { nome: 'Velocidade', w: 0.33, h: 0.11 },
  odo: { nome: 'Odômetro GPS', w: 0.55, h: 0.12 },
  atual: { nome: 'Média atual', w: 0.33, h: 0.12 },
  prox: { nome: 'Média próxima', w: 0.38, h: 0.12 },
  regtrc: { nome: 'PRÓX. TRECHO', w: 0.38, h: 0.1 },
  relogio: { nome: 'Relógio GPS', w: 0.38, h: 0.08 },
  p10: { nome: 'Botão +10', w: 0.19, h: 0.1, btn: true },
  m10: { nome: 'Botão −10', w: 0.19, h: 0.1, btn: true },
  p1: { nome: 'Botão +1', w: 0.19, h: 0.1, btn: true },
  m1: { nome: 'Botão −1', w: 0.19, h: 0.1, btn: true },
  prec: { nome: 'Precisão GPS', w: 0.3, h: 0.07 },
  bat: { nome: 'Nível de bateria', w: 0.38, h: 0.06 },
  trcn: { nome: 'Número do trecho', w: 0.3, h: 0.08 },
  refn: { nome: 'Número da referência', w: 0.3, h: 0.08 },
  kmac: { nome: 'KM acumulado', w: 0.4, h: 0.1 },
  cron: { nome: 'Cronômetro do trecho', w: 0.4, h: 0.1 },
  rb: { nome: 'Roadbook (tulipas)', w: 0.62, h: 0.7 },
  wpct: { nome: 'W% (calibração)', w: 0.25, h: 0.08 },
  afer: { nome: 'AFER (aferir)', w: 0.25, h: 0.08 },
  odosel: { nome: 'Seleção de odômetro GPS/Box', w: 0.3, h: 0.08 },
  odoaj: { nome: 'Indicador de ajuste do odômetro', w: 0.34, h: 0.08 },
  aferv: { nome: 'Botão AFER visual', w: 0.25, h: 0.1 },
  derrap: { nome: 'Detector de derrapagem (em breve)', w: 0.4, h: 0.1, breve: true },
  regtb: { nome: 'Regressivo do trecho (em breve)', w: 0.4, h: 0.08, breve: true },
};

const it = (tipo, x, y, w, h) => ({ id: 'p_' + tipo, tipo, x, y, w, h });
const V = [
  it('odo', 0, 0, 0.55, 0.13), it('tnav', 0.55, 0, 0.45, 0.13),
  it('vel', 0, 0.13, 0.33, 0.11), it('regref', 0.33, 0.13, 0.34, 0.11), it('atual', 0.67, 0.13, 0.33, 0.11),
  it('prox', 0, 0.24, 0.38, 0.12), it('regtrc', 0, 0.36, 0.38, 0.1),
  it('p10', 0, 0.46, 0.19, 0.1), it('m10', 0.19, 0.46, 0.19, 0.1), it('bat', 0, 0.66, 0.38, 0.06),
  it('rb', 0.38, 0.24, 0.62, 0.76),
];
const H = [
  it('odo', 0, 0, 0.2, 0.2), it('tnav', 0.2, 0, 0.2, 0.2),
  it('vel', 0, 0.2, 0.2, 0.2), it('regref', 0.2, 0.2, 0.2, 0.2),
  it('atual', 0, 0.4, 0.2, 0.2), it('prox', 0.2, 0.4, 0.2, 0.2), it('regtrc', 0, 0.6, 0.4, 0.2),
  it('p10', 0, 0.8, 0.1, 0.2), it('m10', 0.1, 0.8, 0.1, 0.2),
  it('rb', 0.4, 0, 0.6, 1),
];
// Piloto: sem botões de incremento; o roadbook ocupa mais espaço.
const PV = [it('tnav', 0, 0, 1, 0.11), it('vel', 0, 0.11, 0.33, 0.11), it('regref', 0.33, 0.11, 0.34, 0.11), it('regtrc', 0.67, 0.11, 0.33, 0.11), it('rb', 0, 0.22, 1, 0.78)];
const PH = [it('tnav', 0, 0, 0.4, 0.25), it('vel', 0, 0.25, 0.2, 0.25), it('regref', 0.2, 0.25, 0.2, 0.25), it('regtrc', 0, 0.5, 0.4, 0.25), it('rb', 0.4, 0, 0.6, 1)];

export const padraoDe = (orient, piloto) => ({ id: orient === 'h' ? 'padraoh' : 'padrao', nome: orient === 'h' ? 'Padrão horizontal' : 'Padrão vertical', orient: orient === 'h' ? 'h' : 'v', items: piloto ? (orient === 'h' ? PH : PV) : (orient === 'h' ? H : V) });
export const PADRAO = padraoDe('v', false);
export const PADRAO_ITEMS = PADRAO.items;

export const loadLayouts = () => { const l = loadJson('navlay', null); return l && Array.isArray(l.list) ? { selP: 'padrao', ...l } : { sel: 'padrao', selP: 'padrao', list: [] }; };
export const saveLayouts = (l) => saveJson('navlay', l);
export const getLayout = (piloto) => {
  const L = loadLayouts(); const id = piloto ? L.selP : L.sel;
  if (id === 'padrao' || id === 'padraoh') return padraoDe(id === 'padraoh' ? 'h' : 'v', piloto);
  return L.list.find((x) => x.id === id) || padraoDe('v', piloto);
};
export const novoId = () => 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
