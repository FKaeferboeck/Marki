import { BlockContainer, BlockParser, BlockParser_Container, BlockParser_Standard, ParseState, MarkdownParser } from "../block-parser";
import { BlockType, ExtensionBlockType, Block, LogicalLineData } from "../markdown-types";
import { LineStructure, LogicalLineType } from "../parser";
import { ContainerBlockTraits, BlockContinuationType } from "../traits";

export interface BlockQuote {
    prefix: string;
};


const standardBlockLineTypes: Partial<Record<LogicalLineType | "single", boolean>> = { single: true,  text: true };
export const standardBlockStart = (LLD: LogicalLineData) => (!!standardBlockLineTypes[LLD.type] && LLD.startIndent < 4);


export const blockQuote_traits: ContainerBlockTraits<"blockQuote"> = {
    isContainer: true,
    startsHere(LLD: LogicalLineData, B) {
        if(!(standardBlockStart(LLD) && LLD.startPart.startsWith('>')))
            return -1;
        return (/^>\s/.test(LLD.startPart) ? 2 : 1);
    },
    continuationPrefix: /^>\s?/,

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

