// Two ceilings, because one number cannot do both jobs.
//
// Deletes in this schema are soft. A count filtered on `deletedAt: null`
// answers "how many rows may the user's sheet show" — a display ceiling — and
// it is right that archiving or deleting frees a slot, or tidying up would
// lock a list for good. It says nothing about how large the table may grow,
// and every cap here was written as though it did: create, delete, repeat ran
// forever behind a number that never moved. Three HIGH findings in the October
// 2026 audit were that single mistake, and the first round of fixes repeated
// it in the code meant to end it.
//
// So a capped model carries both: the live ceiling the user meets, and a
// stored ceiling counting tombstones too, set far enough above that only a
// loop reaches it. A person's deleted rows do not run to ten times their live
// ones; a script's do within minutes.
export const STORED_CEILING_MULTIPLE = 10;

export const storedCeilingFor = (liveMax: number): number =>
  liveMax * STORED_CEILING_MULTIPLE;

export const storageFullError = (): Error =>
  new Error(
    "This has been created and deleted too many times. Please contact support.",
  );

export type RoomCheck = {
  /** Rows the user can still see. */
  countLive: () => Promise<number>;
  /** Every row held, tombstones included. */
  countStored: () => Promise<number>;
  liveMax: number;
  /** What the user is told when the visible ceiling is reached. */
  liveError: () => Error;
  /** How many rows are about to be written. */
  adding?: number;
};

export async function assertRoom({
  countLive,
  countStored,
  liveMax,
  liveError,
  adding = 1,
}: RoomCheck): Promise<void> {
  const [live, stored] = await Promise.all([countLive(), countStored()]);

  if (live + adding > liveMax) throw liveError();
  if (stored + adding > storedCeilingFor(liveMax)) throw storageFullError();
}
