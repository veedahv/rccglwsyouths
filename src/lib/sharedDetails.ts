/**
 * A youth who has been made an exco has two records (a /youths doc and an
 * /excos doc, linked by exco.youthId / youth.linkedExcoId). These are the
 * personal details both records carry. The youth record is the source of
 * truth: lists of excos read these from it, and a change on either side is
 * written to both (see updateYouth and updateExco).
 *
 * Everything else about an exco — role, email, login, title — belongs to
 * the exco record alone and is never copied back.
 */
export const SHARED_FIELDS = ["name", "phone", "gender", "dob", "unit"] as const;

/** Only the shared fields that are actually present (and not undefined) in an update. */
export function pickShared(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SHARED_FIELDS) {
    if (key in data && data[key] !== undefined) out[key] = data[key];
  }
  return out;
}
