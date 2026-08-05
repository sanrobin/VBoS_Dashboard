function LoadGauge({ vehicle }) {
  const readings = vehicle.loadReadings || [];
  const count = readings.length;
  const maxReadings = 10;
  const progress = Math.min(count / maxReadings, 1) * 100;
  const currentLoad = readings.length > 0 ? readings[readings.length - 1] : (vehicle.loadWeight || 0);
  const finalLoad = vehicle.finalLoad;
  const isConfirmed = finalLoad != null;
  const isOverloaded = vehicle.overload;

  return (
    <section className="load-gauge-panel">
      <h2>Load Calculation</h2>
      <div className="load-gauge-body">
        <div className="load-value-row">
          <span className="load-label">Current Load</span>
          <span className={`load-value ${isOverloaded ? 'overloaded' : ''}`}>
            {currentLoad.toFixed(2)} <small>tons</small>
          </span>
        </div>

        <div className="load-progress-wrapper">
          <div className="load-progress-label">
            <span>Reading {count}/{maxReadings}</span>
            {isConfirmed && <span className="confirmed-badge">✓ CONFIRMED</span>}
          </div>
          <div className="load-progress-bar">
            <div
              className={`load-progress-fill ${isConfirmed ? 'confirmed' : ''} ${isOverloaded ? 'overloaded' : ''}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {isConfirmed && (
          <div className="load-final-row">
            <span className="load-label">Final Load (10th reading)</span>
            <span className={`load-value final ${isOverloaded ? 'overloaded' : ''}`}>
              {finalLoad.toFixed(2)} <small>tons</small>
            </span>
          </div>
        )}

        {isOverloaded && (
          <div className="load-alert">
            ⚠ OVERLOAD DETECTED — Exceeds 35 tons threshold
          </div>
        )}
      </div>
    </section>
  );
}

export default LoadGauge;
