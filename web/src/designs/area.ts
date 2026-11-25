// The Area page of a design: the device's area from Design Compiler.
import { element } from "../dom";
import type { DesignSnapshot } from "./data";

// The timeline nodes that measure it.
const from = ["dc-area"];

export function area(snapshot: DesignSnapshot): HTMLElement[] {
  const nodes = snapshot.nodes.filter((n) => from.includes(n.id));
  return [
    element("p", { class: "muted" }, "The device's area from Design Compiler."),
    element(
      "ul",
      {},
      ...nodes.map((n) => element("li", {}, `${n.name}: ${n.status === "pending" ? "not reached yet" : n.status}`)),
    ),
  ];
}
