// Tiny static server for local use and e2e tests: node tests/serve.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".pdf": "application/pdf", ".png": "image/png", ".json": "application/json" };

function start(port = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || file.includes("node_modules")) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}
module.exports = { start };
if (require.main === module) {
  start(+process.argv[2] || 8080).then((s) => console.log(`Qalam PDF: http://127.0.0.1:${s.address().port}/`));
}
