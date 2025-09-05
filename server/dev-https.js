// server/dev-https.js
import fs from "fs";
import { createServer } from "https";
import { parse } from "url";
import next from "next";

const host = "0.0.0.0";
const port = 3443;            // 前端 HTTPS 3443
const dev = true;

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
    console.log(`> Next.js dev over HTTPS: https://192.168.31.241:${port}`);
  });
});