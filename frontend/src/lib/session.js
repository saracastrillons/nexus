export const SEEN_KEY = "nexus-boot-seen";

// The start-up sequence plays once per browser session.
export function shouldBoot() {
  try { return !sessionStorage.getItem(SEEN_KEY); } catch { return false; }
}
