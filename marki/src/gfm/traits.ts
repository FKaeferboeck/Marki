import { set_checkboxListItem_active } from "../blocks/listItem.js";
import { MarkdownParserTraits } from "../markdown-parser.js";
import { MarkdownRendererTraits } from "../renderer/renderer.js";
import { register_gfm_autolink } from "./gfm-autolink.js";
import { register_strikethrough } from "./strikethrough.js";

/* GitHub Flavored Markdown (GFM)
 *
 * This is the most common dialect of Markdown in use today.
 * GFM is modelled as an extension of CommonMark, adding the following features (c.f. https://github.github.com/gfm/):
 * 
 * - 4.10 table
 * - 5.3  tasklist
 * - 6.5  strikethrough
 * - 6.9  autolink
 * - 6.11 tagfilter
 */

export function extendGFM(MDPT: MarkdownParserTraits, MDRT? : MarkdownRendererTraits) {
    set_checkboxListItem_active(MDPT, true);
    register_strikethrough(MDPT, MDRT);
    register_gfm_autolink (MDPT, MDRT)
}
