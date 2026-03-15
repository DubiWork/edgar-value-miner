import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { resetAllUsage } from '../services/rateLimit/usageTracker.js';

const BATCH_SIZE = 500;

/**
 * Core handler logic for monthly usage reset.
 * Exported separately for testability.
 */
export async function monthlyUsageResetHandler(): Promise<void> {
  const db = admin.firestore();
  const snapshot = await db.collection('users').get();

  if (snapshot.empty) {
    await resetAllUsage([]);
    return;
  }

  const allUids = snapshot.docs.map((doc) => doc.id);

  for (let i = 0; i < allUids.length; i += BATCH_SIZE) {
    const batch = allUids.slice(i, i + BATCH_SIZE);
    try {
      await resetAllUsage(batch);
    } catch (err) {
      // Log but continue — don't let one batch failure abort the entire reset
      functions.logger.error('monthlyUsageReset: batch failed', {
        batchStart: i,
        batchSize: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Scheduled Cloud Function: resets all users' debateCount to 0 on the 1st of each month.
 * Schedule: "0 0 1 * *" — midnight UTC on the 1st of every month.
 */
export const monthlyUsageReset = functions.scheduler.onSchedule(
  '0 0 1 * *',
  async (_event) => {
    await monthlyUsageResetHandler();
  }
);
