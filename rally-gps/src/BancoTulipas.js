// Banco de desenhos de tulipa (gerado por nós): cada entrada = direção de saída, tipo de cruzamento e imagem de apoio.
import { SIMBOLOS } from './Desenho';

export const DIRECOES = [['todas', '∞', 'Todas'], ['frente', '↑', 'Em frente'], ['esq', '←', 'Esquerda'], ['dir', '→', 'Direita']];
export const TIPOS = [
  ['todos', '∞', 'Todos'], ['reta', '|', 'Reta'], ['curva', '⌒', 'Curva'], ['lat-d', '⊢', 'Rua à direita'], ['lat-e', '⊣', 'Rua à esquerda'],
  ['t', '⊥', 'Em T'], ['mais', '+', 'Cruz'], ['y', 'Y', 'Em Y'], ['outro', '?', 'Outros'],
];

// [tipo, braços, saída]
const BASES = [
  ['reta', [0], 0],
  ['curva', [45], 45], ['curva', [315], 315], ['curva', [90], 90], ['curva', [270], 270],
  ['lat-d', [0, 90], 0], ['lat-d', [0, 90], 90], ['lat-d', [0, 45], 0], ['lat-d', [0, 45], 45],
  ['lat-e', [0, 270], 0], ['lat-e', [0, 270], 270], ['lat-e', [0, 315], 0], ['lat-e', [0, 315], 315],
  ['t', [90, 270], 90], ['t', [90, 270], 270],
  ['mais', [0, 90, 270], 0], ['mais', [0, 90, 270], 90], ['mais', [0, 90, 270], 270],
  ['y', [45, 315], 45], ['y', [45, 315], 315], ['y', [0, 45, 315], 0],
  ['outro', [0, 45, 90], 45], ['outro', [0, 315, 270], 315], ['outro', [45, 90], 90], ['outro', [315, 270], 270],
];
const dirDe = (o) => (o === 0 ? 'frente' : o < 180 ? 'dir' : 'esq');

// Posições dos marcos ao redor do cruzamento (quadro 100 x 100).
const POS = [[80, 26], [20, 26], [80, 74], [20, 74], [50, 16]];
const IMAGENS = ['vel40', 'vel60', 'vel80', 'estac', 'radar', 'ceda', 'setaplaca', 'norte', 'casa', 'escola', 'galpao', 'hospital', 'estadio', 'posto', 'capela',
  'arvore', 'palmeira', 'cacto', 'arbusto', 'mata', 'torre', 'poste', 'poste2', 'antena', 'eolica', 'cerca', 'arame', 'mataburro', 'trilho', 'rio', 'lago', 'ponte',
  'lombada', 'rotatoria', 'semaforo', 'pare'];

let cache = null;
// Lista completa: sem imagem + cada base com cada marco (varia o lado).
export function banco() {
  if (cache) return cache;
  const L = [];
  let n = 0;
  BASES.forEach(([tipo, arms, out]) => {
    const base = { k: 'tpl', arms, out, x: 50, y: 55, s: 0.85, r: 0, b: 1 };
    L.push({ id: ++n, tipo, dir: dirDe(out), img: 'nenhuma', it: [base] });
    IMAGENS.forEach((nome, i) => {
      if (!SIMBOLOS[nome]) return;
      const [x, y] = POS[(i + n) % POS.length];
      L.push({ id: ++n, tipo, dir: dirDe(out), img: SIMBOLOS[nome].cat || 'via', it: [base, { k: 'sym', n: nome, x, y, s: 0.9 }] });
    });
  });
  cache = L;
  return L;
}
export const filtrar = (dir, tipo, img) => banco().filter((b) => (dir === 'todas' || b.dir === dir) && (tipo === 'todos' || b.tipo === tipo) && (img === 'todas' || b.img === img));
