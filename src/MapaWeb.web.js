// Versão para o navegador do computador: o mesmo mapa dentro de um iframe.
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { HTML } from './mapaHtml';

const SHIM = '<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({rally:m},"*");}};</script>';
const DOC = HTML.replace('<body>', '<body>' + SHIM);

export default function MapaWeb({ wps = [], coords = [], coords2 = [], rc2 = '#ff7a2e', marks = [], lines = [], sat = false, follow = false, rw = 5, dash = false, rc = '#ff7a2e', ctr = 0, editable = false, me = null, onTap, height = 360 }) {
  const ref = useRef(null);
  const ready = useRef(false);
  const dados = { wps, coords, coords2, rc2, marks, lines, sat, follow, rw, dash, rc, ctr, editable, me };
  const push = () => {
    if (ready.current && ref.current && ref.current.contentWindow) ref.current.contentWindow.postMessage(JSON.stringify(dados), '*');
  };
  useEffect(push, [wps, coords, coords2, rc2, marks, lines, editable, me, follow, rw, dash, rc, ctr]);
  useEffect(() => {
    const on = (ev) => {
      if (!ev.data || typeof ev.data.rally !== 'string' || ev.source !== (ref.current && ref.current.contentWindow)) return;
      try {
        const msg = JSON.parse(ev.data.rally);
        if (msg.t === 'ready') { ready.current = true; push(); }
        else if (msg.t === 'tap' && onTap) onTap(msg.lat, msg.lon);
      } catch {}
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  });
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      <iframe ref={ref} srcDoc={DOC} style={{ border: 0, width: '100%', height: '100%', background: '#151a20' }} title="mapa" />
    </View>
  );
}
