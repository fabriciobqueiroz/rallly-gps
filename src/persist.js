// Salva a gravação em arquivo no celular, para não perder dados se o app fechar.
import { File, Paths } from 'expo-file-system';
import { CSV_HEAD, csvRow, setPersistence } from './store';

export const recFile = () => new File(Paths.document, 'gravacao.csv');
const rotFile = () => new File(Paths.document, 'roteiro.txt');

function writeNew(file, text) {
  try { if (!file.exists) file.create(); } catch {}
  file.write(text); // sem append = substitui o conteúdo
}

export function loadText(file) {
  try { return file.exists ? file.textSync() : ''; } catch { return ''; }
}

export const loadRoteiro = () => loadText(rotFile());
export const saveRoteiro = (txt) => { try { writeNew(rotFile(), txt); } catch {} };

setPersistence({
  // Lê a gravação anterior (se houver) quando o app abre.
  load() {
    const f = recFile();
    const txt = loadText(f);
    if (!txt) { writeNew(f, CSV_HEAD + '\n'); return []; }
    const out = [];
    for (const line of txt.split('\n').slice(1)) {
      const [iso, lat, lon, acc, spd, mock] = line.split(',');
      const t = Date.parse(iso);
      if (isNaN(t) || lat === undefined) continue;
      out.push({ t, lat: +lat, lon: +lon, acc: acc === '' ? null : +acc, spd: spd === '' ? null : +spd, mocked: mock === 'true' });
    }
    return out;
  },
  append(points) {
    const f = recFile();
    if (!f.exists) writeNew(f, CSV_HEAD + '\n');
    f.write(points.map(csvRow).join('\n') + '\n', { append: true });
  },
  reset() { writeNew(recFile(), CSV_HEAD + '\n'); },
});
