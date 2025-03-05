import { BlockParser_Standard } from "../block-parser";
import { BlockBase, LogicalLineData } from "../markdown-types";
import { BlockTraits, BlockContinuationType } from "../traits";
import { setext_end_line } from "./sectionHeader_setext";


export interface Paragraph { };


export const paragraph_traits: BlockTraits<"paragraph"> = {
    startsHere(LLD: LogicalLineData) { return 0; },
    continuesHere(LLD: LogicalLineData, B: BlockBase<"paragraph">): BlockContinuationType | undefined {
        /* By the intent of the parsing algorithm we should look for SETEXT headers before looking for a paragraph and
         * paragraphs shouldn't be aware that such a thing as a SETEXT header even exists.
         * However paragraphs are common and SETEXT headers are rare, so we would parse most markdown content twice, looking
         * for SETEXT headers that aren't there.
         * So as a small optimization we scan for paragraphs first and reject them if it would be a SETEXT header instead.
         */
        if(setext_end_line(LLD) > 0)
            return "reject";
        return undefined;
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    creator(MDP) { return new BlockParser_Standard<"paragraph">(MDP, this); },
    defaultBlockInstance: {
        type: "paragraph",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: []
    }
};
