// The local bbdev server, behind the dev server's /bbdev proxy. The published
// site has none: it only reads snapshots.

interface Result {
  status: "success" | "failure" | "processing" | "cancelled";
  body: Record<string, unknown>;
}

// The result query answers 404 for an unknown trace: bbdev is there.
export async function available(): Promise<boolean> {
  try {
    const response = await fetch("./bbdev/result/probe");
    return response.headers.get("content-type")?.includes("json") ?? false;
  } catch {
    return false;
  }
}

async function result(trace: string): Promise<Result | undefined> {
  const response = await fetch(`./bbdev/result/${trace}`);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`bbdev result ${trace}: ${response.status}`);
  return (await response.json()) as Result;
}

// Run one `bench-prefab` evaluation and wait for its snapshot; `tick`
// reports the wait.
export async function benchPrefab(
  evaluation: string,
  request: Record<string, unknown>,
  tick: (seconds: number) => void,
): Promise<string> {
  const response = await fetch(`./bbdev/bench/prefab/${evaluation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const submitted = (await response.json()) as { trace_id?: string; error?: string };
  if (!response.ok || !submitted.trace_id) throw new Error(submitted.error ?? `bbdev: ${response.status}`);
  const start = Date.now();
  for (;;) {
    await new Promise((done) => setTimeout(done, 5000));
    tick(Math.round((Date.now() - start) / 1000));
    const state = await result(submitted.trace_id);
    if (!state || state.status === "processing") continue;
    if (state.status !== "success") throw new Error(String(state.body.error ?? state.status));
    return String(state.body.snapshot).split("/").pop()!;
  }
}

// Start one `bench-device` step of a device; its snapshot shows it running.
export async function benchDevice(step: string, device: string): Promise<void> {
  const response = await fetch(`./bbdev/bench/device/${step}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device }),
  });
  const submitted = (await response.json()) as { trace_id?: string; error?: string };
  if (!response.ok || !submitted.trace_id) throw new Error(submitted.error ?? `bbdev: ${response.status}`);
}
