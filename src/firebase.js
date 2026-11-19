// Ligação com o Firestore (banco na nuvem) para o ranking.
import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

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

export async function enviarResultado({ prova, numero, nome, pcs, pontos }) {
  const id = `${slug(prova)}_${slug(numero)}`;
  await setDoc(doc(db, 'resultados', id), {
    prova: slug(prova),
    numero: String(numero),
    nome: String(nome),
    npcs: pcs.length,
    pontos: Math.round(pontos * 10) / 10,
    pcs: pcs.map((p) => ({
      n: p.n,
      trecho: p.trecho ?? null,
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
