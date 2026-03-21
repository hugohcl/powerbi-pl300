const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let fp = path.join(dir, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(3456, () => console.log('Serving on http://localhost:3456'));
