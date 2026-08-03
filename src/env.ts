import path from "path";
import "dotenv/config";

export const rootDir = path.resolve(__dirname, "..");

export const hostDir: string = process.env["PSM_HOST_DIR"] || rootDir;

export const DOCKER_IMAGE: string | undefined = process.env["DOCKER_IMAGE"];
