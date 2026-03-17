import * as admin from 'firebase-admin';
import type { CachedDebate } from './types.js';

/** Default cache TTL in days */
const DEFAULT_TTL_DAYS = 90;

function getTtlDays(): number {
  const envVal = process.env.DEBATE_CACHE_TTL_DAYS;
  if (envVal !== undefined && envVal !== '') {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_TTL_DAYS;
}

function ttlMs(): number {
  return getTtlDays() * 24 * 60 * 60 * 1000;
}

function docPath(ticker: string): string {
  return `debates/${ticker.toUpperCase()}_v1`;
}

/**
 * Read a debate from Firestore. Returns null on cache miss.
 */
export async function readDebate(ticker: string): Promise<CachedDebate | null> {
  const db = admin.firestore();
  const snap = await db.doc(docPath(ticker)).get();
  if (!snap.exists) return null;
  return snap.data() as CachedDebate;
}

/**
 * Returns true if the debate is still within the configured TTL.
 */
export function isCacheValid(debate: CachedDebate): boolean {
  const generatedAt = new Date(debate.generatedAt).getTime();
  if (isNaN(generatedAt)) return false;
  return Date.now() - generatedAt < ttlMs();
}

/**
 * Write a new debate to Firestore.
 */
export async function writeDebate(debate: CachedDebate): Promise<void> {
  const db = admin.firestore();
  await db.doc(docPath(debate.ticker)).set(debate);
}

/**
 * Atomically increment viewCount and update lastViewedAt.
 */
export async function incrementViewCount(ticker: string): Promise<void> {
  const db = admin.firestore();
  await db.doc(docPath(ticker)).update({
    viewCount: admin.firestore.FieldValue.increment(1),
    lastViewedAt: new Date().toISOString(),
  });
}
