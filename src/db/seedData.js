// ─── No dummy / demo data ────────────────────────────────────────────────────
// The database starts completely empty so you add your real staff only.
// seedDatabaseIfEmpty is intentionally a no-op.

export const INITIAL_STAFF = [];

// Kept for compatibility – returns empty arrays
export function generateSeedData() {
  return { staff: [], attendance: [], ledger: [] };
}

// Database starts blank — real staff are added via the Staff Manager UI
export function seedDatabaseIfEmpty(_db) {
  return false;
}
