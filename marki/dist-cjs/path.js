"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSourcePath = resolveSourcePath;
const path = require("path");
function resolveSourcePath(filepath) {
    return path.join(__dirname, filepath);
}