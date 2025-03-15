import { BlockContainer, BlockParser, BlockParser_Container, BlockParser_Standard, ParseState, MarkdownParser } from "../block-parser";
import { BlockType, ExtensionBlockType, Block, LogicalLineData } from "../markdown-types";
import { LineStructure, LogicalLineType } from "../parser";
import { ContainerBlockTraits, BlockContinuationType } from "../traits";
import { standardBlockStart } from "../util";

export interface BlockQuote {
    prefix: string;
};


export const blockQuote_traits: ContainerBlockTraits<"blockQuote"> = {
    isContainer: true,
    startsHere(LLD: LogicalLineData) {
        if(!(standardBlockStart(LLD) && LLD.startPart.startsWith('>')))
            return -1;
        return (/^>\s/.test(LLD.startPart) ? 2 : 1) + LLD.startIndent;
    },

    continuesHere(LLD) {
        if(LLD.startIndent >= 4) // indented code blocks do not interrups block quotes
            return "soft";
        const rexres = /^>\s?/.exec(LLD.startPart);
        if(!rexres)
            return "soft";
        return rexres[0].length + LLD.startIndent;
    },
    

    allowSoftContinuations: true,
    allowCommentLines: true,
    
    creator(MDP) { return new BlockParser_Container<"blockQuote">(MDP, this as ContainerBlockTraits<"blockQuote">); },
    defaultBlockInstance: {
        type: "blockQuote",
        isContainer: true,
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        blocks: [],
        prefix: ''
    }
};
export { BlockParser_Container };

