function DashboardCards({ data }) {
  return (
    <section className="cards-grid">
      <article className="card card-primary">
        <h3>Total Trips</h3>
        <p>{data.totalTrips}</p>
      </article>
      <article className="card card-secondary">
        <h3>Active Trips</h3>
        <p>{data.activeTrips}</p>
      </article>
      <article className="card card-warning">
        <h3>Violations</h3>
        <p>{data.violations}</p>
      </article>
      <article className="card card-danger">
        <h3>Overload Alerts</h3>
        <p>{data.overloadAlerts}</p>
      </article>
    </section>
  );
}

export default DashboardCards;
