// A request belongs to the client tenant captured at setup and to its latest
// refresh. In particular, a late response may never populate another tenant.
export function createRequestScope(tenant: string | null | undefined, currentTenant: () => string | null | undefined) {
  const boundTenant = tenant ?? null;
  let generation = 0;
  return {
    matches: () => (currentTenant() ?? null) === boundTenant,
    begin() {
      const request = ++generation;
      return () => request === generation && (currentTenant() ?? null) === boundTenant;
    },
  };
}
