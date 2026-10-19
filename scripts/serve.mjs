import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let target = path.resolve(root, "." + pathname);
      if (!target.startsWith(root + path.sep) && target !== root) {
        res.writeHead(403).end();
        return;
      }
      const info = await stat(target);
      if (info.isDirectory()) target = path.join(target, "index.html");
      const bytes = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(await readFile(path.join(root, "404.html")));
    }
  })
  .listen(Number(process.env.PORT || 4173), "0.0.0.0", () =>
    console.log("Static export served on port 4173"),
  );
