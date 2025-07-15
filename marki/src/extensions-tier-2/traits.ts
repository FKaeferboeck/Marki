import { LogicalLine, LogicalLine_text, standardBlockStart } from "../linify.js";
import { MarkdownParser, MarkdownParserTraits } from "../markdown-parser.js";
import { Renderer } from "../renderer/renderer.js";
import { register } from "./inline/custom-styling.js";
import { ext_tier2_title_render, markdown_doc_title_traits, markdown_doc_title_type } from "./blocks/markdown-doc-title.js";
import { sectionHeader_ext_render, sectionHeader_ext_traits } from "./blocks/section-numbering.js";

export interface Tier2_ctx {
    tier2_command_char: string;
}

/* Reasonable choices for the command char are things like $, #, %, !, or \ — whichever is most appropriate for your syntax style preference */
export function set_tier2_command_char(MDPT: MarkdownParserTraits, command_char: string) {
    if(command_char.length != 1)
        throw new Error(`set_tier2_command_char: Illegal command char "${command_char}", must be a single character`);
    (MDPT.globalCtx as Tier2_ctx).tier2_command_char = command_char;
}

export function tier2_command_char(MDP: MarkdownParser) {
    return (MDP.globalCtx as Tier2_ctx).tier2_command_char;
}

export const tier2_command_block_start = (MDP: MarkdownParser, LL: LogicalLine): LL is LogicalLine_text =>
    (standardBlockStart(LL) && LL.content.startsWith(tier2_command_char(MDP)));



export function extendTier2(MDPT: MarkdownParserTraits, renderer? : Renderer) {
    set_tier2_command_char(MDPT, '$');
    MDPT.addExtensionBlocks(markdown_doc_title_traits, "last");
    MDPT.blockTraitsList[sectionHeader_ext_traits.blockType] = sectionHeader_ext_traits;

    if(renderer) {
        renderer.blockHandler[markdown_doc_title_type] = ext_tier2_title_render;
        renderer.blockHandler[sectionHeader_ext_traits.blockType] = sectionHeader_ext_render;
    }

    register(MDPT, renderer);
}
