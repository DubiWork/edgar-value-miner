import * as admin from 'firebase-admin';

/** Default daily budget caps in USD */
const DEFAULT_DAILY_BUDGET = 10;

export interface UsageEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export class CostTracker {
  /** In-memory accumulator for today's spend (resets when the process restarts / new day) */
  private dailyUsage = 0;

  private get dailyBudget(): number {
    const envVal = process.env.LLM_DAILY_BUDGET;
    if (envVal !== undefined && envVal !== '') {
      const parsed = parseFloat(envVal);
      if (!isNaN(parsed)) return parsed;
    }
    return DEFAULT_DAILY_BUDGET;
  }

  /** Test helper — allows tests to seed the in-memory usage without making real calls. */
  _setDailyUsageForTest(value: number): void {
    this.dailyUsage = value;
  }

  /**
   * Check whether the estimated cost of the upcoming request fits within the daily budget.
   * Throws if the cap would be exceeded.
   */
  async checkBudget(estimatedCost: number): Promise<void> {
    const projected = this.dailyUsage + estimatedCost;
    if (projected > this.dailyBudget) {
      throw new Error(
        `LLM daily budget cap reached: $${this.dailyUsage.toFixed(4)} spent today, ` +
          `budget is $${this.dailyBudget}. Estimated request cost: $${estimatedCost.toFixed(4)}.`
      );
    }
  }

  /**
   * Log a completed request's usage to Firestore and accumulate daily spend.
   */
  async logUsage(entry: UsageEntry): Promise<void> {
    this.dailyUsage += entry.estimatedCost;

    const db = admin.firestore();
    const docId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await db.collection('llm_usage').doc(docId).set({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }
}
