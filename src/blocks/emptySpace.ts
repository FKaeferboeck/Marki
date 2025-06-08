import { BlockParser_EmptySpace } from "../block-parser.js";
import { isSpaceLine, LogicalLine } from "../linify.js";
import { BlockTraits } from "../traits.js";

export interface EmptySpace { };


export const emptySpace_traits: BlockTraits<"emptySpace"> = {
    startsHere(LL: LogicalLine) { return (isSpaceLine(LL) ? 0 : -1); }, // doesn't matter, the individual BlockParser skips this function
    continuesHere() { return "end"; },

    allowSoftContinuations: true,
    allowCommentLines: true,
    hasContent: false,
    
    creator(MDP, type) { return new BlockParser_EmptySpace(MDP, type, this); },
    defaultBlockInstance: { }
};
