import { describe, expect, it } from "vitest";
import { createRequestScope } from "./request-scope";

describe("collection request scope", () => {
  it("accepts the current response, rejects a superseded refresh", () => {
    const scope = createRequestScope("a", () => "a");
    const old = scope.begin();
    const latest = scope.begin();
    expect(old()).toBe(false);
    expect(latest()).toBe(true);
  });
  it("rejects in-flight results and hides cached results after collection changes", () => {
    let tenant = "a";
    const scope = createRequestScope(tenant, () => tenant);
    const pending = scope.begin();
    tenant = "b";
    expect(pending()).toBe(false);
    expect(scope.matches()).toBe(false);
    expect(scope.begin()()).toBe(false);
  });
  it("normalizes the default collection", () => {
    const scope = createRequestScope(undefined, () => null);
    expect(scope.begin()()).toBe(true);
  });
});
