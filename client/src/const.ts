export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Returns the login page URL (uses internal auth, not external OAuth portal)
export const getLoginUrl = () => {
  return "/login";
};

// Alias for tooling that expects a function export
export function getLoginUrlFn() {
  return getLoginUrl();
}
