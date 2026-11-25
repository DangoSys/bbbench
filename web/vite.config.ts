import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { availableParallelism, loadavg } from "node:os";
import { createConnection } from "node:net";
import { resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

// The bbdev server the site talks to when run locally.
const bbdevPort = 5090;
// bbbench is a submodule of Buckyball at thirdparty/bbbench.
const buckyball = resolve(import.meta.dirname, "../../..");

function listening(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.end();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

// `vite` (dev) starts a bbdev server unless one is listening, and stops the
// one it started when it exits. The server runs in a process group of its own,
// out of reach of the terminal's Ctrl+C, and Node emits no `exit` when a
// signal ends it: SIGINT and SIGTERM stop the server first, or it outlives
// Vite and the next `vite` reuses that stale server.
function bbdevServer(): Plugin {
  let server: ChildProcess | undefined;
  return {
    name: "bbdev-server",
    apply: "serve",
    async configureServer(vite) {
      if (await listening(bbdevPort)) return;
      server = spawn(
        "nix",
        ["develop", buckyball, "-c", "bbdev", "start", "--server", "--port", String(bbdevPort)],
        { cwd: buckyball, stdio: "ignore", detached: true },
      );
      const stop = () => {
        if (server?.pid) process.kill(-server.pid, "SIGTERM");
        server = undefined;
      };
      vite.httpServer?.once("close", stop);
      process.once("exit", stop);
      for (const signal of ["SIGINT", "SIGTERM"] as const)
        process.once(signal, () => {
          stop();
          process.exit(signal === "SIGINT" ? 130 : 143);
        });
    },
  };
}

// The snapshots of save/, read from disk at every request while developing: benches add snapshots while the
// server runs, and Vite serves its public directory from a list it keeps up with a file watcher. A snapshot the
// watcher misses (a host out of inotify watches) gets the page fallback as its JSON, and the page that asked
// for it shows nothing.
function snapshots(): Plugin {
  const save = resolve(import.meta.dirname, "../save");
  return {
    name: "snapshots",
    apply: "serve",
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const path = resolve(save, `.${decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)}`);
        if (!path.startsWith(save + sep) || !path.endsWith(".json") || !existsSync(path)) return next();
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-cache");
        response.end(readFileSync(path));
      });
    },
  };
}

// The host's load for the top bar, at /load.json while developing.
function load(): Plugin {
  return {
    name: "load",
    apply: "serve",
    configureServer(vite) {
      vite.middlewares.use("/load.json", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ load: loadavg()[0], cpus: availableParallelism() }));
      });
    },
  };
}

// One HTML entry per page. Relative base: the site works from any URL prefix
// (GitHub Pages project path, a local static server). The snapshots of save/
// are served at the site root.
export default defineConfig({
  base: "./",
  publicDir: "../save",
  plugins: [bbdevServer(), snapshots(), load()],
  server: {
    proxy: {
      "/bbdev": {
        target: `http://127.0.0.1:${bbdevPort}`,
        rewrite: (path) => path.replace(/^\/bbdev/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        cover: "index.html",
        prefab: "prefab.html",
        ball: "ball.html",
        unit: "unit.html",
        abstract: "abstract.html",
        designs: "designs.html",
        design: "design.html",
        tools: "tools.html",
        agent: "agent.html",
      },
    },
  },
});
