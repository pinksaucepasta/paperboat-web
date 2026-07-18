import { beforeEach, describe, expect, it } from "vitest";
import { useCounterStore } from "./counter-store";

describe("counter store", () => {
  beforeEach(() => {
    useCounterStore.getState().reset();
  });

  it("starts at zero", () => {
    expect(useCounterStore.getState().count).toBe(0);
  });

  it("increments and decrements", () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().increment();
    expect(useCounterStore.getState().count).toBe(2);

    useCounterStore.getState().decrement();
    expect(useCounterStore.getState().count).toBe(1);
  });

  it("resets to zero", () => {
    useCounterStore.getState().increment();
    useCounterStore.getState().reset();
    expect(useCounterStore.getState().count).toBe(0);
  });
});
