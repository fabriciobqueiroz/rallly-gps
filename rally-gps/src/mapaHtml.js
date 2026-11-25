// HTML do mapa (Leaflet), compartilhado pela versão celular (WebView) e pela versão computador (iframe).
export const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#151a20}
.pin{background:#ff7a2e;color:#0c1014;font:700 12px sans-serif;border-radius:12px;padding:3px 7px;border:2px solid #fff;white-space:nowrap}
.pin.k{background:#1565c0;color:#fff;padding:1px 5px;font-size:11px}.pin.r{background:#ff1744;color:#fff;padding:1px 5px;font-size:11px}.pin.l{background:#2e7d32;color:#fff}.pin.c{background:#c0392b;color:#fff}.pin.s{background:#7b1fa2;color:#fff}</style></head>
<body><div id="m"></div><script>
var map=L.map('m',{zoomControl:true}).setView([-20.82,-49.38],13);
var osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var satl=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri'});
L.control.layers({'Mapa':osm,'Satélite':satl}).addTo(map);var satSet=false;
var layer=L.layerGroup().addTo(map),me=null,editable=false,fitted=false,lastCtr=0,lastFoc=0;
function send(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}
map.on('click',function(e){if(editable)send({t:'tap',lat:e.latlng.lat,lon:e.latlng.lng});});
function setData(d){
  layer.clearLayers();editable=!!d.editable;
  if(d.coords&&d.coords.length){var rw=d.rw||5;L.polyline(d.coords,{color:d.rc||'#ff7a2e',weight:rw,opacity:.95,lineCap:'round',lineJoin:'round',dashArray:d.dash?('1,'+(rw*2.2)):null}).addTo(layer);}
  if(d.coords2&&d.coords2.length){L.polyline(d.coords2,{color:d.rc2||'#ff7a2e',weight:4,opacity:.95}).addTo(layer);}
  if(d.sat&&!satSet){satSet=true;map.removeLayer(osm);satl.addTo(map);}
  (d.lines||[]).forEach(function(l){L.polyline([[l[0],l[1]],[l[2],l[3]]],{color:'#ff1744',weight:4,opacity:1}).addTo(layer);});
  (d.marks||[]).forEach(function(w){
    var mk=L.marker([w.lat,w.lon],{icon:L.divIcon({className:'',html:'<div class="pin '+(w.cls||'')+'">'+w.txt+'</div>',iconSize:null}),zIndexOffset:w.cls=='r'?1000:0}).addTo(layer);
    if(w.id!=null)mk.on('click',function(){send({t:'mk',id:w.id});});
  });
  if(d.foc){L.circleMarker(d.foc,{radius:16,color:'#ff1744',weight:3,fillOpacity:0}).addTo(layer);
    if(d.focn&&d.focn!==lastFoc){lastFoc=d.focn;map.setView(d.foc,Math.max(map.getZoom(),17));}}
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
