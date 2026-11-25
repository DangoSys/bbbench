import type { Simulator } from "./simulation";

// The performance model.
export const bemu: Simulator = { name: "BEMU", tone: "s1", model: { name: "BEMU", node: "bemu-model" } };
