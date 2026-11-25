// One design: design.html#<design>, with a page per evaluation after the hash
// (#goban/area). Overview first.
import * as bbdev from "../bbdev";
import { byId, element } from "../dom";
import { accuracy } from "./accuracy";
import { area } from "./area";
import { correctness } from "./correctness";
import { cover } from "./cover";
import { designs, map, type DesignSnapshot, type MapDesign, type Node } from "./data";
import { overview } from "./overview";
import { performance } from "./performance";
import { power } from "./power";
import { hue } from "./hue";
import { steps } from "./timeline";
import { uvm } from "./uvm";

// Overview needs no evaluation; the others show what the latest one found.
type Rerun = (node: Node) => Promise<void>;
const pages: Record<
  string,
  (d: MapDesign, snapshot: DesignSnapshot | undefined, available: number, rerun?: Rerun) => HTMLElement[]
> = {
  overview,
  performance: (_, s, available) => (s ? performance(s, available) : [notYet()]),
  correctness: (_, s) => (s ? correctness(s) : [notYet()]),
  uvm: (d, s) => uvm(d.overview.ips, s?.nodes.find((node) => node.id === "uvm")),
  accuracy: (_, s, available) => (s ? accuracy(s, available) : [notYet()]),
  area: (_, s) => (s ? area(s) : [notYet()]),
  power: (_, s) => (s ? power(s) : [notYet()]),
};

const notYet = () => element("p", { class: "muted" }, "Not evaluated yet.");

async function main(): Promise<void> {
  const content = byId("content");
  const all = await map();
  let found = await designs(all);
  // Rerunning needs the local bbdev server; the published site only reads.
  const runnable = await bbdev.available();
  const draw = () => {
    const [name, page = "overview"] = decodeURIComponent(location.hash.slice(1)).split("/");
    const d = all.find((x) => x.design === name);
    if (!d) {
      content.replaceChildren(element("p", { class: "muted" }, `No design ${name}.`));
      return;
    }
    const latest = found.get(name)?.latest;
    document.title = `${name} · 3BBench`;
    const tabs = Object.keys(pages).map((p) =>
      element(
        "a",
        { href: `#${name}/${p}`, ...(p === page ? { "aria-current": "page" } : {}) },
        p === "uvm" ? "UVM" : p[0].toUpperCase() + p.slice(1),
      ),
    );
    content.replaceChildren(
      element(
        "header",
        { class: "design-head", style: `--hue: ${hue(name)}` },
        element("span", { class: "head-art" }, cover(name, d.overview, false)),
        element("div", {}, element("h1", {}, name), element("p", { class: "muted" }, d.description)),
      ),
      element("nav", { class: "pages" }, ...tabs),
      ...pages[page](
        d,
        latest,
        content.clientWidth,
        runnable
          ? async (node) => {
              // The device of the design's config: <design>/devices/<device>/configs/...
              await bbdev.benchDevice(steps[node.id], d.config.split("/")[2]);
              // bench writes the snapshot, the node running, as it starts.
              await new Promise((done) => setTimeout(done, 3000));
              found = await designs(all);
              draw();
            }
          : undefined,
      ),
    );
  };
  window.addEventListener("hashchange", draw);
  draw();
  // While a node runs, bench rewrites the snapshot: follow it.
  setInterval(async () => {
    const name = decodeURIComponent(location.hash.slice(1)).split("/")[0];
    if (!found.get(name)?.latest.nodes.some((n) => n.status === "running")) return;
    found = await designs(all);
    draw();
  }, 10000);
}

void main();
