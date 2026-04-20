const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

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

function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const ifaceName of Object.keys(interfaces)) {
    const entries = interfaces[ifaceName] || [];
    for (const entry of entries) {
      if (entry.family !== "IPv4") {
        continue;
      }
      if (entry.internal || entry.address.startsWith("169.254.")) {
        continue;
      }
      ips.push(entry.address);
    }
  }

  return [...new Set(ips)];
}

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
server.listen(port, "0.0.0.0", () => {
  console.log(`Local debug server ready: http://localhost:${port}/index.html`);
  const lanIps = getLanIpv4Addresses();
  if (lanIps.length > 0) {
    for (const ip of lanIps) {
      console.log(`LAN URL: http://${ip}:${port}/index.html`);
    }
  } else {
    console.log("LAN URL: unavailable (no active IPv4 LAN interface found)");
  }
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`Server error: port ${port} is already in use. Stop the existing debug server and try again.`);
    process.exit(1);
    return;
  }
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});
