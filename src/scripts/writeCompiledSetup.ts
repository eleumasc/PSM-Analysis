import { writeFileSync } from "fs";
import compileSetup from "../core/compileSetup";
import path from "path";
import { rootDir } from "../env";

async function main() {
  const code = await compileSetup();
  writeFileSync(path.join(rootDir, "setup.js"), code);
}

main();
