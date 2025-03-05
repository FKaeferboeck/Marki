import { BlockParser_EmptySpace } from "../block-parser";
import { LogicalLineData } from "../markdown-types";
import { BlockTraits } from "../traits";


export const emptySpace_traits = {
    startsHere(data: LogicalLineData, B) { return 0; }, // doesn't matter, the individual BlockParser skips this function
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
