const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.DEBUG_PORT || 5500);
const root = process.cwd();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function safePath(urlPath) {
  const requested = decodeURIComponent((urlPath || "/").split("?")[0]);
  const normalized = requested === "/" ? "/index.html" : requested;
  const fullPath = path.normalize(path.join(root, normalized));
  if (!fullPath.startsWith(root)) {
    return null;
  }
  return fullPath;
}

const server = http.createServer((req, res) => {
  const fullPath = safePath(req.url);
  if (!fullPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let filePath = fullPath;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
});

console.log("Starting local debug server");
server.listen(port, () => {
  console.log(`Local debug server ready: http://localhost:${port}/index.html`);
});

server.on("error", (err) => {
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});
