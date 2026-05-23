# VBOS Intelligence

IoT-based illegal mining transport monitoring using a MERN stack.

## Project Structure

- `backend/` - Node.js + Express API with Firebase Realtime Database integration and MongoDB Atlas storage
- `frontend/` - React dashboard with real-time GPS tracking and trip history

## Key Features

- Real-time ESP32 sensor integration through Firebase Realtime Database
- GPS tracking and vehicle marker on map
- Vehicle status, load weight, time, and device status display
- Geofencing-based trip counting from source to destination
- Token ID generation for each valid trip
- Overload detection when load exceeds 35 tons
- Trip history persisted to MongoDB Atlas
- Dashboard cards for total trips, active trips, violations, and overload alerts

## Setup

### 1. Backend

1. Open `backend/.env.example` and copy it to `backend/.env`.
2. Configure your MongoDB Atlas connection string.
3. Provide Firebase service account values and database URL.

```bash
cd backend
npm install
cp .env.example .env
```

4. Start backend server:

```bash
npm run dev
```

### 2. Frontend

```bash
cd ../frontend
npm install
npm run dev
```

Open the React dashboard in your browser at `http://localhost:3000`.

## Firebase Realtime Database

The backend listens to the configured Firebase path (default `/vehicles`) and processes each ESP32 update:

- `latitude`, `longitude`
- `weight` or `loadWeight`
- `vehicleNumber`
- `status` or `deviceStatus`
- `timestamp`

It uses source/destination geofences to start trips and store completed trip history in MongoDB.

## API Endpoints

- `GET /api/dashboard` - dashboard summary metrics
- `GET /api/trips` - recent trip history
- `GET /api/vehicle` - latest vehicle position/status

## Notes

- Update `FIREBASE_VEHICLE_PATH` if your ESP32 data is stored at a different Realtime Database node.
- The React frontend fetches backend data every 5 seconds for live updates.
