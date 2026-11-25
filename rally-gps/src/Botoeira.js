// Botoeira: usa os botões de volume do celular e do fone com fio como botões de comando durante a prova.
// O volume é mantido no meio da escala: cada aperto desvia o volume para cima ou para baixo, o app lê o sentido e recentraliza.
import { useEffect, useRef } from 'react';
let VM = null;
try { VM = require('react-native-volume-manager'); } catch {}

export function useBotoeira(ativo, onTecla) {
  const cb = useRef(onTecla);
  cb.current = onTecla;
  useEffect(() => {
    const M = VM && VM.VolumeManager;
    if (!ativo || !M) return undefined;
    let vivo = true, base = 0.7, ignora = 0, orig = null, sub = null;
    const lerVol = (r) => (typeof r === 'number' ? r : r && r.volume);
    const centra = async () => {
      try { ignora = Date.now() + 500; await M.setVolume(0.7, { showUI: false, playSound: false }); const v = lerVol(await M.getVolume()); if (v != null) base = v; } catch {}
    };
    (async () => {
      try { orig = lerVol(await M.getVolume()); } catch {}
      try { await M.showNativeVolumeUI({ enabled: false }); } catch {}
      await centra();
      if (!vivo) return;
      try {
        sub = M.addVolumeListener((r) => {
          const v = lerVol(r);
          if (v == null || Date.now() < ignora || Math.abs(v - base) < 0.005) return;
          const dir = v > base ? 'up' : 'down';
          centra();
          try { cb.current(dir); } catch {}
        });
      } catch {}
    })();
    return () => {
      vivo = false;
      try { sub && sub.remove(); } catch {}
      try { M.showNativeVolumeUI({ enabled: true }); } catch {}
      try { if (orig != null) M.setVolume(orig, { showUI: false, playSound: false }); } catch {}
    };
  }, [ativo]);
}
