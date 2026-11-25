import * as TaskManager from 'expo-task-manager';
import { addLocations } from './store';

export const TASK = 'rally-gps-task';

// Intervalo mínimo entre pontos gravados (ms). 1000 = 1 ponto por segundo.
// No iPhone o sistema ignora o intervalo de tempo, então filtramos aqui.
let minMs = 1000, lastT = 0;
export const setGpsMin = (ms) => { minMs = Math.max(0, Number(ms) || 0); lastT = 0; };

// Precisa ser definida no escopo global (importada em index.js).
TaskManager.defineTask(TASK, ({ data, error }) => {
  if (error) return;
  if (!(data && data.locations)) return;
  const ok = [];
  for (const l of data.locations) {
    const t = l.timestamp || Date.now();
    if (minMs <= 1000 || !lastT || t - lastT >= minMs - 150) { ok.push(l); lastT = t; }
  }
  if (ok.length) addLocations(ok);
});
