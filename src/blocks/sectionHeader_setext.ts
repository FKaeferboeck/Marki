import { BlockParser_Standard } from "../block-parser";
import { LogicalLineData } from "../markdown-types";
import { BlockTraits } from "../traits";


export function setext_end_line(LLD: LogicalLineData) {
    if(LLD.type !== "single" || LLD.startIndent >= 4 || !/^(=+|-+)\s*$/.test(LLD.startPart))
        return -1;
    return (LLD.startPart.charAt(0) === '=' ? 1 : 2);
}


export const sectionHeader_setext_traits: BlockTraits<"sectionHeader_setext"> = {
    startsHere(data: LogicalLineData, B) {
        return 0; // because this will only be called when all other possibilities have been excluded
    },
    continuesHere(LLD, B) {
        const n = setext_end_line(LLD);
        if(n < 0)    return "soft";
        B.level = n;
        return "last";
    },

    allowSoftContinuations: false,
    canBeSoftContinuation: false,
    allowCommentLines: false,
    creator(MDP) { return new BlockParser_Standard<"sectionHeader_setext">(MDP, this); },
    defaultBlockInstance: {
        type: "sectionHeader_setext",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        level: -1
    }
};
