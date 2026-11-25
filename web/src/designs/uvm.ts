import { element } from "../dom";
import type { IpVerification, Node, Overview } from "./data";

const percent = (n: number | null | undefined) => n == null ? "—" : n.toFixed(2) + "%";

function analysis(ip: IpVerification): HTMLElement {
  const section = element("section", { class: "uvm-analysis" }, element("h3", {}, ip.ip + " · " + ip.status));
  if (ip.error) section.append(element("pre", {}, ip.error));
  if (ip.status === "unavailable") section.append(element("p", {}, "No runnable UVM profile for this IP."));
  for (const profile of ip.profiles ?? []) {
    section.append(element("h4", {}, profile.profile), element("p", { class: "muted" }, profile.configuration));
    for (const test of profile.tests) {
      const coverage = test.coverage;
      section.append(element("h5", {}, test.test + " · " + test.status));
      if (!coverage) {
        section.append(element("p", { class: "muted" }, "No coverage measurement for this test."));
        continue;
      }
      const row = (...values: string[]) => element("tr", {}, ...values.map((v) => element("td", {}, v)));
      const metrics = Object.keys(coverage.dut);
      section.append(element("table", {},
        element("thead", {}, element("tr", {}, ...["DUT metric", "Raw", "After exclusions"].map((v) => element("th", {}, v)))),
        element("tbody", {}, ...metrics.map((metric) => row(metric, percent(coverage.dut_raw[metric]), percent(coverage.dut[metric])))),
      ));
      if (Object.keys(coverage.functional).length) {
        section.append(element("table", {},
          element("thead", {}, element("tr", {}, element("th", {}, "Functional group"), element("th", {}, "Coverage"))),
          element("tbody", {}, ...Object.entries(coverage.functional).map(([group, value]) => row(group, percent(value)))),
        ));
      }
    }
  }
  return section;
}

export function uvm(inventory: Overview["ips"], node?: Node): HTMLElement[] {
  const measured = new Map(node?.uvm?.map((ip) => [ip.ip, ip]));
  const ips: IpVerification[] = inventory.map(({ip, has_suite}) =>
    measured.get(ip) ?? { ip, status: has_suite ? "pending" : "unavailable" });
  if (!ips.length) return [element("p", { class: "muted" },
    node?.status === "skipped" ? "No IP UVM suites registered." : node?.error ?? "No IP UVM results yet.")];
  const [design, , selected] = decodeURIComponent(location.hash.slice(1)).split("/");
  const chart = element("div", { class: "uvm-chart", "aria-label": "DUT coverage by IP" });
  for (const ip of ips) {
    const scores = (ip.profiles ?? []).flatMap((p) => p.tests.flatMap((t) => {
      const score = t.coverage?.dut.score;
      return score == null ? [] : [score];
    }));
    const mean = scores.length ? scores.reduce((a, b) => a + b) / scores.length : null;
    const bar = element("a", {
      href: "#" + [design, "uvm", ip.ip].map(encodeURIComponent).join("/"),
      class: "uvm-bar",
      "aria-label": ip.ip + ", " + (mean === null ? "no measured coverage" : percent(mean)) + ", " + ip.status,
      ...(selected === ip.ip ? { "aria-current": "true" } : {}),
    }, element("span", {}, ip.ip), element("span", { class: "uvm-track" },
      element("span", { class: "uvm-fill", style: "width:" + (mean ?? 0) + "%" })),
    element("span", {}, mean === null ? ip.status : percent(mean)));
    chart.append(bar);
    if (ip.ip === selected) chart.append(analysis(ip));
  }
  return [element("h2", {}, "IP coverage"), element("p", { class: "muted" },
    "Mean DUT score across measured tests after exclusions. Select an IP for individual test results."),
    chart];
}
