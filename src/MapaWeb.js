// Mapa (OpenStreetMap + Leaflet) dentro de uma WebView. Sem chave de API e sem custo.
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#151a20}
.pin{background:#ff7a2e;color:#0c1014;font:700 12px sans-serif;border-radius:12px;padding:3px 7px;border:2px solid #fff;white-space:nowrap}
.pin.l{background:#2e7d32;color:#fff}.pin.c{background:#c0392b;color:#fff}.pin.s{background:#7b1fa2;color:#fff}</style></head>
<body><div id="m"></div><script>
var map=L.map('m',{zoomControl:true}).setView([-20.82,-49.38],13);
var osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var satl=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri'});
L.control.layers({'Mapa':osm,'Satélite':satl}).addTo(map);var satSet=false;
var layer=L.layerGroup().addTo(map),me=null,editable=false,fitted=false,lastCtr=0;
function send(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}
map.on('click',function(e){if(editable)send({t:'tap',lat:e.latlng.lat,lon:e.latlng.lng});});
function setData(d){
  layer.clearLayers();editable=!!d.editable;
  if(d.coords&&d.coords.length){var rw=d.rw||5;L.polyline(d.coords,{color:d.rc||'#ff7a2e',weight:rw,opacity:.95,lineCap:'round',lineJoin:'round',dashArray:d.dash?('1,'+(rw*2.2)):null}).addTo(layer);}
  if(d.sat&&!satSet){satSet=true;map.removeLayer(osm);satl.addTo(map);}
  (d.lines||[]).forEach(function(l){L.polyline([[l[0],l[1]],[l[2],l[3]]],{color:'#ff1744',weight:4,opacity:1}).addTo(layer);});
  (d.marks||[]).forEach(function(w){
    L.marker([w.lat,w.lon],{icon:L.divIcon({className:'',html:'<div class="pin '+(w.cls||'')+'">'+w.txt+'</div>',iconSize:null})}).addTo(layer);
  });
  (d.wps||[]).forEach(function(w,i){
    var last=i==d.wps.length-1&&i>0,cls=i==0?'l':(last?'c':''),txt=i==0?'Largada':(last?'Chegada':'PC'+i);
    L.marker([w[0],w[1]],{icon:L.divIcon({className:'',html:'<div class="pin '+cls+'">'+txt+'</div>',iconSize:null})}).addTo(layer);
  });
  if(!fitted&&d.wps&&d.wps.length){map.fitBounds(d.wps,{padding:[30,30],maxZoom:17});fitted=true;}
  if(d.me){if(me)me.setLatLng(d.me);else me=L.circleMarker(d.me,{radius:8,color:'#fff',weight:2,fillColor:'#1565c0',fillOpacity:1}).addTo(map);
    if(!fitted){map.setView(d.me,d.sat?18:15);fitted=true;}else if(d.follow){map.panTo(d.me);}
    if(d.ctr&&d.ctr!==lastCtr){lastCtr=d.ctr;map.setView(d.me,Math.max(map.getZoom(),17));}}
}
document.addEventListener('message',function(e){setData(JSON.parse(e.data));});
window.addEventListener('message',function(e){setData(JSON.parse(e.data));});
send({t:'ready'});
</script></body></html>`;

export default function MapaWeb({ wps = [], coords = [], marks = [], lines = [], sat = false, follow = false, rw = 5, dash = false, rc = '#ff7a2e', ctr = 0, editable = false, me = null, onTap, height = 360 }) {
  const ref = useRef(null);
  const ready = useRef(false);
  const push = () => {
    if (ready.current && ref.current) ref.current.postMessage(JSON.stringify({ wps, coords, marks, lines, sat, follow, rw, dash, rc, ctr, editable, me }));
  };
  useEffect(push, [wps, coords, marks, lines, editable, me, follow, rw, dash, rc, ctr]);
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
