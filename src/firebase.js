// Ligação com o Firestore (banco na nuvem) para o ranking.
import { initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, getReactNativePersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

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
const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

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
    uid: oficial ? 'oficial' : (auth.currentUser?.uid || ''),
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

// ---------- Conta (e-mail e senha) ----------
export const ouvirAuth = (cb) => onAuthStateChanged(auth, cb);
export const uidAtual = () => auth.currentUser?.uid || null;
export const entrarConta = async (email, senha) => (await signInWithEmailAndPassword(auth, email.trim(), senha)).user;
export const criarConta = async (email, senha) => (await createUserWithEmailAndPassword(auth, email.trim(), senha)).user;
export const sairConta = () => signOut(auth);
export const recuperarSenha = (email) => sendPasswordResetEmail(auth, email.trim());
// Perfil: um e-mail pode ter cadastro de competidor e de organizador (papéis separados).
export const lerPerfil = async (uid) => { const d = await getDoc(doc(db, 'usuarios', uid)); return d.exists() ? d.data() : { papeis: {} }; };
export async function addPapel(uid, email, papel) {
  const p = await lerPerfil(uid);
  await setDoc(doc(db, 'usuarios', uid), { email: email.trim().toLowerCase(), papeis: { ...(p.papeis || {}), [papel]: true } }, { merge: true });
}

// ---------- Provas do organizador ----------
// O dono da prova é quem a criou (donoUid): só ele edita. O código de 4 números é gerado aqui.
export const lerProva = async (prova) => { const d = await getDoc(doc(db, 'provas', slug(prova))); return d.exists() ? d.data() : null; };
export async function criarProva(nome, cidade, data, dataTs) {
  const u = auth.currentUser;
  if (!u) throw new Error('Entre na sua conta primeiro.');
  for (let t = 0; t < 10; t++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const d = await getDoc(doc(db, 'provas', code));
    if (d.exists()) continue;
    await setDoc(doc(db, 'provas', code), { nome, cidade: cidade || '', data: data || '', dataTs: dataTs ?? null, donoUid: u.uid, donoEmail: (u.email || '').toLowerCase(), criadaEm: Date.now() });
    return code;
  }
  throw new Error('Não achei um código livre. Tente de novo.');
}
export function ouvirMinhasProvas(onData, onError) {
  const u = auth.currentUser;
  if (!u) return () => {};
  return onSnapshot(query(collection(db, 'provas'), where('donoUid', '==', u.uid)), (snap) => onData(snap.docs.map((d) => ({ code: d.id, nome: d.data().nome || '', cidade: d.data().cidade || '', data: d.data().data || '', dataTs: d.data().dataTs ?? null }))), onError);
}
export async function apagarProvaNuvem(prova) {
  const p = slug(prova);
  for (const col of ['inscricoes', 'acessos', 'resultados', 'dataloggers']) {
    const snap = await getDocs(query(collection(db, col), where('prova', '==', p)));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, 'provas', p));
}

// ---------- Espelho navegador → piloto (mesma conta) ----------
export const publicarEspelho = (payload) => {
  const u = auth.currentUser;
  if (!u) return Promise.resolve();
  return setDoc(doc(db, 'espelho', u.uid), { ...payload, em: Date.now() });
};
export function ouvirEspelho(onData, onError) {
  const u = auth.currentUser;
  if (!u) return () => {};
  return onSnapshot(doc(db, 'espelho', u.uid), (d) => onData(d.exists() ? d.data() : null), onError);
}

// ---------- Inscrições ----------
// O organizador cadastra o e-mail do competidor principal; só esse e-mail enxerga a prova e a planilha.
export async function inscrever({ prova, provaNome, numero, piloto, navegador, equipe, classe, email }) {
  const em = String(email || '').trim().toLowerCase();
  await setDoc(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`), {
    prova: slug(prova), provaNome: provaNome || '', numero: String(numero), piloto, navegador: navegador || '', equipe: equipe || '', classe, email: em, em: Date.now(),
  }, { merge: true });
  if (em) await setDoc(doc(db, 'acessos', `${slug(prova)}__${em}`), { prova: slug(prova), email: em, numero: String(numero) });
}
export const removerInscricao = async (prova, numero, email) => {
  await deleteDoc(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`));
  const em = String(email || '').trim().toLowerCase();
  if (em) await deleteDoc(doc(db, 'acessos', `${slug(prova)}__${em}`));
};
// Competidor: as inscrições feitas no e-mail dele (nas provas de qualquer organizador).
export function ouvirMinhasInscricoes(email, onData, onError) {
  const q = query(collection(db, 'inscricoes'), where('email', '==', String(email).trim().toLowerCase()));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

// Organizador: define largada (HH:MM:SS) e ordem de um inscrito.
export const atualizarInscricao = (prova, numero, patch) =>
  setDoc(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`), { prova: slug(prova), numero: String(numero), ...patch }, { merge: true });
// Competidor: a inscrição dele nesta prova (achada pelo e-mail), com a largada definida pelo organizador.
export function ouvirMinhaLargada(prova, email, onData, onError) {
  const q = query(collection(db, 'inscricoes'), where('prova', '==', slug(prova)), where('email', '==', String(email).trim().toLowerCase()));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
export function ouvirInscricao(prova, numero, onData, onError) {
  return onSnapshot(doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`), (d) => onData(d.exists() ? d.data() : null), onError);
}
export function ouvirInscritos(prova, onData, onError) {
  const q = query(collection(db, 'inscricoes'), where('prova', '==', slug(prova)));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data()).sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9) || Number(a.numero) - Number(b.numero))), onError);
}

// Datalogger: trilha completa do competidor (compacta) para o resultado oficial.
export async function enviarDatalogger({ prova, numero, nome, classe, points, pcs, tIni: tIniArg }) {
  let pts = points;
  if (pts.length > 14000) pts = pts.filter((_, i) => i % 2 === 0);
  const t0 = pts[0].t;
  await setDoc(doc(db, 'dataloggers', `${slug(prova)}_${slug(numero)}`), {
    prova: slug(prova), numero: String(numero), nome: String(nome), classe: classe || 'GRADUADO',
    t0,
    t: pts.map((p) => Math.round((p.t - t0) / 1000)),
    la: pts.map((p) => Math.round(p.lat * 1e5)),
    lo: pts.map((p) => Math.round(p.lon * 1e5)),
    tIni: tIniArg || (pcs && pcs[0] && pcs[0].t0 ? pcs[0].t0 : t0),
    uid: auth.currentUser?.uid || '',
    enviadoEm: Date.now(),
  });
}
// Competidor: o próprio datalogger (só lê se o organizador liberou o track log).
export function ouvirMeuDatalogger(prova, uid, onData, onError) {
  const q = query(collection(db, 'dataloggers'), where('prova', '==', slug(prova)), where('uid', '==', uid));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
export function ouvirDataloggers(prova, onData, onError) {
  const q = query(collection(db, 'dataloggers'), where('prova', '==', slug(prova)));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
