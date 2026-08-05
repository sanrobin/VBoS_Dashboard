const Trip = require('../models/Trip');
const DailyTripCount = require('../models/DailyTripCount');
const TokenChain = require('../models/TokenChain');

const RETENTION_DAYS = {
  trips: 90,
  dailyCounts: 30,
  tokenChain: 180
};

const runCleanup = async () => {
  const now = new Date();
  const results = {};

  try {
    // Delete trip records older than 90 days
    const tripCutoff = new Date(now.getTime() - RETENTION_DAYS.trips * 24 * 60 * 60 * 1000);
    const tripResult = await Trip.deleteMany({ createdAt: { $lt: tripCutoff } });
    results.tripsDeleted = tripResult.deletedCount;

    // Delete daily count records older than 30 days
    const countCutoff = new Date(now.getTime() - RETENTION_DAYS.dailyCounts * 24 * 60 * 60 * 1000);
    const countResult = await DailyTripCount.deleteMany({ createdAt: { $lt: countCutoff } });
    results.dailyCountsDeleted = countResult.deletedCount;

    // Delete token chain entries older than 180 days
    const tokenCutoff = new Date(now.getTime() - RETENTION_DAYS.tokenChain * 24 * 60 * 60 * 1000);
    const tokenResult = await TokenChain.deleteMany({ createdAt: { $lt: tokenCutoff } });
    results.tokenChainDeleted = tokenResult.deletedCount;

    console.log(`[Cleanup] Trips: ${results.tripsDeleted}, DailyCounts: ${results.dailyCountsDeleted}, TokenChain: ${results.tokenChainDeleted}`);
  } catch (err) {
    console.error('[Cleanup] Error:', err.message);
  }

  return results;
};

// Compute ms until next midnight IST (00:00 +05:30)
const msUntilMidnightIST = () => {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const nextMidnight = new Date(istNow);
  nextMidnight.setUTCHours(0, 0, 0, 0);
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  return nextMidnight.getTime() - istNow.getTime();
};

const startCleanupScheduler = () => {
  // Run once at startup
  runCleanup();

  // Schedule daily at midnight IST
  const scheduleNext = () => {
    const ms = msUntilMidnightIST();
    console.log(`[Cleanup] Next run in ${Math.round(ms / 60000)} minutes`);
    setTimeout(async () => {
      await runCleanup();
      // Re-schedule for the next midnight
      scheduleNext();
    }, ms);
  };

  scheduleNext();
};

module.exports = { startCleanupScheduler, runCleanup };
