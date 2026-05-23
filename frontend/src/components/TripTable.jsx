function TripTable({ trips }) {
  return (
    <section className="table-panel">
      <h2>Trip History</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Token ID</th>
              <th>Vehicle</th>
              <th>Weight (T)</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan="6">No trip history available yet.</td>
              </tr>
            ) : (
              trips.map((trip) => (
                <tr key={trip._id}>
                  <td>{trip.tokenId}</td>
                  <td>{trip.vehicleNumber}</td>
                  <td>{trip.loadWeight}</td>
                  <td>{trip.status}</td>
                  <td>{new Date(trip.startTime).toLocaleString()}</td>
                  <td>{trip.endTime ? new Date(trip.endTime).toLocaleString() : 'In progress'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default TripTable;
