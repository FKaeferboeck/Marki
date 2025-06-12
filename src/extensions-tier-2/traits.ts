import { LogicalLine, LogicalLine_text, standardBlockStart } from "../linify";
import { MarkdownParser } from "../markdown-parser";
import { Renderer } from "../renderer/renderer";
import { register } from "./blocks/custom-styling";
import { ext_tier2_title_render, markdown_doc_title_traits, markdown_doc_title_type } from "./blocks/markdown-doc-title";

/* Reasonable choices for the command char are things like $, #, %, !, or \ — whichever is most appropriate for your syntax style preference */
export function set_tier2_command_char(MDP: MarkdownParser, command_char: string) {
    if(command_char.length != 1)
        throw new Error(`set_tier2_command_char: Illegal command char "${command_char}", must be a single character`);
    MDP.customContext['tier2_command_char'] = command_char;
}

export function tier2_command_char(MDP: MarkdownParser) {
    return ((MDP.customContext['tier2_command_char'] as string) || '$');
}

export const tier2_command_block_start = (MDP: MarkdownParser, LL: LogicalLine): LL is LogicalLine_text =>
    (standardBlockStart(LL) && LL.content.startsWith(tier2_command_char(MDP)));



export function extendTier2(parser: MarkdownParser, renderer? : Renderer) {
    set_tier2_command_char(parser, '$');
    parser.addExtensionBlocks(markdown_doc_title_traits, "last");
    if(renderer)
        renderer.blockHandler[markdown_doc_title_type] = ext_tier2_title_render;

    register(parser, renderer);
}
