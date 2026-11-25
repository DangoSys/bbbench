// The Tools page: the tools measured on their own, every simulator on the
// same workloads, and against each other on the models of the design
// timelines. A page per kind of tool, tools.html#latency-simulation first.
import { designs, map } from "../designs/data";
import { byId, element } from "../dom";
import { bemu } from "./bemu";
import { latest } from "./data";
import { fpga } from "./fpga";
import { simulation } from "./simulation";
import { verilator } from "./verilator";

async function main(): Promise<void> {
  const found = await latest();
  const evaluated = await designs(await map());
  const pages: Record<string, () => HTMLElement[]> = {
    "latency-simulation": () => simulation([bemu, verilator, fpga], found, evaluated),
  };
  const draw = () => {
    const page = location.hash.slice(1) || "latency-simulation";
    byId("content").replaceChildren(
      element(
        "nav",
        { class: "pages" },
        ...Object.keys(pages).map((p) =>
          element("a", { href: `#${p}`, ...(p === page ? { "aria-current": "page" } : {}) }, (p[0].toUpperCase() + p.slice(1)).replace("-", " ")),
        ),
      ),
      ...pages[page](),
    );
  };
  window.addEventListener("hashchange", draw);
  draw();
}

void main();
