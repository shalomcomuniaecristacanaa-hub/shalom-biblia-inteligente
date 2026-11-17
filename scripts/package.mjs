import AdmZip from "adm-zip";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
if (!existsSync("dist/code.js")) {
  throw new Error("dist/code.js não encontrado. Execute npm run build primeiro.");
}
const zip = new AdmZip();
zip.addLocalFile("manifest.json");
zip.addLocalFile("README.md");
zip.addLocalFolder("dist", "dist");
await mkdir("release", { recursive: true });
const output = path.join("release", `${manifest.id}-${manifest.version}.zip`);
zip.writeZip(output);
console.log(`Pacote criado: ${output}`);
