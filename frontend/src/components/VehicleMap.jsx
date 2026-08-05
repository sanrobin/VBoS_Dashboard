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

// Geofence centres (must match backend)
const SOURCE = { lat: 9.904190, lng: 78.034401 };
const DESTINATION = { lat: 9.904404, lng: 78.034454 };
const GEOFENCE_RADIUS = 5; // metres

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
  const isViolated = vehicle.activeTripStatus === 'violated' || vehicle.overload;

  return (
    <section className="map-panel">
      <h2>Vehicle GPS Tracking</h2>
      <div className="map-legend">
        <span className="legend-item"><span className="legend-dot legend-source"></span>Source Geofence</span>
        <span className="legend-item"><span className="legend-dot legend-dest"></span>Destination Geofence</span>
        <span className="legend-item"><span className="legend-dot legend-vehicle"></span>Vehicle</span>
      </div>
      <MapContainer center={position} zoom={18} scrollWheelZoom={true} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater position={position} />

        {/* Source geofence */}
        <Circle
          center={[SOURCE.lat, SOURCE.lng]}
          radius={GEOFENCE_RADIUS}
          pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.25, weight: 2 }}
        />

        {/* Destination geofence */}
        <Circle
          center={[DESTINATION.lat, DESTINATION.lng]}
          radius={GEOFENCE_RADIUS}
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2 }}
        />

        {/* Trip path */}
        {vehicle.path && vehicle.path.length > 1 && (
          <Polyline
            positions={vehicle.path}
            color={isViolated ? '#ef4444' : '#3b82f6'}
            weight={4}
            opacity={0.7}
          />
        )}

        {/* Vehicle marker */}
        {vehicle.latitude && vehicle.longitude ? (
          <Marker position={position}>
            <Popup>
              <div>
                <strong>{vehicle.vehicleNumber || 'Vehicle'}</strong>
                <p>Weight: {vehicle.loadWeight} tons</p>
                <p>Status: {vehicle.deviceStatus}</p>
                <p>{vehicle.overload ? '⚠️ Overload alert' : '✅ Normal'}</p>
                {vehicle.activeTripTokenId && <p>Token: {vehicle.activeTripTokenId}</p>}
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </section>
  );
}

export default VehicleMap;
