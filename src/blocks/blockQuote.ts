import { BlockContainer, BlockParser, BlockParser_Container, BlockParser_Standard, EligibleParsers, MarkdownParser } from "../block-parser";
import { BlockType, ExtensionBlockType, Block, LogicalLineData } from "../markdown-types";
import { LineStructure } from "../parser";
import { ContainerBlockTraits, BlockContinuationType } from "../traits";

export interface BlockQuote {
    prefix: string;
};



/*let P: BlockParser<Block> | null = null;
	while(LLD0 !== LLD1) {
		P = this.processLine(LLD0, PP);
		if(!P && !PP.curParser)
			throw new Error(`A line that doesn't belong to any block, that's not possible!`)
		PP.curParser = P;
	}
	return P;*/


export const blockQuote_traits: ContainerBlockTraits<"blockQuote"> = {
    isContainer: true,
    startsHere(data: LogicalLineData, B) {
        // We only reach here if we already know it's not an indented code section
        const rexres = /^>\s+/.exec(data.startPart);
        if(!rexres)
            return -1;
        B.prefix = rexres[0]; // TODO!! prefix whitespace
        return B.prefix.length;
    },
    continuationPrefix: /^> /,

    allowSoftContinuations: true,
    allowCommentLines: true,
    
    creator(MDP) { return new BlockParser_Container<"blockQuote">(MDP, this as ContainerBlockTraits<"blockQuote">); },
    defaultBlockInstance: {
        type: "blockQuote",
        isContainer: true,
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        prefix: ''
    }
};
export { BlockParser_Container };

