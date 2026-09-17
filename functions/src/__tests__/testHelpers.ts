import type { vi } from 'vitest';

export interface MockFirestoreFns {
  mockGet: ReturnType<typeof vi.fn>;
  mockSet: ReturnType<typeof vi.fn>;
  mockUpdate: ReturnType<typeof vi.fn>;
  mockDocFn: ReturnType<typeof vi.fn>;
  mockCollectionFn: ReturnType<typeof vi.fn>;
}

/**
 * Creates and wires a mock Firestore document reference with get, set, and update mocks.
 */
export function setupDocRefMock(
  mocks: MockFirestoreFns,
  exists: boolean,
  data: Record<string, unknown> = {}
) {
  const docRef = {
    get: mocks.mockGet,
    set: mocks.mockSet,
    update: mocks.mockUpdate,
  };
  mocks.mockGet.mockResolvedValue({ exists, data: () => data });
  mocks.mockSet.mockResolvedValue(undefined);
  mocks.mockUpdate.mockResolvedValue(undefined);
  mocks.mockDocFn.mockReturnValue(docRef);
  mocks.mockCollectionFn.mockReturnValue({ doc: mocks.mockDocFn });
  return docRef;
}
