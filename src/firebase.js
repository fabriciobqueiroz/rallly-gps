// Ligação com o Firestore (banco na nuvem) para o ranking.
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

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

export async function enviarResultado({ prova, numero, nome, classe, pcs, pontos }) {
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
    })),
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

// Inscrição dos competidores na prova (visível para o organizador).
export const inscrever = ({ prova, numero, piloto, navegador, classe }) =>
  setDoc(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`), {
    prova: slug(prova), numero: String(numero), piloto, navegador: navegador || '', classe, em: Date.now(),
  });
export function ouvirInscritos(prova, onData, onError) {
  const q = query(collection(db, 'inscricoes'), where('prova', '==', slug(prova)));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data()).sort((a, b) => Number(a.numero) - Number(b.numero))), onError);
}
