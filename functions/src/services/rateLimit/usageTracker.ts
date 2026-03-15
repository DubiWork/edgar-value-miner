import * as admin from 'firebase-admin';
import type { UsageRecord } from './types.js';

const BATCH_SIZE = 500;

function userDocPath(uid: string): string {
  return `users/${uid}`;
}

/**
 * Read usage record for a user. Returns null if the user document does not exist.
 * When the document exists but debateCount is missing, defaults to 0.
 */
export async function getUsageRecord(uid: string): Promise<UsageRecord | null> {
  const db = admin.firestore();
  const snap = await db.doc(userDocPath(uid)).get();
  if (!snap.exists) return null;

  const data = snap.data() as Record<string, unknown>;
  return {
    debateCount: typeof data['debateCount'] === 'number' ? data['debateCount'] : 0,
    debateCountResetAt:
      typeof data['debateCountResetAt'] === 'string' ? data['debateCountResetAt'] : null,
  };
}

/**
 * Atomically increment debateCount by 1 for a user.
 * Uses Firestore update (not set) to preserve all other user fields.
 */
export async function incrementDebateCount(uid: string): Promise<void> {
  const db = admin.firestore();
  await db.doc(userDocPath(uid)).update({
    debateCount: admin.firestore.FieldValue.increment(1),
  });
}

/**
 * Reset debateCount to 0 for the given list of user IDs.
 * Processes in sequential batches of up to BATCH_SIZE.
 */
export async function resetAllUsage(uids: string[]): Promise<void> {
  if (uids.length === 0) return;

  const db = admin.firestore();
  const resetAt = new Date().toISOString();

  // Slice into batches of BATCH_SIZE and process sequentially
  for (let i = 0; i < uids.length; i += BATCH_SIZE) {
    const batch = uids.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((uid) =>
        db.doc(userDocPath(uid)).update({
          debateCount: 0,
          debateCountResetAt: resetAt,
        })
      )
    );
  }
}
