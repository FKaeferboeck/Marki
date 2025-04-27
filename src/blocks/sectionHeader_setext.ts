import { BlockParser_Standard } from "../block-parser.js";
import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { measureIndent, trimEndSpace } from "../util.js";


export function setext_end_line(LLD: LogicalLineData) {
    if(LLD.type !== "single" || LLD.startIndent >= 4 || !/^(=+|-+)\s*$/.test(LLD.startPart))
        return -1;
    return (LLD.startPart.charAt(0) === '=' ? 1 : 2);
}


export const sectionHeader_setext_traits: BlockTraits<"sectionHeader_setext"> = {
    startsHere(LLD: LogicalLineData) {
        return LLD.startIndent; // because this will only be called when all other possibilities have been excluded
    },
    continuesHere(LLD) {
        /* The following property is only set when that line was previously recognized as a soft container continuation, and the paragraph it was in was then rejected.
         * Since in that scenario we might have accepted a setext end line as a paragraph continuation, when we reparse it as a setext header we want it to remain as such,
         * so that the setext header doesn't end earlier than we expect it to.
         * Example:
         *      > paragraph content start
         *      =========================        <- would be setext end line but is accepted as paragraph continuation instead because it softly continues a block quote
         *      > -----------------------        <- here the paragraph gets rejected and reparsed as setext header => that's where that setext header should end and not in the previous line
         */
        if(LLD.isSoftContainerContinuation)
            return "soft";

        const n = setext_end_line(LLD);
        if(n < 0)    return "soft";
        this.B.level = n;
        return "last";
    },

    postprocessContentLine(LLD) {
        return trimEndSpace(LLD);
    },

    allowSoftContinuations: false,
    canBeSoftContinuation: false,
    allowCommentLines: false,
    defaultBlockInstance: { level: -1 }
};
