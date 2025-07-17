import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
export function resolveDataFilepath(relativeFile) {
    const file = resolve(__dirname, relativeFile);
    console.log(`Resolved filepath (ESM) to [${file}]`);
    return file;
}
