// Sons e voz da prova: bipes (arquivos curtos gerados no app) e fala (voz do sistema, funciona sem internet).
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

const ARQ = {
  ref: require('../assets/sons/ref.wav'),
  trc: require('../assets/sons/trc.wav'),
  adi: require('../assets/sons/adi.wav'),
  atr: require('../assets/sons/atr.wav'),
  dist: require('../assets/sons/dist.wav'),
};
const players = {};
let pronto = false;
export function iniciarSom() {
  if (pronto) return;
  pronto = true;
  try { setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers', interruptionModeAndroid: 'duckOthers' }).catch(() => {}); } catch {}
}
export function bipe(nome, vol = 1) {
  try {
    iniciarSom();
    if (!players[nome]) players[nome] = createAudioPlayer(ARQ[nome]);
    const p = players[nome];
    p.volume = Math.max(0, Math.min(1, vol));
    try { p.seekTo(0); } catch {}
    p.play();
  } catch {}
}
export function falar(txt, { vel = 1, vol = 1, voz } = {}) {
  try {
    iniciarSom();
    Speech.stop();
    Speech.speak(txt, { language: 'pt-BR', rate: vel, volume: Math.max(0, Math.min(1, vol)), ...(voz ? { voice: voz } : {}) });
  } catch {}
}
export async function vozesPt() {
  try { const l = await Speech.getAvailableVoicesAsync(); return l.filter((v) => /^pt/i.test(v.language || '')); } catch { return []; }
}
