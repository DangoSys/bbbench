// The Tools page: the tools measured on their own, every simulator on the
// same workloads, and against each other on the models of the design
// timelines. A page per kind of tool, tools.html#latency-simulation first.
import { designs, map } from "../designs/data";
import { byId, element } from "../dom";
import { bemu } from "./bemu";
import { latest } from "./data";
import { fpga } from "./fpga";
import { bemuDetails, simulation } from "./simulation";
import { verilator } from "./verilator";

async function main(): Promise<void> {
  let found = await latest();
  const evaluated = await designs(await map());
  const pages: Record<string, () => HTMLElement[]> = {
    "latency-simulation": () => simulation([bemu, verilator, fpga], found, evaluated),
  };
  const draw = () => {
    const [page, tool, design, mode] = (location.hash.slice(1) || "latency-simulation").split("/").map(decodeURIComponent);
    const selected = tool === "bemu" && found.find((s) =>
      s.tool === "BEMU" && s.design === design && (s.flag ?? "fastest") === mode);
    byId("content").replaceChildren(
      element(
        "nav",
        { class: "pages" },
        ...Object.keys(pages).map((p) =>
          element("a", { href: `#${p}`, ...(p === page ? { "aria-current": "page" } : {}) }, (p[0].toUpperCase() + p.slice(1)).replace("-", " ")),
        ),
      ),
      ...(selected ? [bemuDetails(selected)] : pages[page]()),
    );
  };
  window.addEventListener("hashchange", draw);
  draw();
  async function refresh(): Promise<void> {
    try {
      const next = await latest();
      if (JSON.stringify(next) !== JSON.stringify(found)) {
        found = next;
        draw();
      }
    } finally {
      setTimeout(refresh, 10000);
    }
  }
  setTimeout(refresh, 10000);
}

void main();
