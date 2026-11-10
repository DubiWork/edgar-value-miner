import { getApps } from 'firebase-admin/app';
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest, CallableOptions } from 'firebase-functions/v2/https';

export const GENERATE_AI_SUMMARY_OPTIONS: CallableOptions = {
  memory: '256MiB',
  timeoutSeconds: 60,
};

export const DEFAULT_VERTEX_MODEL = 'gemini-3.8-flash';
export const DEFAULT_PROJECT_ID = 'edgar-value-miner';
export const DEFAULT_LOCATION = 'global';
export const DEFAULT_API_ENDPOINT = 'aiplatform.googleapis.com';
export const DEFAULT_MONTHLY_BUDGET_USD = 5.0;

// Gemini Flash pricing estimate ($0.15 / 1M input tokens, $0.60 / 1M output tokens)
const COST_PER_INPUT_TOKEN = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.60 / 1_000_000;

const BUDGET_COLLECTION = 'systemConfig';
const BUDGET_DOC_ID = 'aiBudget';

export interface AiBudgetStatus {
  periodKey: string;
  status: 'active' | 'exhausted';
  spentUsd: number;
  monthlyLimitUsd: number;
  totalCalls: number;
  totalTokens: number;
  resetsAt: string;
  daysUntilReset: number;
  exhaustedReason: 'budget_limit' | 'vertex_quota' | null;
}

export interface GenerateAiSummaryData {
  prompt?: string;
  action?: 'getBudgetStatus';
}

export interface GenerateAiSummaryResult {
  text: string;
  budget?: AiBudgetStatus;
}

interface StoredBudgetRecord {
  periodKey: string;
  spentUsd: number;
  totalCalls: number;
  totalTokens: number;
  quotaExhausted: boolean;
  exhaustedReason: 'budget_limit' | 'vertex_quota' | null;
}

let inMemoryBudgetFallback: StoredBudgetRecord | null = null;

export function resetInMemoryBudgetForTesting(): void {
  inMemoryBudgetFallback = null;
}

export function getPeriodAndRenewalInfo(now = new Date()): {
  periodKey: string;
  resetsAt: string;
  daysUntilReset: number;
} {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-11
  const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const nextMonthDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const resetsAt = nextMonthDate.toISOString();
  const msRemaining = Math.max(0, nextMonthDate.getTime() - now.getTime());
  const daysUntilReset = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return { periodKey, resetsAt, daysUntilReset };
}

function getMonthlyLimitUsd(): number {
  const envVal = Number(process.env.AI_MONTHLY_BUDGET_USD);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : DEFAULT_MONTHLY_BUDGET_USD;
}

async function loadBudgetRecord(periodKey: string): Promise<StoredBudgetRecord> {
  const freshRecord: StoredBudgetRecord = {
    periodKey,
    spentUsd: 0,
    totalCalls: 0,
    totalTokens: 0,
    quotaExhausted: false,
    exhaustedReason: null,
  };

  if (getApps().length === 0) {
    if (inMemoryBudgetFallback && inMemoryBudgetFallback.periodKey === periodKey) {
      return { ...inMemoryBudgetFallback };
    }
    inMemoryBudgetFallback = { ...freshRecord };
    return { ...freshRecord };
  }

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const snap = await db.collection(BUDGET_COLLECTION).doc(BUDGET_DOC_ID).get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (data.periodKey === periodKey) {
        return {
          periodKey,
          spentUsd: typeof data.spentUsd === 'number' ? data.spentUsd : 0,
          totalCalls: typeof data.totalCalls === 'number' ? data.totalCalls : 0,
          totalTokens: typeof data.totalTokens === 'number' ? data.totalTokens : 0,
          quotaExhausted: Boolean(data.quotaExhausted),
          exhaustedReason: data.exhaustedReason || null,
        };
      }
    }
    return freshRecord;
  } catch {
    if (inMemoryBudgetFallback && inMemoryBudgetFallback.periodKey === periodKey) {
      return { ...inMemoryBudgetFallback };
    }
    inMemoryBudgetFallback = { ...freshRecord };
    return { ...freshRecord };
  }
}

async function saveBudgetRecord(record: StoredBudgetRecord): Promise<void> {
  inMemoryBudgetFallback = { ...record };
  if (getApps().length === 0) return;

  try {
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const db = getFirestore();
    await db
      .collection(BUDGET_COLLECTION)
      .doc(BUDGET_DOC_ID)
      .set(
        {
          ...record,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch {
    // Fallback to in-memory record when Firestore is unavailable in unit tests
  }
}

function toBudgetStatus(record: StoredBudgetRecord): AiBudgetStatus {
  const { resetsAt, daysUntilReset } = getPeriodAndRenewalInfo();
  const monthlyLimitUsd = getMonthlyLimitUsd();
  const isOverLimit = record.spentUsd >= monthlyLimitUsd;
  const isExhausted = isOverLimit || record.quotaExhausted;

  return {
    periodKey: record.periodKey,
    status: isExhausted ? 'exhausted' : 'active',
    spentUsd: Number(record.spentUsd.toFixed(4)),
    monthlyLimitUsd,
    totalCalls: record.totalCalls,
    totalTokens: record.totalTokens,
    resetsAt,
    daysUntilReset,
    exhaustedReason: isExhausted
      ? record.exhaustedReason || (isOverLimit ? 'budget_limit' : 'vertex_quota')
      : null,
  };
}

/**
 * Callable Cloud Function handler that:
 * 1. Tracks monthly Vertex AI token usage and cost in Firestore (`systemConfig/aiBudget`).
 * 2. Automatically blocks outgoing calls when the monthly budget or Vertex quota is exhausted,
 *    reporting the exact renewal date (`resetsAt`).
 * 3. Supports `{ action: 'getBudgetStatus' }` for Admin budget monitoring.
 */
export async function generateAiSummaryHandler(
  req: CallableRequest<GenerateAiSummaryData>
): Promise<GenerateAiSummaryResult> {
  const data = req.data;

  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Request data is required');
  }

  if (
    data.action !== 'getBudgetStatus' &&
    (!data.prompt || typeof data.prompt !== 'string' || !data.prompt.trim())
  ) {
    throw new HttpsError('invalid-argument', 'prompt is required and must be a non-empty string');
  }

  const { periodKey } = getPeriodAndRenewalInfo();
  const currentRecord = await loadBudgetRecord(periodKey);
  const currentStatus = toBudgetStatus(currentRecord);

  // Admin status inquiry
  if (data.action === 'getBudgetStatus') {
    return {
      text: '',
      budget: currentStatus,
    };
  }

  // Automatic Outgoing Call Circuit Breaker when budget is exhausted
  if (currentStatus.status === 'exhausted') {
    const resetDateFormatted = currentStatus.resetsAt.slice(0, 10);
    throw new HttpsError(
      'resource-exhausted',
      `AI_BUDGET_EXHAUSTED: תקציב ה-AI החודשי תם ($${currentStatus.spentUsd.toFixed(2)}/$${currentStatus.monthlyLimitUsd.toFixed(2)}). קריאות חדשות נעצרו אוטומטית עד לחידוש התקציב ב-${resetDateFormatted} (בעוד ${currentStatus.daysUntilReset} ימים).`
    );
  }

  const prompt = data.prompt.trim();
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    DEFAULT_PROJECT_ID;
  const location =
    process.env.VERTEX_AI_LOCATION ||
    DEFAULT_LOCATION;
  const model = process.env.VERTEX_AI_MODEL || DEFAULT_VERTEX_MODEL;

  try {
    // Lazy-load @google-cloud/vertexai inside the handler to prevent Firebase CLI
    // 10-second discovery timeout during cold module analysis on deploy.
    const { VertexAI } = await import('@google-cloud/vertexai');
    const vertexAI = new VertexAI({
      project,
      location,
      ...(location === 'global' ? { apiEndpoint: DEFAULT_API_ENDPOINT } : {}),
    });
    const generativeModel = vertexAI.getGenerativeModel({ model });

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const generatedText =
      result.response?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() ?? '';

    if (!generatedText) {
      throw new HttpsError('internal', 'Empty response from Vertex AI Gemini model');
    }

    // Extract token usage metadata (fallback to character-based estimate if omitted)
    const usage = (result.response as any)?.usageMetadata;
    const promptTokens =
      typeof usage?.promptTokenCount === 'number'
        ? usage.promptTokenCount
        : Math.ceil(prompt.length / 4);
    const outputTokens =
      typeof usage?.candidatesTokenCount === 'number'
        ? usage.candidatesTokenCount
        : Math.ceil(generatedText.length / 4);
    const totalTokens =
      typeof usage?.totalTokenCount === 'number'
        ? usage.totalTokenCount
        : promptTokens + outputTokens;

    const callCostUsd =
      promptTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;

    const updatedSpend = currentRecord.spentUsd + callCostUsd;
    const monthlyLimitUsd = getMonthlyLimitUsd();
    const hitLimit = updatedSpend >= monthlyLimitUsd;

    await saveBudgetRecord({
      periodKey,
      spentUsd: updatedSpend,
      totalCalls: currentRecord.totalCalls + 1,
      totalTokens: currentRecord.totalTokens + totalTokens,
      quotaExhausted: hitLimit,
      exhaustedReason: hitLimit ? 'budget_limit' : null,
    });

    return { text: generatedText };
  } catch (err) {
    if (err instanceof HttpsError) {
      throw err;
    }
    const message = (err as Error)?.message || 'Failed to generate AI summary via Vertex AI';

    // If Vertex AI itself reports 429 / Quota Exhausted, trip the circuit breaker automatically
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
      await saveBudgetRecord({
        ...currentRecord,
        quotaExhausted: true,
        exhaustedReason: 'vertex_quota',
      });
      const { resetsAt, daysUntilReset } = getPeriodAndRenewalInfo();
      throw new HttpsError(
        'resource-exhausted',
        `AI_BUDGET_EXHAUSTED: מכסת Vertex AI הסתיימה. קריאות חדשות נעצרו אוטומטית עד לחידוש ב-${resetsAt.slice(0, 10)} (בעוד ${daysUntilReset} ימים).`
      );
    }

    throw new HttpsError('internal', message);
  }
}
