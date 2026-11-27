import { useEffect } from 'react';
import { MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, iconRetinaUrl: icon2x, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41] });

export type LatLng = [number, number];

function Clicks({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => { map.setView(center); }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function MapPicker({ center, marker, boundary, onClick, height = 360 }: { center: LatLng; marker?: LatLng | null; boundary?: LatLng[]; onClick: (p: LatLng) => void; height?: number }) {
  return (
    <MapContainer center={center} zoom={15} style={{ height }} scrollWheelZoom>
      <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
      <Clicks onClick={onClick} />
      <Recenter center={center} />
      {marker && <Marker position={marker} />}
      {boundary && boundary.length > 1 && <Polygon positions={boundary} pathOptions={{ color: '#facc15', weight: 2 }} />}
    </MapContainer>
  );
}
