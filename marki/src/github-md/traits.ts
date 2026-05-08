import { set_checkboxListItem_active } from "../blocks/listItem.js";
import { MarkdownParserTraits } from "../markdown-parser.js";
import { MarkdownRendererTraits } from "../renderer/renderer.js";



export function extendGitHubMD(MDPT: MarkdownParserTraits, renderer? : MarkdownRendererTraits) {
    set_checkboxListItem_active(MDPT, true);
}
