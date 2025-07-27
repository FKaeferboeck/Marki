import { BlockContinuationType, makeBlockTraits } from "../traits.js";
import { setext_end_line } from "./sectionHeader_setext.js";


export interface Paragraph { };


export const paragraph_traits = makeBlockTraits("paragraph", {
    startsHere() { return 0; },
    continuesHere(LL, isSoftContainerContinuation?: boolean): BlockContinuationType | undefined {
        /* By the philosophy of the parsing algorithm we should look for SETEXT headers before looking for a paragraph and
         * paragraphs shouldn't be aware that such a thing as a SETEXT header even exists.
         * However paragraphs are common and SETEXT headers are rare, so we would parse most markdown content twice, looking
         * for SETEXT headers that aren't there.
         * So as a small optimization we scan for paragraphs first and reject them if it would be a SETEXT header instead.
         */
        if(!isSoftContainerContinuation && setext_end_line(LL) > 0)
            return "reject";
        /*if(LLD.type === "empty")
            return "end";*/
        return undefined;
        //return LLD.startIndent;
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    trimLeadingContentSpace: false,
    defaultBlockInstance: { }
});
