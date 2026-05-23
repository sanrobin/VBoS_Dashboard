import { MapContainer, Marker, Popup, TileLayer, Circle, useMap, Polyline } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = defaultIcon;

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position[0] && position[1]) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

function VehicleMap({ vehicle }) {
  const position = [vehicle.latitude || 22.45, vehicle.longitude || 82.85];

  return (
    <section className="map-panel">
      <h2>Vehicle GPS Tracking</h2>
      <MapContainer center={position} zoom={16} scrollWheelZoom={false} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater position={position} />
        {vehicle.path && vehicle.path.length > 1 && (
          <Polyline positions={vehicle.path} color="blue" weight={4} opacity={0.7} />
        )}
        {vehicle.latitude && vehicle.longitude ? (
          <>
            <Marker position={position}>
              <Popup>
                <div>
                  <strong>{vehicle.vehicleNumber || 'Vehicle'}</strong>
                  <p>Weight: {vehicle.loadWeight} tons</p>
                  <p>Status: {vehicle.deviceStatus}</p>
                  <p>{vehicle.overload ? 'Overload alert' : 'Normal'}</p>
                </div>
              </Popup>
            </Marker>
            <Circle center={position} radius={400} pathOptions={{ color: 'blue', opacity: 0.3 }} />
          </>
        ) : null}
      </MapContainer>
    </section>
  );
}

export default VehicleMap;
