import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coordinateSchema, strongPassword } from "./validation";

describe("request validation", () => {
  it("requires a long mixed-character password", () => {
    assert.equal(strongPassword.safeParse("Estate-Fieldbook-2026!").success, true);
    assert.equal(strongPassword.safeParse("short").success, false);
    assert.equal(strongPassword.safeParse("alllowercasebutlong1!").success, false);
  });

  it("requires latitude and longitude together", () => {
    assert.equal(coordinateSchema.safeParse({ latitude: 52.81, longitude: 1.23 }).success, true);
    assert.equal(coordinateSchema.safeParse({ latitude: 52.81 }).success, false);
    assert.equal(coordinateSchema.safeParse({ latitude: null, longitude: null }).success, true);
  });
});
