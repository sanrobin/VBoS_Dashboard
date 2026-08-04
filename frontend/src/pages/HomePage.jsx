import { useEffect, useState } from 'react';
import { fetchDashboard, fetchTrips, fetchVehicle } from '../api/api';
import DashboardCards from '../components/DashboardCards';
import VehicleMap from '../components/VehicleMap';
import TripTable from '../components/TripTable';

function HomePage() {
  const [dashboard, setDashboard] = useState({ totalTrips: 0, activeTrips: 0, violations: 0, overloadAlerts: 0 });
  const [vehicle, setVehicle] = useState({});
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [dashboardData, tripsData, vehicleData] = await Promise.all([fetchDashboard(), fetchTrips(), fetchVehicle()]);
      setDashboard(dashboardData);
      setTrips(tripsData);
      setVehicle(vehicleData);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 5000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="content">
      <DashboardCards data={dashboard} />
      <section className="status-banner">
        <div>
          <strong>Vehicle Number:</strong> {vehicle.vehicleNumber || 'N/A'}
        </div>
        <div>
          <strong>Token:</strong> {vehicle.activeTripTokenId || vehicle.tokenId || 'No Active Trip'}
        </div>
        <div>
          <strong>Load Weight:</strong> {vehicle.loadWeight || 0} tons
        </div>
        <div>
          <strong>Last Seen:</strong> {vehicle.timestamp ? new Date(vehicle.timestamp).toLocaleString() : 'Waiting...'}
        </div>
        <div>
          <strong>Status:</strong> {vehicle.deviceStatus || 'Preparing sensor'}
        </div>
      </section>

      {loading ? <div className="loading">Loading dashboard data...</div> : null}

      <VehicleMap vehicle={vehicle} />
    </div>
  );
}

export default HomePage;
