import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
export function resolveDataFilepath(relativeFile) {
    return resolve(__dirname, relativeFile);
}