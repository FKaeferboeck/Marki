import { LogicalLine, standardBlockStart } from "../linify.js";
import { BlockTraits } from "../traits.js";
import { trimEndSpace } from "../util.js";


export function setext_end_line(LL: LogicalLine) {
    if(!standardBlockStart(LL) || !/^(=+|-+)\s*$/.test(LL.content))
        return -1;
    return (LL.content.startsWith('=') ? 1 : 2);
}


export const sectionHeader_setext_traits: BlockTraits<"sectionHeader_setext"> = {
    startsHere(LL) {
        return LL.indent; // because this will only be called when all other possibilities have been excluded
    },
    continuesHere(LL) {
        /* The following property is only set when that line was previously recognized as a soft container continuation, and the paragraph it was in was then rejected.
         * Since in that scenario we might have accepted a setext end line as a paragraph continuation, when we reparse it as a setext header we want it to remain as such,
         * so that the setext header doesn't end earlier than we expect it to.
         * Example:
         *      > paragraph content start
         *      =========================        <- would be setext end line but is accepted as paragraph continuation instead because it softly continues a block quote
         *      > -----------------------        <- here the paragraph gets rejected and reparsed as setext header => that's where that setext header should end and not in the previous line
         */
        if(LL.isSoftContainerContinuation)
            return "soft";

        const n = setext_end_line(LL);
        if(n < 0)    return "soft";
        this.B.level = n;
        return "last";
    },

    postprocessContentLine(LL) {
        return trimEndSpace(LL) as LogicalLine;
    },

    allowSoftContinuations: false,
    canBeSoftContinuation: false,
    allowCommentLines: false,
    defaultBlockInstance: { level: -1 }
};
