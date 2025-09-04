import { fileURLToPath } from "url";
import * as path from "path";
const dirname = path.dirname(fileURLToPath(import.meta.url));
export function resolveSourcePath(filepath) {
    return path.join(dirname, filepath);
}