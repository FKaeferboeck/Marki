import { fileURLToPath } from "url";
import * as path from "path";

/* Marki isn't normally run from source, but has a dual-mode build setup (CommonJS and ESM). To achieve that, appropriate variants
 * of this file are provided in the /dist-cjs and /dist-esm folders.
 * This file (+ the type declaration file path.d.ts) here is equivalent to the ESM variant and exists for two reasons:
 * 
 *   - to stop VS Code from displaying an error
 *   - for the unit tests powered by Vitest
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveSourcePath(filepath) {
    return path.join(dirname, filepath);
}
