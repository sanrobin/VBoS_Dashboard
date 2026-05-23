import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000
});

export const fetchDashboard = () => api.get('/dashboard').then((res) => res.data);
export const fetchTrips = () => api.get('/trips').then((res) => res.data);
export const fetchVehicle = () => axios.get('http://localhost:5000/api/vehicle').then((res) => res.data);
