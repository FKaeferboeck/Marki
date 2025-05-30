import { BlockParser_Container } from "../block-parser.js";
import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits_Container } from "../traits.js";
import { standardBlockStart } from "../util.js";

export interface BlockQuote {
    prefix: string;
};


export const blockQuote_traits: BlockTraits_Container<"blockQuote"> = {
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
    defaultBlockInstance: { prefix: '' }
};
export { BlockParser_Container };

