import { MarkdownParserTraits } from "../markdown-parser.js";
import { MarkdownRendererTraits } from "../renderer/renderer.js";
import { sourceInclude_render, sourceInclude_traits } from "./blocks/source-include.js";
import { ext_tier1_tabular_render, extend_tier1_tabular, markdown_tabular_traits, tabular_type } from "./blocks/tabular.js";
import { register_strikethrough } from "./inline/strikethrough.js";


export function extendTier1(MDPT: MarkdownParserTraits, MDRT? : MarkdownRendererTraits) {
    extend_tier1_tabular(MDPT, MDRT);
    register_strikethrough(MDPT, MDRT);

    MDPT.addExtensionBlocks(sourceInclude_traits, "first");
    MDPT.addExtensionBlocks(markdown_tabular_traits, "last");
    //MDPT.afterBlockParsingSteps.push(sourceInclude_traits.blockType);

    if(MDRT) {
        MDRT.blockHandler[sourceInclude_traits.blockType] = sourceInclude_render;
        MDRT.blockHandler[tabular_type] = ext_tier1_tabular_render;

    }
}
