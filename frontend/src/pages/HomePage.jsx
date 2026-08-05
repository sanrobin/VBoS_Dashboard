import { useEffect, useState } from 'react';
import { fetchDashboard, fetchVehicle } from '../api/api';
import DashboardCards from '../components/DashboardCards';
import VehicleMap from '../components/VehicleMap';
import LoadGauge from '../components/LoadGauge';
import TokenBadge from '../components/TokenBadge';

function HomePage() {
  const [dashboard, setDashboard] = useState({
    totalTrips: 0, tripCountToday: 0, activeTrips: 0, violations: 0,
    overloadAlerts: 0, dailyLimit: 0, routeDistanceKm: 0
  });
  const [vehicle, setVehicle] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [dashboardData, vehicleData] = await Promise.all([fetchDashboard(), fetchVehicle()]);
      setDashboard(dashboardData);
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
          <strong>Vehicle Number</strong>
          <span>{vehicle.vehicleNumber || 'N/A'}</span>
        </div>
        <div>
          <strong>Token</strong>
          <span>{vehicle.activeTripTokenId || vehicle.tokenId || 'No Active Trip'}</span>
        </div>
        <div>
          <strong>Load Weight</strong>
          <span>
            {vehicle.loadWeight || 0} tons
            {vehicle.loadReadings && (
              <small className="reading-count"> ({vehicle.loadReadings.length}/10 readings)</small>
            )}
          </span>
        </div>
        <div>
          <strong>Trip Count</strong>
          <span>{dashboard.tripCountToday ?? 0} / {dashboard.dailyLimit ?? '—'}</span>
        </div>
        <div>
          <strong>Last Seen</strong>
          <span>{vehicle.timestamp ? new Date(vehicle.timestamp).toLocaleString() : 'Waiting...'}</span>
        </div>
        <div>
          <strong>Status</strong>
          <span className={`device-status device-status-${(vehicle.deviceStatus || 'unknown').toLowerCase()}`}>
            {vehicle.deviceStatus || 'Preparing sensor'}
          </span>
        </div>
      </section>

      {loading ? <div className="loading">Loading dashboard data...</div> : null}

      <div className="dashboard-row">
        <div className="dashboard-col-left">
          <LoadGauge vehicle={vehicle} />
          <TokenBadge vehicle={vehicle} />
        </div>
        <div className="dashboard-col-right">
          <VehicleMap vehicle={vehicle} />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
