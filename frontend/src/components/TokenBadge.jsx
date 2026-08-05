function TokenBadge({ vehicle }) {
  const tokenId = vehicle.activeTripTokenId || vehicle.tokenId;
  const status = vehicle.activeTripStatus;
  const isActive = status === 'active';
  const tripNumber = vehicle.tripNumber;

  if (!tokenId) {
    return (
      <section className="token-badge-panel">
        <h2>Current Token</h2>
        <div className="token-badge idle">
          <span className="token-status-dot idle-dot"></span>
          <span className="token-text">No Active Trip</span>
        </div>
      </section>
    );
  }

  return (
    <section className="token-badge-panel">
      <h2>Current Token</h2>
      <div className={`token-badge ${isActive ? 'active' : 'closed'}`}>
        <span className={`token-status-dot ${isActive ? 'active-dot' : 'closed-dot'}`}></span>
        <div className="token-info">
          <span className="token-id">{tokenId}</span>
          <span className="token-meta">
            {isActive ? '🔓 OPEN' : '🔒 CLOSED'}
            {tripNumber && ` · Trip #${tripNumber}`}
          </span>
        </div>
      </div>
    </section>
  );
}

export default TokenBadge;
