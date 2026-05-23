const express = require('express');
const { getTrips } = require('../controllers/tripController');

const router = express.Router();

router.get('/', getTrips);

module.exports = router;
