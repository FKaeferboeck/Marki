import { isSpaceLine } from "../linify.js";
import { makeBlockTraits } from "../traits.js";

export interface IndentedCodeBlock { };


export const indentedCodeBlock_traits = makeBlockTraits("indentedCodeBlock", {
    startsHere(LL) {
        if(LL.indent < 4)    return -1;
        this.setCheckpoint(LL);
        return 4;
    },
    continuesHere(LL) {
        if(isSpaceLine(LL))
            return 4;

        if(LL.indent < 4)
            return "end";

        this.setCheckpoint(LL);   
        return 4;
    },

    allowSoftContinuations: false,
    allowCommentLines: true,
    inlineProcessing: false,
    defaultBlockInstance: { }
});
