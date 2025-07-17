import { MarkdownParserTraits } from "../markdown-parser.js";
import { MarkdownRendererTraits } from "../renderer/renderer.js";
import { ext_tier1_tabular_render, markdown_tabular_traits, tabular_type } from "./blocks/tabular.js";


export function extendTier1(MDPT: MarkdownParserTraits, renderer? : MarkdownRendererTraits) {
    MDPT.addExtensionBlocks(markdown_tabular_traits, "last");
    if(renderer)
        renderer.blockHandler[tabular_type] = ext_tier1_tabular_render;
}
