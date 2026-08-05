const express = require('express');
const { getTrips, getTripsByDate, getTokenHistory, getDailySummary } = require('../controllers/tripController');

const router = express.Router();

router.get('/', getTrips);
router.get('/history', getTripsByDate);
router.get('/tokens', getTokenHistory);
router.get('/daily-summary', getDailySummary);

module.exports = router;
