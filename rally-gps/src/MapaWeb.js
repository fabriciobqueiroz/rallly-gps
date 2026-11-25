// Mapa (OpenStreetMap + Leaflet) dentro de uma WebView. Sem chave de API e sem custo.
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { HTML } from './mapaHtml';

export default function MapaWeb({ wps = [], coords = [], coords2 = [], rc2 = '#ff7a2e', marks = [], lines = [], sat = false, follow = false, rw = 5, dash = false, rc = '#ff7a2e', ctr = 0, editable = false, me = null, onTap, height = 360 }) {
  const ref = useRef(null);
  const ready = useRef(false);
  const push = () => {
    if (ready.current && ref.current) ref.current.postMessage(JSON.stringify({ wps, coords, coords2, rc2, marks, lines, sat, follow, rw, dash, rc, ctr, editable, me }));
  };
  useEffect(push, [wps, coords, coords2, rc2, marks, lines, editable, me, follow, rw, dash, rc, ctr]);
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: HTML }}
        nestedScrollEnabled
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.t === 'ready') { ready.current = true; push(); }
            else if (m.t === 'tap' && onTap) onTap(m.lat, m.lon);
          } catch {}
        }}
        style={{ backgroundColor: '#151a20' }}
      />
    </View>
  );
}
