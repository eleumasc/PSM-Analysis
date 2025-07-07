import browserify from "browserify";
import path from "path";
import { promisify } from "util";
import { rootDir } from "../env";

export default async function buildSetup() {
  return promisify<Buffer>((callback) =>
    browserify({ basedir: path.join(rootDir, "setup") })
      .add("./index.js")
      .bundle(callback)
  )();
}
