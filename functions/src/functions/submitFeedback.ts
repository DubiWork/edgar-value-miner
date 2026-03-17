import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// =============================================================================
// Constants
// =============================================================================

const VALID_SECTIONS = ['bullCase', 'bearCase', 'synthesis'] as const;
const VALID_RATINGS = ['up', 'down'] as const;

type Section = (typeof VALID_SECTIONS)[number];
type Rating = (typeof VALID_RATINGS)[number];

// =============================================================================
// Request validation
// =============================================================================

interface SubmitFeedbackRequest {
  debateId: string;
  section: Section;
  rating: Rating;
}

interface CallableRequestLike {
  data: unknown;
  auth?: { uid: string } | undefined;
}

function parseRequest(data: unknown): SubmitFeedbackRequest {
  if (typeof data !== 'object' || data === null) {
    throw new functions.https.HttpsError('invalid-argument', 'Request data must be an object.');
  }

  const req = data as Record<string, unknown>;

  if (typeof req['debateId'] !== 'string' || req['debateId'].trim() === '') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required parameter: debateId (string).'
    );
  }

  if (!/^[A-Za-z0-9_-]+$/.test((req['debateId'] as string).trim())) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid debateId format. Only alphanumeric characters, underscores, and hyphens are allowed.'
    );
  }

  const section = req['section'];
  if (!VALID_SECTIONS.includes(section as Section)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid section: "${section}". Must be one of: ${VALID_SECTIONS.join(', ')}.`
    );
  }

  const rating = req['rating'];
  if (!VALID_RATINGS.includes(rating as Rating)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid rating: "${rating}". Must be one of: ${VALID_RATINGS.join(', ')}.`
    );
  }

  return {
    debateId: (req['debateId'] as string).trim(),
    section: section as Section,
    rating: rating as Rating,
  };
}

// =============================================================================
// Handler
// =============================================================================

export const submitFeedbackHandler = async (
  request: CallableRequestLike
): Promise<{ success: boolean }> => {
  // Authentication required
  if (!request.auth?.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to submit feedback.'
    );
  }

  const { debateId, section, rating } = parseRequest(request.data);
  const uid = request.auth.uid;

  const db = getFirestore();

  // Paths
  const feedbackDocRef = db.doc(`debates/${debateId}/feedback/${uid}`);
  const debateDocRef = db.doc(`debates/${debateId}`);

  await db.runTransaction(async (transaction) => {
    const feedbackSnap = await transaction.get(feedbackDocRef);

    const timestamp = FieldValue.serverTimestamp();

    if (feedbackSnap.exists) {
      // Upsert: user already rated — update their feedback
      const prevData = feedbackSnap.data() as { section: Section; rating: Rating } | undefined;
      const prevRating = prevData?.rating;
      const prevSection = prevData?.section;

      transaction.update(feedbackDocRef, { section, rating, timestamp });

      // Adjust aggregate: decrement old, increment new (only if changed)
      if (prevSection && prevRating) {
        if (prevSection !== section || prevRating !== rating) {
          // Decrement old
          transaction.update(debateDocRef, {
            [`feedbackSummary.${prevSection}.${prevRating}`]: FieldValue.increment(-1),
            [`feedbackSummary.${section}.${rating}`]: FieldValue.increment(1),
          });
        }
      } else {
        // Previous data incomplete — just increment new
        transaction.update(debateDocRef, {
          [`feedbackSummary.${section}.${rating}`]: FieldValue.increment(1),
        });
      }
    } else {
      // New feedback: set the feedback doc and increment aggregate
      transaction.set(feedbackDocRef, { section, rating, uid, timestamp });
      transaction.update(debateDocRef, {
        [`feedbackSummary.${section}.${rating}`]: FieldValue.increment(1),
      });
    }
  });

  return { success: true };
};
