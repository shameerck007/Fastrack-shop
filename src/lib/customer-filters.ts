// Kept apart from the server-only customer queries so the browser can use it too.
export const CUSTOMER_FILTERS = [
  { value: "all", label: "All customers" },
  { value: "new", label: "New (last 30 days)" },
  { value: "repeat", label: "Repeat (2+ orders)" },
  { value: "never", label: "Never ordered" },
  { value: "blocked", label: "Blocked" },
] as const;
