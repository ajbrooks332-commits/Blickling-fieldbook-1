import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actionTransitions,
  canTransition,
  observationTransitions,
} from "./workflows";

describe("estate workflows", () => {
  it("allows supported observation transitions and rejects shortcuts", () => {
    assert.equal(canTransition(observationTransitions, "draft", "submitted"), true);
    assert.equal(canTransition(observationTransitions, "submitted", "closed"), false);
    assert.equal(canTransition(observationTransitions, "closed", "monitoring"), true);
  });

  it("allows supported action transitions and rejects invalid completion", () => {
    assert.equal(canTransition(actionTransitions, "not_started", "in_progress"), true);
    assert.equal(canTransition(actionTransitions, "planned", "completed"), false);
    assert.equal(canTransition(actionTransitions, "completed", "in_progress"), true);
  });

  it("accepts a status update that does not change status", () => {
    assert.equal(canTransition(actionTransitions, "waiting", "waiting"), true);
  });
});
