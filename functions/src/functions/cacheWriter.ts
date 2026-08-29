import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
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

const STALENESS_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Firestore document hard limit is 1 MB; reject blobs approaching it
const MAX_BLOB_BYTES = 900_000;

function assertBlobSize(companyFacts: Record<string, unknown>): void {
  const blobBytes = Buffer.byteLength(JSON.stringify(companyFacts), 'utf8');
  if (blobBytes > MAX_BLOB_BYTES) {
    throw new Error(`companyFacts blob too large for Firestore (${blobBytes} bytes)`);
  }
}

function isStale(lastUpdated: Timestamp | null): boolean {
  if (!lastUpdated) return true;
  const ageMs = Math.max(0, Date.now() - lastUpdated.toDate().getTime());
  return ageMs > STALENESS_DAYS * MS_PER_DAY;
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

  if (!snap.exists) {
    const companyFacts = await fetchFromSec('companyFacts', data.cik) as Record<string, unknown>;
    const latestFiledDate = extractLatestFiledDate(companyFacts);

    assertBlobSize(companyFacts);

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

  const docData = snap.data() ?? {};
  const storedLastUpdated = docData.lastUpdated instanceof Timestamp ? docData.lastUpdated : null;
  const storedLatestFiledDate = typeof docData.latestFiledDate === 'string' ? docData.latestFiledDate : null;

  if (!isStale(storedLastUpdated)) {
    return { ticker, latestFiledDate: storedLatestFiledDate, updated: false };
  }

  const companyFacts = await fetchFromSec('companyFacts', data.cik) as Record<string, unknown>;
  const newLatestFiledDate = extractLatestFiledDate(companyFacts);

  if (newLatestFiledDate !== null && newLatestFiledDate === storedLatestFiledDate) {
    await docRef.update({ lastUpdated: FieldValue.serverTimestamp() });
    return { ticker, latestFiledDate: storedLatestFiledDate, updated: false };
  }

  assertBlobSize(companyFacts);

  await docRef.set({
    ticker,
    cik: paddedCik,
    companyFacts,
    latestFiledDate: newLatestFiledDate,
    lastUpdated: FieldValue.serverTimestamp(),
    needsRefresh: false,
    accessCount: docData.accessCount ?? 0,
    version: 1,
  });

  return { ticker, latestFiledDate: newLatestFiledDate, updated: true };
}
