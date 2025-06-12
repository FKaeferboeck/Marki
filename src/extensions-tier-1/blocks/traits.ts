import { MarkdownParser } from "../../markdown-parser";
import { Renderer } from "../../renderer/renderer";
import { ext_tier1_tabular_render, markdown_tabular_traits, tabular_type } from "./tabular";


export function extendTier1(parser: MarkdownParser, renderer? : Renderer) {
    parser.addExtensionBlocks(markdown_tabular_traits, "last");
    if(renderer)
        renderer.blockHandler[tabular_type] = ext_tier1_tabular_render;
}
