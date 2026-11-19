// Ligação com o Firestore (banco na nuvem) para o ranking.
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCc2AWTswMQzYIhWPowuuXqoiDV7B00yyU',
  authDomain: 'rally-sjrp.firebaseapp.com',
  projectId: 'rally-sjrp',
  storageBucket: 'rally-sjrp.firebasestorage.app',
  messagingSenderId: '1097792134353',
  appId: '1:1097792134353:web:e7a094240f303b355239f0',
};

const app = initializeApp(firebaseConfig);
// Long polling é mais estável em redes móveis dentro do React Native.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

const slug = (s) => String(s).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');

export async function enviarResultado({ prova, numero, nome, classe, pcs, pontos, oficial }) {
  const id = `${slug(prova)}_${slug(numero)}`;
  await setDoc(doc(db, 'resultados', id), {
    prova: slug(prova),
    numero: String(numero),
    nome: String(nome),
    classe: classe || 'GRADUADO',
    npcs: pcs.length,
    pontos: Math.round(pontos * 10) / 10,
    pcs: pcs.map((p) => ({
      n: p.n,
      trecho: p.trecho ?? null,
      tipo: p.tipo || 'V',
      dist: Math.round(p.dist),
      elapsed: Math.round(p.elapsed * 10) / 10,
      ideal: p.idealTime != null ? Math.round(p.idealTime * 10) / 10 : null,
      diff: p.diff != null ? Math.round(p.diff * 10) / 10 : null,
      t0: p.t0 ?? null,
      t: p.t ?? null,
    })),
    oficial: !!oficial,
    enviadoEm: Date.now(),
  });
}

// Ouve o ranking da prova em tempo real. Retorna a função para parar de ouvir.
export function ouvirRanking(prova, onData, onError) {
  const q = query(collection(db, 'resultados'), where('prova', '==', slug(prova)));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

// Roteiro e largada da prova, compartilhados por todos os celulares com o mesmo código.
export const salvarProva = (prova, patch) => setDoc(doc(db, 'provas', slug(prova)), patch, { merge: true });
export function ouvirProva(prova, onData, onError) {
  return onSnapshot(doc(db, 'provas', slug(prova)), (d) => d.exists() && onData(d.data()), onError);
}

// Organizador: o primeiro a usar o código cria a prova com um PIN; depois só entra quem souber o PIN.
export async function entrarOrganizador(prova, pin) {
  const ref = doc(db, 'provas', slug(prova));
  const d = await getDoc(ref);
  if (!d.exists() || !d.data().pin) {
    await setDoc(ref, { pin: String(pin) }, { merge: true });
    return 'criada';
  }
  return d.data().pin === String(pin) ? 'ok' : 'negado';
}

// Inscrição dos competidores na prova (visível para o organizador). merge: não apaga largada/ordem já definidas.
export const inscrever = ({ prova, numero, piloto, navegador, classe, email }) =>
  setDoc(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`), {
    prova: slug(prova), numero: String(numero), piloto, navegador: navegador || '', classe, email: email || '', em: Date.now(),
  }, { merge: true });
// Organizador: define largada (HH:MM:SS) e ordem de um inscrito.
export const atualizarInscricao = (prova, numero, patch) =>
  setDoc(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`), { prova: slug(prova), numero: String(numero), ...patch }, { merge: true });
export const removerInscricao = (prova, numero) => deleteDoc(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`));
export function ouvirInscricao(prova, numero, onData, onError) {
  return onSnapshot(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`), (d) => onData(d.exists() ? d.data() : null), onError);
}
export function ouvirInscritos(prova, onData, onError) {
  const q = query(collection(db, 'inscricoes'), where('prova', '==', slug(prova)));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data()).sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || Number(a.numero) - Number(b.numero))), onError);
}

// Datalogger: trilha completa do competidor (compacta) para o resultado oficial.
export async function enviarDatalogger({ prova, numero, nome, classe, points, pcs }) {
  let pts = points;
  if (pts.length > 14000) pts = pts.filter((_, i) => i % 2 === 0);
  const t0 = pts[0].t;
  await setDoc(doc(db, 'dataloggers', `${slug(prova)}_${slug(numero)}`), {
    prova: slug(prova), numero: String(numero), nome: String(nome), classe: classe || 'GRADUADO',
    t0,
    t: pts.map((p) => Math.round((p.t - t0) / 1000)),
    la: pts.map((p) => Math.round(p.lat * 1e5)),
    lo: pts.map((p) => Math.round(p.lon * 1e5)),
    tIni: pcs && pcs[0] && pcs[0].t0 ? pcs[0].t0 : t0,
    enviadoEm: Date.now(),
  });
}
export function ouvirDataloggers(prova, onData, onError) {
  const q = query(collection(db, 'dataloggers'), where('prova', '==', slug(prova)));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
