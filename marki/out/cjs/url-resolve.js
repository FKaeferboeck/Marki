"use strict";
const path = require('path');

function resolveDataFilepath(relativeFile) {
    const file = path.resolve(__dirname, '../../data', relativeFile);
    console.log(`Resolved filepath (CJS) to [${file}]`);
    return file;
}

module.exports = { resolveDataFilepath };
/*Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDataFilepath = resolveDataFilepath;
const url_1 = require("url");
const path_1 = require("path");
const __dirname = (0, path_1.dirname)((0, url_1.fileURLToPath)(import.meta.url));
function resolveDataFilepath(relativeFile) {
    const file = (0, path_1.resolve)(__dirname, '../../data', relativeFile);
    console.log(`Resolved filepath (ESM) to [${file}]`);
    return file;
}*
//# sourceMappingURL=url-resolve.js.map*/