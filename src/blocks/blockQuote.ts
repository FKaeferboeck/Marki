import { BlockParser_Container } from "../block-parser.js";
import { measureColOffset, standardBlockStart } from "../linify.js";
import { BlockTraits_Container } from "../traits.js";

export interface BlockQuote {
    prefix: string;
};


export const blockQuote_traits: BlockTraits_Container<"blockQuote"> = {
    isContainer: true,

    startsHere(LL) {
        if(!(standardBlockStart(LL) && LL.content.startsWith('>')))
            return -1;
        return (/^>\s/.test(LL.content) ? 2 : 1) + LL.indent;
    },

    continuesHere(LL) {
        if(!standardBlockStart(LL)) // indented code blocks do not interrups block quotes
            return "soft";
        const rexres = /^>\s?/.exec(LL.content);
        if(!rexres)
            return "soft";
        return measureColOffset(LL, rexres[0].length) + LL.indent;
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    defaultBlockInstance: { prefix: '' }
};
export { BlockParser_Container };

