import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarDate, coordinateSchema, strongPassword } from "./validation";

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

  it("rejects impossible calendar dates", () => {
    assert.equal(calendarDate.safeParse("2026-02-28").success, true);
    assert.equal(calendarDate.safeParse("2028-02-29").success, true); // leap year
    assert.equal(calendarDate.safeParse("2026-02-31").success, false);
    assert.equal(calendarDate.safeParse("2026-02-29").success, false); // not a leap year
    assert.equal(calendarDate.safeParse("2026-13-01").success, false);
    assert.equal(calendarDate.safeParse("2026-04-31").success, false);
    assert.equal(calendarDate.safeParse("2026-4-1").success, false);
  });
});
