function DashboardCards({ data }) {
  return (
    <section className="cards-grid">
      <article className="card card-primary">
        <h3>Trips Today</h3>
        <p>{data.tripCountToday ?? data.totalTrips ?? 0}</p>
      </article>
      <article className="card card-secondary">
        <h3>Remaining Trips</h3>
        <p>{data.activeTrips ?? 0}</p>
      </article>
      <article className="card card-warning">
        <h3>Violations</h3>
        <p>{data.violations ?? 0}</p>
      </article>
      <article className="card card-danger">
        <h3>Overload Alerts</h3>
        <p>{data.overloadAlerts ?? 0}</p>
      </article>
      <article className="card card-info">
        <h3>Daily Limit</h3>
        <p>{data.dailyLimit ?? '—'}</p>
        <span className="card-sub">
          {data.routeDistanceKm != null
            ? `${data.routeDistanceKm.toFixed(2)} km route`
            : ''}
        </span>
      </article>
    </section>
  );
}

export default DashboardCards;
