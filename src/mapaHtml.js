// HTML do mapa (Leaflet), compartilhado pela versão celular (WebView) e pela versão computador (iframe).
export const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#151a20}
.pin{background:#ff7a2e;color:#0c1014;font:700 12px sans-serif;border-radius:12px;padding:3px 7px;border:2px solid #fff;white-space:nowrap}
.pin.k{background:#1565c0;color:#fff;padding:1px 5px;font-size:11px}.pin.r{background:#ff1744;color:#fff;padding:1px 5px;font-size:11px}.pin.l{background:#2e7d32;color:#fff}.pin.c{background:#c0392b;color:#fff}.pin.s{background:#7b1fa2;color:#fff}.kr .pin{border-radius:13px;width:max-content;min-width:26px;height:26px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:0 3px;background:#fff;color:#222;border:2px solid #9aa5ae;font:700 13px Montserrat,Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.45);transform:translate(-50%,-50%)}
.kr .pin.r{border-color:#fff;padding:0 9px;background:#ff1744;color:#fff}
.kr .pin.rn{border:3px solid #ff1744;background:#fff;color:#222}
.kr .pin.l{background:#2e7d32;color:#fff;border-color:#fff;border-radius:12px;padding:0 8px}.kr .pin.c{background:#c0392b;color:#fff;border-color:#fff;border-radius:12px;padding:0 8px}
.pcl{position:absolute;left:-1px;top:-34px;width:2px;height:68px;background:#ff5a1f}
.pct{position:absolute;left:4px;top:-9px;background:#1a1a1a;color:#ff6a2a;font:800 12px Montserrat,Arial,sans-serif;padding:2px 6px;border-radius:2px;white-space:nowrap}
.gpsx{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:#fff;color:#e53935;font:700 14px Montserrat,Arial,sans-serif;padding:9px 14px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.4);z-index:900}
.rb{width:46px;height:46px;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:400 26px Arial;color:#333;cursor:pointer;margin-top:14px}
</style></head>
<body><div id="m"></div><script>
var map=L.map('m',{zoomControl:true}).setView([-20.82,-49.38],13);
var osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var satl=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri'});
L.control.layers({'Mapa':osm,'Satélite':satl}).addTo(map);var satSet=false;
var layer=L.layerGroup().addTo(map),me=null,editable=false,fitted=false,lastCtr=0,lastFoc=0;

var arr=L.layerGroup().addTo(map),krc=null,kr=false,gx=null,zb=null;
function ang(a,b){var p=map.latLngToLayerPoint(a),q=map.latLngToLayerPoint(b);return Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;}
function nearI(lat,lon){var bi=0,bd=1e18;for(var i=0;i<krc.length;i++){var dy=krc[i][0]-lat,dx=(krc[i][1]-lon)*Math.cos(lat*Math.PI/180),d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i;}}return bi;}
function hdgAt(lat,lon){if(!krc||krc.length<2)return 0;var i=nearI(lat,lon),a=krc[Math.max(0,i-1)],b=krc[Math.min(krc.length-1,i+1)];return ang(a,b);}
function drawArr(){arr.clearLayers();if(!kr||!krc||krc.length<2)return;var gap=46,acc=gap/2;
  for(var i=1;i<krc.length;i++){var a=map.latLngToLayerPoint(krc[i-1]),b=map.latLngToLayerPoint(krc[i]),dx=b.x-a.x,dy=b.y-a.y,len=Math.sqrt(dx*dx+dy*dy);if(!len)continue;
    var deg=Math.atan2(dy,dx)*180/Math.PI,pos=gap-acc;
    while(pos<=len){var f=pos/len,pt=map.layerPointToLatLng(L.point(a.x+dx*f,a.y+dy*f));
      L.marker(pt,{interactive:false,keyboard:false,zIndexOffset:-1000,icon:L.divIcon({className:'',iconSize:[0,0],html:'<div style="position:absolute;left:-7px;top:-7px;width:14px;height:14px;transform:rotate('+deg+'deg)"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 2L10 7L3 12" fill="none" stroke="#1f9bd1" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'})}).addTo(arr);pos+=gap;}
    acc=(acc+len)%gap;}}
map.on('zoomend',drawArr);
function pcMark(lat,lon,txt){var h=hdgAt(lat,lon),t=h;if(t>90||t<-90)t+=180;
  return L.marker([lat,lon],{icon:L.divIcon({className:'',iconSize:[0,0],html:'<div style="position:absolute;left:0;top:0;transform-origin:0 0;transform:rotate('+h+'deg)"><div class="pcl"></div></div><div style="position:absolute;left:0;top:0;transform-origin:0 0;transform:rotate('+t+'deg)"><div class="pct">'+txt+'</div></div>'})});}
function setKr(on){kr=!!on;document.body.className=kr?'kr':'';
  if(kr&&!zb){map.zoomControl.remove();var Z=L.Control.extend({options:{position:'bottomright'},onAdd:function(){var d=L.DomUtil.create('div','');d.style.marginBottom='30px';
    d.innerHTML='<div class="rb" id="zi">+</div><div class="rb" id="zo">&minus;</div>';L.DomEvent.disableClickPropagation(d);d.querySelector('#zi').onclick=function(){map.zoomIn();};d.querySelector('#zo').onclick=function(){map.zoomOut();};return d;}});zb=new Z().addTo(map);
    gx=document.createElement('div');gx.className='gpsx';gx.textContent='Sem sinal de GPS';document.body.appendChild(gx);}
  if(gx)gx.style.display=(kr&&!window.__me)?'block':'none';}
function send(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));}
map.on('click',function(e){if(editable)send({t:'tap',lat:e.latlng.lat,lon:e.latlng.lng});});
function setData(d){
  layer.clearLayers();editable=!!d.editable;window.__me=d.me;setKr(d.kr);krc=(d.coords&&d.coords.length>1)?d.coords:null;
  if(d.coords&&d.coords.length){var rw=d.rw||5;L.polyline(d.coords,{color:d.kr?'#5cc9f5':(d.rc||'#ff7a2e'),weight:d.kr?4:rw,opacity:.95,lineCap:'round',lineJoin:'round',dashArray:d.dash?('1,'+(rw*2.2)):null}).addTo(layer);}
  if(d.coords2&&d.coords2.length){L.polyline(d.coords2,{color:d.rc2||'#ff7a2e',weight:4,opacity:.95}).addTo(layer);}
  if(d.sat&&!satSet){satSet=true;map.removeLayer(osm);satl.addTo(map);}
  (d.lines||[]).forEach(function(l){L.polyline([[l[0],l[1]],[l[2],l[3]]],{color:'#ff1744',weight:4,opacity:1}).addTo(layer);});
  (d.marks||[]).forEach(function(w){
    var mk;
    if(d.kr&&w.cls=='s'){mk=pcMark(w.lat,w.lon,(String(w.txt).indexOf('PC')==0?'PC '+String(w.txt).slice(2):w.txt)).addTo(layer);}
    else{var cl=w.cls||'';if(d.kr&&cl=='r'&&String(w.txt).indexOf('km')!=0)cl='rn';
      mk=L.marker([w.lat,w.lon],{icon:L.divIcon({className:'',html:'<div class="pin '+cl+'">'+w.txt+'</div>',iconSize:[0,0]}),zIndexOffset:w.cls=='r'?1000:0}).addTo(layer);}
    if(w.id!=null)mk.on('click',function(){send({t:'mk',id:w.id});});
  });
  if(d.foc){L.circleMarker(d.foc,{radius:16,color:'#ff1744',weight:3,fillOpacity:0}).addTo(layer);
    if(d.focn&&d.focn!==lastFoc){lastFoc=d.focn;map.setView(d.foc,Math.max(map.getZoom(),17));}}
  (d.wps||[]).forEach(function(w,i){
    var last=i==d.wps.length-1&&i>0,cls=i==0?'l':(last?'c':''),txt=i==0?'Largada':(last?'Chegada':'PC'+i);
    if(d.kr&&cls==''){pcMark(w[0],w[1],'PC '+i).addTo(layer);return;}
    L.marker([w[0],w[1]],{icon:L.divIcon({className:'',html:'<div class="pin '+cls+'">'+txt+'</div>',iconSize:d.kr?[0,0]:null})}).addTo(layer);
  });
  drawArr();
  if(!fitted&&d.wps&&d.wps.length){map.fitBounds(d.wps,{padding:[30,30],maxZoom:17});fitted=true;}
  if(d.me){if(me)me.setLatLng(d.me);else me=L.circleMarker(d.me,{radius:8,color:'#fff',weight:2,fillColor:'#1565c0',fillOpacity:1}).addTo(map);
    if(!fitted){map.setView(d.me,d.sat?18:15);fitted=true;}else if(d.follow){map.panTo(d.me);}
    if(d.ctr&&d.ctr!==lastCtr){lastCtr=d.ctr;map.setView(d.me,Math.max(map.getZoom(),17));}}
}
document.addEventListener('message',function(e){setData(JSON.parse(e.data));});
window.addEventListener('message',function(e){setData(JSON.parse(e.data));});
send({t:'ready'});
</script></body></html>`;
