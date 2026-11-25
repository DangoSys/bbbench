import type { Simulator } from "./simulation";

// P2E prototyping, built with bank trace only.
export const fpga: Simulator = { name: "FPGA", tone: "s3", model: { name: "FPGA", node: "fpga-model" } };
