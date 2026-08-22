import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { fetchFromSec } from './secProxy.js';

function extractLatestFiledDate(companyFacts: Record<string, unknown>): string | null {
  const usGaap = (companyFacts as any)?.facts?.['us-gaap'];
  if (!usGaap) return null;
  let max: string | null = null;
  for (const tag of Object.values(usGaap) as any[]) {
    for (const entries of Object.values(tag.units ?? {}) as any[]) {
      for (const { filed } of entries) {
        if (filed && (max === null || filed > max)) max = filed;
      }
    }
  }
  return max;
}

const COLLECTION = 'edgarCache';

interface CacheWriterData {
  ticker: string;
  cik: number;
}

interface CacheWriterResult {
  ticker: string;
  latestFiledDate: string | null;
  updated: boolean;
}

export async function cacheWriterHandler(
  req: CallableRequest<CacheWriterData>
): Promise<CacheWriterResult> {
  const data = req.data;

  if (!data.ticker || typeof data.ticker !== 'string') {
    throw new Error('ticker is required');
  }
  if (!Number.isInteger(data.cik) || data.cik < 0) {
    throw new Error('cik must be a non-negative integer');
  }

  const ticker = data.ticker.trim().toUpperCase();
  const paddedCik = String(data.cik).padStart(10, '0');

  const db = getFirestore();
  const docRef = db.collection(COLLECTION).doc(ticker);
  const snap = await docRef.get();

  if (snap.exists) {
    return { ticker, latestFiledDate: null, updated: false };
  }

  const companyFacts = await fetchFromSec('companyFacts', data.cik) as Record<string, unknown>;
  const latestFiledDate = extractLatestFiledDate(companyFacts);

  await docRef.set({
    ticker,
    cik: paddedCik,
    companyFacts,
    latestFiledDate,
    lastUpdated: FieldValue.serverTimestamp(),
    needsRefresh: false,
    accessCount: 0,
    version: 1,
  });

  return { ticker, latestFiledDate, updated: true };
}
