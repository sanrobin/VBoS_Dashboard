const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { startFirebaseListener, getLatestVehicle, getActiveTripCount } = require('./services/realtimeService');
const tripRoutes = require('./routes/tripRoutes');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

connectDB();
startFirebaseListener();

app.use('/api/trips', tripRoutes);

app.get('/api/vehicle', async (req, res) => {
  try {
    const vehicle = getLatestVehicle();
    return res.json(vehicle || {});
  } catch (error) {
    return res.status(500).json({ message: 'Unable to read vehicle data', error: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  const { getDashboardMetrics } = require('./controllers/tripController');
  try {
    const metrics = await getDashboardMetrics();
    return res.json(metrics);
  } catch (error) {
    return res.status(500).json({ message: 'Dashboard error', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('VBOS Intelligence backend is running');
});

app.listen(PORT, () => {
  console.log(`VBOS Intelligence backend listening on port ${PORT}`);
});
