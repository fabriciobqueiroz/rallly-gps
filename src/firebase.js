// Ligação com o Firestore (banco na nuvem) para o ranking.
import { initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getAuth, initializeAuth, getReactNativePersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
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
const auth = Platform.OS === 'web' ? getAuth(app) : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

const slug = (s) => String(s).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');

export async function enviarResultado({ prova, numero, nome, classe, pcs, pontos, oficial, extra }) {
  const id = `${slug(prova)}_${slug(numero)}`;
  await setDoc(doc(db, 'resultados', id), {
    prova: slug(prova),
    numero: String(numero),
    nome: String(nome),
    classe: classe || 'GRADUADO',
    npcs: (extra && extra.npcs) ?? pcs.length,
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
    ...(extra || {}),
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
export const salvarDadosPerfil = (uid, dados) => setDoc(doc(db, 'usuarios', uid), { perfil: dados }, { merge: true });
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
// Marcas e distância total da prova, lidas da nuvem (levantamento salvo e/ou planilha publicada).
function resumoProva(d) {
  const marks = (d.lev && d.lev.marks) || [];
  const legsKm = Array.isArray(d.legs) ? d.legs.reduce((a, x) => a + (Number(x) || 0), 0) : 0;
  const maxKm = marks.reduce((a, m) => Math.max(a, Number(m.km) || 0), 0);
  const tul = Array.isArray(d.tul) ? d.tul.filter((e) => e && e.t !== 'L' && e.t !== 'C').length : 0;
  return { nMarcas: marks.length || tul, kmM: legsKm > 0 ? Math.round(legsKm * 1000) : Math.round(maxKm) };
}
export function ouvirMinhasProvas(onData, onError) {
  const u = auth.currentUser;
  if (!u) return () => {};
  return onSnapshot(query(collection(db, 'provas'), where('donoUid', '==', u.uid)), (snap) => onData(snap.docs.map((d) => ({ code: d.id, nome: d.data().nome || '', cidade: d.data().cidade || '', data: d.data().data || '', dataTs: d.data().dataTs ?? null, ...resumoProva(d.data()) }))), onError);
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
  const em = String(email || '').trim().toLowerCase();
  const ref = doc(db, 'inscricoes', `${slug(prova)}_${slug(numero)}`);
  // Só apaga a inscrição se ela for mesmo desse e-mail (evita apagar a de outro competidor com o mesmo número).
  let apaga = true;
  try { const d = await getDoc(ref); if (d.exists() && em && String(d.data().email || '').toLowerCase() !== em) apaga = false; } catch (e) { /* segue */ }
  if (apaga) await deleteDoc(ref);
  if (em) {
    await deleteDoc(doc(db, 'acessos', `${slug(prova)}__${em}`)).catch(() => {});
    // O pedido de vaga também sai, para o competidor poder pedir de novo.
    try {
      const q = await getDocs(query(collection(db, 'pedidos'), where('prova', '==', slug(prova)), where('email', '==', em)));
      await Promise.all(q.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    } catch (e) { /* segue */ }
  }
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
    esc: 2, // esc 2 = tempo em milissegundos e coordenadas com 6 casas (~0,1 m); sem esc = formato antigo (segundos, 5 casas)
    t: pts.map((p) => Math.round(p.t - t0)),
    la: pts.map((p) => Math.round(p.lat * 1e6)),
    lo: pts.map((p) => Math.round(p.lon * 1e6)),
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

// ---------- Trilhas ----------
// trilhas/{id}: dados da trilha (organizador). trilhaInsc/{id_uid}: pedido de vaga. trilhaTracks/{id_uid}: percurso gravado.
export const idTrilha = () => 'T' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
export async function salvarTrilha(id, data) {
  const u = auth.currentUser;
  if (!u) throw new Error('Entre na sua conta primeiro.');
  await setDoc(doc(db, 'trilhas', id), { ...data, donoUid: u.uid, donoEmail: (u.email || '').toLowerCase(), atualizadaEm: Date.now() }, { merge: true });
}
export function ouvirTrilhasAbertas(onData, onError) {
  return onSnapshot(query(collection(db, 'trilhas'), where('aberta', '==', true)), (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}
export function ouvirMinhasTrilhasOrg(onData, onError) {
  const u = auth.currentUser;
  if (!u) return () => {};
  return onSnapshot(query(collection(db, 'trilhas'), where('donoUid', '==', u.uid)), (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}
export async function apagarTrilha(id) {
  for (const col of ['trilhaInsc', 'trilhaTracks']) {
    const snap = await getDocs(query(collection(db, col), where('trilha', '==', id)));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, 'trilhas', id));
}
export function ouvirInscTrilha(id, onData, onError) {
  return onSnapshot(query(collection(db, 'trilhaInsc'), where('trilha', '==', id)), (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
export function ouvirMinhasInscTrilhas(onData, onError) {
  const u = auth.currentUser;
  if (!u) return () => {};
  return onSnapshot(query(collection(db, 'trilhaInsc'), where('uid', '==', u.uid)), (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
export async function pedirVagaTrilha(trilha, { nome, veiculo, pessoas }) {
  const u = auth.currentUser;
  if (!u) throw new Error('Entre na sua conta primeiro.');
  await setDoc(doc(db, 'trilhaInsc', `${trilha}_${u.uid}`), { trilha, uid: u.uid, email: (u.email || '').toLowerCase(), nome: nome || '', veiculo: veiculo || '', pessoas: pessoas || 1, status: 'pedido', em: Date.now() });
}
// Participante: confirma presença ou cancela. Organizador: aprova, recusa, ordem sugerida.
export const atualizarInscTrilha = (trilha, uid, patch) => setDoc(doc(db, 'trilhaInsc', `${trilha}_${uid}`), { ...patch, em: Date.now() }, { merge: true });
export const removerInscTrilha = (trilha, uid) => deleteDoc(doc(db, 'trilhaInsc', `${trilha}_${uid}`));
export async function enviarTrackTrilha({ trilha, nome, points, km, titulo }) {
  const u = auth.currentUser;
  if (!u) throw new Error('Entre na sua conta primeiro.');
  let pts = points;
  if (pts.length > 14000) pts = pts.filter((_, i) => i % 2 === 0);
  if (pts.length < 2) throw new Error('Poucos pontos gravados.');
  const t0 = pts[0].t;
  await setDoc(doc(db, 'trilhaTracks', `${trilha}_${u.uid}`), {
    trilha, uid: u.uid, nome: nome || '', titulo: titulo || '', km: Math.round((km || 0) * 10) / 10, t0,
    t: pts.map((p) => Math.round((p.t - t0) / 1000)), la: pts.map((p) => Math.round(p.lat * 1e5)), lo: pts.map((p) => Math.round(p.lon * 1e5)),
    publico: false, em: Date.now(),
  }, { merge: true });
}
export const publicarTrackTrilha = (trilha, uid, publico) => setDoc(doc(db, 'trilhaTracks', `${trilha}_${uid}`), { publico: !!publico }, { merge: true });
export function ouvirMeusTracksTrilha(onData, onError) {
  const u = auth.currentUser;
  if (!u) return () => {};
  return onSnapshot(query(collection(db, 'trilhaTracks'), where('uid', '==', u.uid)), (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
export function ouvirTracksPublicosTrilha(trilha, onData, onError) {
  return onSnapshot(query(collection(db, 'trilhaTracks'), where('trilha', '==', trilha), where('publico', '==', true)), (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

// ---------- Ao vivo (posição em tempo real; só informativo, o resultado oficial vem do datalogger) ----------
export async function enviarAoVivo({ kind, id, nome, numero, lat, lon, t, spd, acc, hdg, classe, tel }) {
  const u = auth.currentUser;
  if (!u) return;
  await setDoc(doc(db, 'aoVivo', `${kind}_${id}_${u.uid}`), {
    kind, id, uid: u.uid, nome: nome || '', numero: numero || '', lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6,
    t: t || Date.now(), spd: spd != null ? Math.round(spd * 3.6) : null, acc: acc != null ? Math.round(acc) : null, em: Date.now(),
    classe: classe || '', avg: tel ? tel.avg ?? null : null, alvo: tel ? tel.alvo ?? null : null, trecho: tel ? tel.trecho ?? null : null, pcs: tel && tel.pcs ? tel.pcs : [], pav: tel && tel.pav ? tel.pav : [], pel: tel && tel.pel ? tel.pel : [],
    hdg: hdg != null && hdg >= 0 ? Math.round(hdg) : null,
  });
}
export async function limparAoVivo(kind, id) {
  const u = auth.currentUser;
  if (!u) return;
  await deleteDoc(doc(db, 'aoVivo', `${kind}_${id}_${u.uid}`));
}
export function ouvirAoVivo(kind, id, onData, onError) {
  return onSnapshot(query(collection(db, 'aoVivo'), where('kind', '==', kind), where('id', '==', id)), (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

// ---------- Eventos disponíveis (vitrine) e pedidos de inscrição ----------
// A vitrine guarda só o que é público (nome, cidade, data, categorias): a planilha continua restrita aos inscritos.
export async function abrirVitrine(prova, abertas) {
  const code = slug(prova);
  if (!abertas) return deleteDoc(doc(db, 'vitrine', code)).catch(() => {});
  const d = await lerProva(code);
  if (!d) throw new Error('Prova não encontrada na nuvem. Publique a planilha antes.');
  await setDoc(doc(db, 'vitrine', code), {
    prova: code, donoUid: d.donoUid || '', nome: d.nome || '', cidade: d.cidade || '', data: d.data || '', dataTs: d.dataTs ?? null,
    categorias: (d.categorias || []).map((c) => c.nome), em: Date.now(),
  });
}
export const ouvirVitrine = (onData, onError) => onSnapshot(collection(db, 'vitrine'), (snap) => onData(snap.docs.map((d) => d.data())), onError);
export const ouvirVitrineProva = (prova, onData, onError) => onSnapshot(doc(db, 'vitrine', slug(prova)), (d) => onData(d.exists()), onError);
export async function pedirVagaProva(prova, { provaNome, piloto, navegador, equipe, classe, numero }) {
  const u = auth.currentUser;
  if (!u) throw new Error('Entre na sua conta primeiro.');
  // Pedido antigo (aprovado/recusado) é apagado antes, para poder pedir de novo.
  await deleteDoc(doc(db, 'pedidos', `${slug(prova)}_${u.uid}`)).catch(() => {});
  await setDoc(doc(db, 'pedidos', `${slug(prova)}_${u.uid}`), {
    prova: slug(prova), provaNome: provaNome || '', uid: u.uid, email: (u.email || '').toLowerCase(), piloto: piloto || '', navegador: navegador || '',
    equipe: equipe || '', classe: classe || '', numero: String(numero || ''), status: 'pedido', em: Date.now(),
  });
}
export function ouvirMeusPedidos(onData, onError) {
  const u = auth.currentUser;
  if (!u) return () => {};
  return onSnapshot(query(collection(db, 'pedidos'), where('uid', '==', u.uid)), (snap) => onData(snap.docs.map((d) => d.data())), onError);
}
export const ouvirPedidosProva = (prova, onData, onError) =>
  onSnapshot(query(collection(db, 'pedidos'), where('prova', '==', slug(prova))), (snap) => onData(snap.docs.map((d) => d.data()).sort((a, b) => (a.em || 0) - (b.em || 0))), onError);
export const cancelarPedido = (prova, uid) => deleteDoc(doc(db, 'pedidos', `${slug(prova)}_${uid}`));
export const decidirPedido = (prova, uid, patch) => setDoc(doc(db, 'pedidos', `${slug(prova)}_${uid}`), { ...patch, em: Date.now() }, { merge: true });

// ---------- Master: lista de cadastrados ----------
// Só estas contas veem a lista (as regras do Firestore conferem o mesmo e-mail).
export const MASTERS = ['fabriciobqueiroz@gmail.com'];
// MASTERS = dono (fixo, não se remove); os demais ficam em config/masters {emails: [...]}.
export const ehMaster = (email, extras = []) => { const e = String(email || '').trim().toLowerCase(); return MASTERS.includes(e) || extras.includes(e); };
export const ouvirMasters = (onData, onError) => onSnapshot(doc(db, 'config', 'masters'), (d) => onData(d.exists() ? (d.data().emails || []) : []), onError);
export const salvarMasters = (emails) => setDoc(doc(db, 'config', 'masters'), { emails: [...new Set(emails.map((x) => String(x).trim().toLowerCase()))] });
export const ouvirUsuarios = (onData, onError) => onSnapshot(collection(db, 'usuarios'), (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))), onError);
