import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = `${__dirname}/dist`;
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/index.js`, readFileSync(`${__dirname}/src/index.js`, "utf8"));
writeFileSync(`${dir}/index.mjs`, readFileSync(`${__dirname}/src/index.js`, "utf8"));
writeFileSync(`${dir}/wallet.js`, readFileSync(`${__dirname}/src/wallet.js`, "utf8"));
writeFileSync(`${dir}/wallet.mjs`, readFileSync(`${__dirname}/src/wallet.js`, "utf8"));
