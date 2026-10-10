import { allCountries } from "./countries";
import { dbOrThrow } from "./supabase";

/**
 * Which player accounts belong to our own sub-admins.
 *
 * A partner signs up to play on the same number they registered as a partner
 * with, so the phone ties the two records together — but the two tables do not
 * store it the same way. A player's number is normalised to international
 * digits at registration ("233243911567"); a partner types theirs into a form
 * and it is kept as typed, which in Ghana means a local "0243911567". Matching
 * the raw digits finds nothing at all.
 *
 * So both sides are reduced to the local significant number: strip the country
 * code if it is there, then the leading zero. The dial codes come from the
 * country config rather than a list here, so a new market cannot be forgotten.
 */
function localNumber(phone: string | null | undefined): string {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (!d) return "";

  if (d.startsWith("00")) d = d.slice(2);

  for (const country of allCountries()) {
    // The length test stops a local number that merely begins with the same
    // digits from being mistaken for a prefixed one.
    if (d.startsWith(country.dialCode) && d.length > country.dialCode.length + 6) {
      d = d.slice(country.dialCode.length);
      break;
    }
  }

  return d.replace(/^0+/, "");
}

/**
 * Numbers named in VERIFICATION_EXEMPT_PHONES, comma separated.
 *
 * The operator's own console login is not a player account, so an admin who
 * also plays has no sub-admin record to be matched against. This is how that
 * account, or any other the operator wants to spare, is named. Written in any
 * format: they are reduced the same way every other number is.
 */
function exemptFromEnv(): string[] {
  return (process.env.VERIFICATION_EXEMPT_PHONES ?? "")
    .split(",")
    .map((p) => localNumber(p))
    .filter(Boolean);
}

/** Every phone that skips the deposit gate, as local significant numbers. */
export async function partnerPhones(): Promise<Set<string>> {
  const supabase = dbOrThrow();
  const { data } = await supabase.from("sub_admins").select("phone");
  const set = new Set<string>(exemptFromEnv());
  for (const row of data ?? []) {
    const n = localNumber(row.phone);
    if (n) set.add(n);
  }
  return set;
}

/** True when this phone belongs to a sub-admin. */
export function isPartnerPhone(phone: string | null | undefined, phones: Set<string>): boolean {
  const n = localNumber(phone);
  return n !== "" && phones.has(n);
}

/** Exported for the rule checks, which assert the two formats meet. */
export const __localNumber = localNumber;
