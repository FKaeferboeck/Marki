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

    creator(MDP) { return new BlockParser_Standard<"indentedCodeBlock">(MDP, this); },
    defaultBlockInstance: {
        type: "indentedCodeBlock",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: []
    }
};
