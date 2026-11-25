// The host's load in the top bar: the one-minute load average over its CPUs.
// Only the local dev server knows its host; the published site shows nothing.
const gauge = document.createElement("span");
gauge.className = "load";
document.querySelector("nav.top")!.append(gauge);

async function update(): Promise<void> {
  const response = await fetch("./load.json", { cache: "no-store" });
  if (!response.ok || !response.headers.get("Content-Type")?.startsWith("application/json")) {
    gauge.remove();
    return;
  }
  const { load, cpus } = (await response.json()) as { load: number; cpus: number };
  const share = load / cpus;
  gauge.title = `Host load ${load.toFixed(0)} on ${cpus} CPUs`;
  gauge.classList.toggle("over", share > 1);
  gauge.replaceChildren(
    "Load ",
    Object.assign(document.createElement("meter"), { min: 0, max: 1, value: Math.min(share, 1) }),
    ` ${share.toFixed(1)}×`,
  );
  setTimeout(update, 5000);
}
void update();
