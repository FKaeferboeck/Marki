import { BlockParser_Standard } from "../block-parser";
import { LogicalLineData } from "../markdown-types";
import { BlockTraits } from "../traits";

export interface IndentedCodeBlock {
    indention: string;
};


export const indentedCodeBlock_traits: BlockTraits<"indentedCodeBlock"> = {
    startsHere(LLD: LogicalLineData, B) {
        return -1;
        //return (LLD.startIndent < 4 && LLD.startPart.startsWith('```') ? LLD.startIndent : -1);
        if(LLD.startIndent < 4)    return -1;
        return 4;
    },
    continuesHere(LLD, B) {
        if(LLD.startIndent < 4)
            return "end";
        return 4;
    },

    allowSoftContinuations: false,
    allowCommentLines: true,

    creator(MDP) { return new BlockParser_Standard<"indentedCodeBlock">(MDP, this); },
    defaultBlockInstance: {
        type: "indentedCodeBlock",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        indention: ''
    }
};
