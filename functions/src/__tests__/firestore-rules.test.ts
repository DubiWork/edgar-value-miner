/**
 * Firestore Security Rules — Emulator-Based Tests
 * Issue #145 — A2: Firestore Security Rules & Emulator-Based Rule Tests
 *
 * Requires the Firestore emulator running on port 8080.
 * Run with:
 *   firebase emulators:exec --only firestore "npm test --prefix functions"
 *
 * Coverage (~33 tests):
 *   - debates collection: authenticated read, unauthenticated read denied, client write denied
 *   - debates/feedback subcollection: owner CRUD, wrong-user denied, delete denied
 *   - users collection: owner read/write, wrong-user denied, unauthenticated denied
 *   - users/notes subcollection: owner CRUD, wrong-user denied, unauthenticated denied
 *   - users/watchlist subcollection: owner CRUD, wrong-user denied, unauthenticated denied
 *   - Default deny: unknown top-level collections
 *   - Admin SDK: bypasses rules for global write operations
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { describe, it, beforeAll, afterAll, afterEach } from "vitest";

// ── Constants ────────────────────────────────────────────────────────────────
const PROJECT_ID = "edgar-value-miner-test";
// Resolve relative to this file: functions/src/__tests__/ -> project root
const RULES_PATH = resolve(__dirname, "../../../../firestore.rules");

const ALICE_UID = "alice-uid-001";
const BOB_UID = "bob-uid-002";
const DEBATE_ID = "AAPL_v1";
const TICKER = "AAPL";

// ── Test Environment Setup ───────────────────────────────────────────────────
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(RULES_PATH, "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── Context Helpers ──────────────────────────────────────────────────────────
function aliceDb() {
  return testEnv.authenticatedContext(ALICE_UID).firestore();
}

function bobDb() {
  return testEnv.authenticatedContext(BOB_UID).firestore();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

// ── Seed Helpers (bypass rules) ──────────────────────────────────────────────
async function seedDebate() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "debates", DEBATE_ID), {
      ticker: TICKER,
      version: "v1",
      bullCase: "Strong revenue growth.",
      bearCase: "Valuation is stretched.",
      updatedAt: new Date().toISOString(),
    });
  });
}

async function seedUser(uid: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", uid), {
      uid,
      email: `${uid}@test.com`,
      createdAt: new Date().toISOString(),
    });
  });
}

async function seedSubDoc(
  [col, docId, subCol, subDocId]: [string, string, string, string],
  data: Record<string, unknown>
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), col, docId, subCol, subDocId),
      data
    );
  });
}

// ── 1. debates/{debateId} ────────────────────────────────────────────────────
describe("debates collection", () => {
  it("authenticated user can read a debate", async () => {
    await seedDebate();
    await assertSucceeds(getDoc(doc(aliceDb(), "debates", DEBATE_ID)));
  });

  it("unauthenticated user cannot read a debate", async () => {
    await seedDebate();
    await assertFails(getDoc(doc(unauthDb(), "debates", DEBATE_ID)));
  });

  it("authenticated user cannot create a debate (client write denied)", async () => {
    await assertFails(
      setDoc(doc(aliceDb(), "debates", "NEW_v1"), {
        ticker: "NEW",
        bullCase: "test",
        bearCase: "test",
      })
    );
  });

  it("authenticated user cannot update an existing debate", async () => {
    await seedDebate();
    await assertFails(
      updateDoc(doc(aliceDb(), "debates", DEBATE_ID), { bullCase: "hacked" })
    );
  });

  it("authenticated user cannot delete a debate", async () => {
    await seedDebate();
    await assertFails(deleteDoc(doc(aliceDb(), "debates", DEBATE_ID)));
  });

  it("admin SDK (withSecurityRulesDisabled) can write a debate — CF path", async () => {
    // Verifies the Cloud Functions admin SDK bypass works as expected
    await assertSucceeds(
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "debates", "TSLA_v1"), {
          ticker: "TSLA",
          updatedAt: new Date().toISOString(),
        });
      })
    );
  });
});

// ── 2. debates/{debateId}/feedback/{uid} ────────────────────────────────────
describe("debates feedback subcollection", () => {
  it("owner can create their own feedback", async () => {
    await seedDebate();
    await assertSucceeds(
      setDoc(doc(aliceDb(), "debates", DEBATE_ID, "feedback", ALICE_UID), {
        rating: 5,
        comment: "Great debate",
      })
    );
  });

  it("owner can read their own feedback", async () => {
    await seedDebate();
    await seedSubDoc(
      ["debates", DEBATE_ID, "feedback", ALICE_UID],
      { rating: 4 }
    );
    await assertSucceeds(
      getDoc(doc(aliceDb(), "debates", DEBATE_ID, "feedback", ALICE_UID))
    );
  });

  it("owner can update their own feedback", async () => {
    await seedDebate();
    await seedSubDoc(
      ["debates", DEBATE_ID, "feedback", ALICE_UID],
      { rating: 4 }
    );
    await assertSucceeds(
      updateDoc(
        doc(aliceDb(), "debates", DEBATE_ID, "feedback", ALICE_UID),
        { rating: 5 }
      )
    );
  });

  it("owner cannot delete their feedback (delete denied by rule)", async () => {
    await seedDebate();
    await seedSubDoc(
      ["debates", DEBATE_ID, "feedback", ALICE_UID],
      { rating: 4 }
    );
    await assertFails(
      deleteDoc(doc(aliceDb(), "debates", DEBATE_ID, "feedback", ALICE_UID))
    );
  });

  it("wrong user cannot read another user feedback", async () => {
    await seedDebate();
    await seedSubDoc(
      ["debates", DEBATE_ID, "feedback", ALICE_UID],
      { rating: 4 }
    );
    await assertFails(
      getDoc(doc(bobDb(), "debates", DEBATE_ID, "feedback", ALICE_UID))
    );
  });

  it("wrong user cannot write to another user feedback path", async () => {
    await seedDebate();
    await assertFails(
      setDoc(doc(bobDb(), "debates", DEBATE_ID, "feedback", ALICE_UID), {
        rating: 1,
      })
    );
  });

  it("unauthenticated user cannot write feedback", async () => {
    await seedDebate();
    await assertFails(
      setDoc(doc(unauthDb(), "debates", DEBATE_ID, "feedback", ALICE_UID), {
        rating: 1,
      })
    );
  });
});

// ── 3. users/{uid} ───────────────────────────────────────────────────────────
describe("users collection", () => {
  it("owner can read their own user document", async () => {
    await seedUser(ALICE_UID);
    await assertSucceeds(getDoc(doc(aliceDb(), "users", ALICE_UID)));
  });

  it("owner can write their own user document", async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), "users", ALICE_UID), {
        uid: ALICE_UID,
        email: "alice@test.com",
      })
    );
  });

  it("wrong user cannot read another user document", async () => {
    await seedUser(ALICE_UID);
    await assertFails(getDoc(doc(bobDb(), "users", ALICE_UID)));
  });

  it("wrong user cannot write to another user document", async () => {
    await assertFails(
      setDoc(doc(bobDb(), "users", ALICE_UID), {
        uid: ALICE_UID,
        email: "hacked@test.com",
      })
    );
  });

  it("unauthenticated user cannot read any user document", async () => {
    await seedUser(ALICE_UID);
    await assertFails(getDoc(doc(unauthDb(), "users", ALICE_UID)));
  });

  it("unauthenticated user cannot write any user document", async () => {
    await assertFails(
      setDoc(doc(unauthDb(), "users", ALICE_UID), { email: "hack@test.com" })
    );
  });
});

// ── 4. users/{uid}/notes/{ticker} ────────────────────────────────────────────
describe("users notes subcollection", () => {
  it("owner can create a note", async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), "users", ALICE_UID, "notes", TICKER), {
        content: "Strong moat, good FCF.",
        updatedAt: new Date().toISOString(),
      })
    );
  });

  it("owner can read their own note", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "notes", TICKER],
      { content: "test" }
    );
    await assertSucceeds(
      getDoc(doc(aliceDb(), "users", ALICE_UID, "notes", TICKER))
    );
  });

  it("owner can update their own note", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "notes", TICKER],
      { content: "original" }
    );
    await assertSucceeds(
      updateDoc(doc(aliceDb(), "users", ALICE_UID, "notes", TICKER), {
        content: "updated",
      })
    );
  });

  it("owner can delete their own note", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "notes", TICKER],
      { content: "to delete" }
    );
    await assertSucceeds(
      deleteDoc(doc(aliceDb(), "users", ALICE_UID, "notes", TICKER))
    );
  });

  it("wrong user cannot read another user note", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "notes", TICKER],
      { content: "secret" }
    );
    await assertFails(
      getDoc(doc(bobDb(), "users", ALICE_UID, "notes", TICKER))
    );
  });

  it("wrong user cannot write to another user note", async () => {
    await assertFails(
      setDoc(doc(bobDb(), "users", ALICE_UID, "notes", TICKER), {
        content: "injected note",
      })
    );
  });

  it("unauthenticated user cannot read notes", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "notes", TICKER],
      { content: "secret" }
    );
    await assertFails(
      getDoc(doc(unauthDb(), "users", ALICE_UID, "notes", TICKER))
    );
  });

  it("unauthenticated user cannot write notes", async () => {
    await assertFails(
      setDoc(doc(unauthDb(), "users", ALICE_UID, "notes", TICKER), {
        content: "hack",
      })
    );
  });
});

// ── 5. users/{uid}/watchlist/{ticker} ────────────────────────────────────────
describe("users watchlist subcollection", () => {
  it("owner can add a watchlist entry", async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), "users", ALICE_UID, "watchlist", TICKER), {
        ticker: TICKER,
        addedAt: new Date().toISOString(),
      })
    );
  });

  it("owner can read their own watchlist entry", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "watchlist", TICKER],
      { ticker: TICKER }
    );
    await assertSucceeds(
      getDoc(doc(aliceDb(), "users", ALICE_UID, "watchlist", TICKER))
    );
  });

  it("owner can update their own watchlist entry", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "watchlist", TICKER],
      { ticker: TICKER, notes: "" }
    );
    await assertSucceeds(
      updateDoc(doc(aliceDb(), "users", ALICE_UID, "watchlist", TICKER), {
        notes: "watching closely",
      })
    );
  });

  it("owner can remove a watchlist entry", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "watchlist", TICKER],
      { ticker: TICKER }
    );
    await assertSucceeds(
      deleteDoc(doc(aliceDb(), "users", ALICE_UID, "watchlist", TICKER))
    );
  });

  it("wrong user cannot read another user watchlist", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "watchlist", TICKER],
      { ticker: TICKER }
    );
    await assertFails(
      getDoc(doc(bobDb(), "users", ALICE_UID, "watchlist", TICKER))
    );
  });

  it("wrong user cannot write to another user watchlist", async () => {
    await assertFails(
      setDoc(doc(bobDb(), "users", ALICE_UID, "watchlist", TICKER), {
        ticker: TICKER,
      })
    );
  });

  it("unauthenticated user cannot read watchlist", async () => {
    await seedSubDoc(
      ["users", ALICE_UID, "watchlist", TICKER],
      { ticker: TICKER }
    );
    await assertFails(
      getDoc(doc(unauthDb(), "users", ALICE_UID, "watchlist", TICKER))
    );
  });

  it("unauthenticated user cannot write watchlist", async () => {
    await assertFails(
      setDoc(doc(unauthDb(), "users", ALICE_UID, "watchlist", TICKER), {
        ticker: TICKER,
      })
    );
  });
});

// ── 6. Default deny: unknown top-level collections ───────────────────────────
describe("default deny: unknown collections", () => {
  it("authenticated user cannot read from an unknown collection", async () => {
    await assertFails(getDoc(doc(aliceDb(), "admin_data", "secret")));
  });

  it("authenticated user cannot write to an unknown collection", async () => {
    await assertFails(
      setDoc(doc(aliceDb(), "admin_data", "secret"), { value: "hacked" })
    );
  });

  it("unauthenticated user cannot read from an unknown collection", async () => {
    await assertFails(getDoc(doc(unauthDb(), "admin_data", "secret")));
  });

  it("unauthenticated user cannot write to an unknown collection", async () => {
    await assertFails(
      setDoc(doc(unauthDb(), "admin_data", "secret"), { value: "hacked" })
    );
  });
});
