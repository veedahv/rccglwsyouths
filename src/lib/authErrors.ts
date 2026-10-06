// Turns Firebase Auth error codes into messages a person can act on.
// Anything unrecognised falls back to a generic line rather than leaking
// a raw "auth/…" code onto the screen.

export const MIN_PASSWORD_LENGTH = 8;

function codeOf(err: unknown): string {
  return typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
}

/** Returns an error message for a password problem, or null if it's fine. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

export function describeAuthError(err: unknown): string {
  switch (codeOf(err)) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Your current password is incorrect.";
    case "auth/weak-password":
      return `Choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`;
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/requires-recent-login":
      return "For your security, please sign out, sign in again, and retry.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    case "auth/expired-action-code":
      return "This link has expired. Request a new one.";
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used. Request a new one.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact an admin.";
    case "auth/user-not-found":
      return "We couldn't find an account for this link.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    default:
      return "Something went wrong. Please try again.";
  }
}
