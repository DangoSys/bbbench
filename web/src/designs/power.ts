// The Power page of a design: the device's power from PrimeTime PX.
import { element } from "../dom";
import type { DesignSnapshot } from "./data";

// The timeline nodes that measure it.
const from = ["power"];

export function power(snapshot: DesignSnapshot): HTMLElement[] {
  const nodes = snapshot.nodes.filter((n) => from.includes(n.id));
  return [
    element("p", { class: "muted" }, "The device's power from PrimeTime PX."),
    element(
      "ul",
      {},
      ...nodes.map((n) => element("li", {}, `${n.name}: ${n.status === "pending" ? "not reached yet" : n.status}`)),
    ),
  ];
}
