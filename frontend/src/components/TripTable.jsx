import { useState } from 'react';

function TripTable({ trips }) {
  const [copiedId, setCopiedId] = useState(null);

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedId(hash);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <section className="table-panel">
      <h2>Trip History</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Trip #</th>
              <th>Token ID</th>
              <th>Vehicle</th>
              <th>Load (T)</th>
              <th>Final Load (T)</th>
              <th>Status</th>
              <th>Violation</th>
              <th>Start</th>
              <th>End</th>
              <th>Token Hash</th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan="10">No trip history available yet.</td>
              </tr>
            ) : (
              trips.map((trip) => (
                <tr key={trip._id} className={trip.violated ? 'row-violated' : ''}>
                  <td>{trip.tripNumber ?? '—'}</td>
                  <td className="token-cell">{trip.tokenId}</td>
                  <td>{trip.vehicleNumber}</td>
                  <td>{trip.loadWeight}</td>
                  <td>{trip.finalLoad ?? '—'}</td>
                  <td>
                    <span className={`status-badge status-${trip.status}`}>
                      {trip.status}
                    </span>
                  </td>
                  <td>
                    {trip.violationType && trip.violationType.length > 0
                      ? trip.violationType.map((v) => (
                          <span key={v} className={`violation-badge violation-${v.replace('_', '-')}`}>
                            {v === 'overload' ? '⚠ Overload' : '🚫 Limit'}
                          </span>
                        ))
                      : <span className="no-violation">—</span>}
                  </td>
                  <td>{new Date(trip.startTime).toLocaleString()}</td>
                  <td>{trip.endTime ? new Date(trip.endTime).toLocaleString() : 'In progress'}</td>
                  <td>
                    {trip.tokenHash ? (
                      <button
                        className={`hash-btn ${copiedId === trip.tokenHash ? 'copied' : ''}`}
                        onClick={() => copyHash(trip.tokenHash)}
                        title={trip.tokenHash}
                      >
                        {copiedId === trip.tokenHash ? '✓ Copied' : trip.tokenHash.slice(0, 12) + '…'}
                      </button>
                    ) : '—'}
                  </td>
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
