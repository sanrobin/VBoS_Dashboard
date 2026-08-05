import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000
});

export const fetchDashboard = () => api.get('/dashboard').then((res) => res.data);
export const fetchTrips = () => api.get('/trips').then((res) => res.data);
export const fetchVehicle = () => api.get('/vehicle').then((res) => res.data);
export const fetchTripsByDate = (date) => api.get(`/trips/history?date=${date}`).then((res) => res.data);
export const fetchTokenHistory = (page = 1) => api.get(`/trips/tokens?page=${page}&limit=20`).then((res) => res.data);
export const fetchDailySummary = (date) => api.get(`/trips/daily-summary${date ? `?date=${date}` : ''}`).then((res) => res.data);
