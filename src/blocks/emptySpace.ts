import { BlockParser_EmptySpace } from "../block-parser.js";
import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";

export interface EmptySpace { };

export const emptySpace_traits: BlockTraits<"emptySpace"> = {
    startsHere(LLD: LogicalLineData) { return (LLD.type === "empty" || LLD.type === "emptyish" ? 0 : -1); }, // doesn't matter, the individual BlockParser skips this function
    continuesHere() { return "end"; },

    allowSoftContinuations: true,
    allowCommentLines: true,
    hasContent: false,
    
    creator(MDP, type) { return new BlockParser_EmptySpace(MDP, type, this); },
    defaultBlockInstance: { }
};
