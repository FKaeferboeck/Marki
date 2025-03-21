import { BlockParser_EmptySpace } from "../block-parser.js";
import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";


export const emptySpace_traits = {
    startsHere(LLD: LogicalLineData) { return (LLD.type === "empty" || LLD.type === "emptyish" ? 0 : -1); }, // doesn't matter, the individual BlockParser skips this function
    continuesHere() { return "end"; },

    allowSoftContinuations: true,
    allowCommentLines: true,
    
    creator(MDP) { return new BlockParser_EmptySpace(MDP, this); },
    defaultBlockInstance: {
        type: "emptySpace",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: []
    }
} as BlockTraits<"emptySpace">;
