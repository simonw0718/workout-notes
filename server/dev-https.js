// server/dev-https.js  —— HTTPS + Next (production)
import fs from "fs";
import { createServer } from "https";
import { parse } from "url";
import next from "next";

const host = "0.0.0.0";
const port = 3443;      // HTTPS 對外埠
const dev  = false;     // ★ 關鍵：一定要 false（走正式版）

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key:  fs.readFileSync("./certs/192.168.31.241-key.pem"),
  cert: fs.readFileSync("./certs/192.168.31.241.pem"),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, host, () => {
    console.log(`> Next.js (prod) over HTTPS: https://192.168.31.241:${port}`);
  });
});