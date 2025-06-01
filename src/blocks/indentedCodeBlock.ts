import { BlockParser_Standard } from "../block-parser.js";
import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";

export interface IndentedCodeBlock { };


export const indentedCodeBlock_traits: BlockTraits<"indentedCodeBlock"> = {
    startsHere(LLD: LogicalLineData) {
        if(LLD.startIndent < 4)    return -1;
        this.setCheckpoint(LLD);
        return 4;
    },
    continuesHere(LLD) {
        if(LLD.type === "empty" || LLD.type === "emptyish")
            return 4;

        if(LLD.startIndent < 4)
            return "end";

        this.setCheckpoint(LLD);   
        return 4;
    },

    allowSoftContinuations: false,
    allowCommentLines: true,
    inlineProcessing: false,
    defaultBlockInstance: { }
};
