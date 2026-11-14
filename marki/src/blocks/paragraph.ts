import { BlockParser, BlockParser_Standard } from "../block-parser.js";
import { BlockContinuationType, castExtensionBlock, makeBlockTraits } from "../traits.js";
import { setext_end_line } from "./sectionHeader_setext.js";
import { lineContent, LogicalLine, LogicalLine_with_cmt } from "../linify.js";
import { MarkdownParserTraits } from "../markdown-parser.js";


export interface Paragraph { };

export type ParagraphStopper = (this: BlockParser<"paragraph">, LL: LogicalLine, isSoftContainerContinuation: boolean) => BlockContinuationType | undefined;

type ParagraphParser = BlockParser<"paragraph"> & { lines_to_reject: number; };




export const paragraph_traits = makeBlockTraits("paragraph", {
    startsHere() { return 0; },
    continuesHere(LL, isSoftContainerContinuation?: boolean): BlockContinuationType | undefined {
        /* The "soft continuation interruption" mechanism handles most cases where a line that might continue a paragraph
         * instead starts a different type of block.
         * But there are some more extreme cases where that other block cannot be recognized by its first line. In those
         * cases lines that were already assigned as belonging to a paragraph must be reassigned. Examples:
         *   - SETEXT headers: Are recognized by their last line (==== or ----) -> The whole paragraph gets rejected and
         *                     instead becomes the header content (which may be more than one line).
         *   - GFM table: Recognized by the delimiter row, which is the second line. The paragraph gets shortened by one
         *                (already accepted) line. This is not something generally possible for blocks, but for paragraphs
         *                it can be done because they don't have anything particular in terms of state.
         */
        const stoppers = (this.traits as typeof paragraph_traits & { paragraphStoppers: ParagraphStopper[]; }).paragraphStoppers;
        for(const stopper of stoppers) {
            const stop = stopper.call(this, LL, isSoftContainerContinuation || false);
            if(stop !== undefined)
                return stop;
        }

        return undefined;
    },

    paragraphStoppers: [
        (LL, isSoftContainerContinuation) => {
            /* By the philosophy of the parsing algorithm we should look for SETEXT headers before looking for a paragraph and
             * paragraphs shouldn't be aware that such a thing as a SETEXT header even exists.
             * However paragraphs are common and SETEXT headers are rare, so we would parse most markdown content twice, looking
             * for SETEXT headers that aren't there.
             * So as a small optimization we scan for paragraphs first and reject them if it would be a SETEXT header instead.
             */
            if(!isSoftContainerContinuation && setext_end_line(LL) > 0)
                return "reject";
        }
    ] as ParagraphStopper[],

    finalizeBlockHook() {
        const P = this as ParagraphParser;
        if((P.lines_to_reject || 0) === 0)
            return;

        /* As of now lines_to_reject is only used by GFM tables */
        this.B.logical_line_extent -= P.lines_to_reject;
        let L  = P.B.content as LogicalLine_with_cmt | undefined,
            LS = P.startLine as LogicalLine_with_cmt | undefined;
        for(let i = 1;  i < this.B.logical_line_extent;  ++i) {
            L  = L?.next;
            LS = LS?.next;
        }
        if(L)
            L.next = undefined;

        (P as any).lastLine = LS;
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    defaultBlockInstance: { }
});


paragraph_traits.creator = function(PP, type) {
    const P = new BlockParser_Standard<"paragraph">(PP, type, this);
    //P.finish = 
    return P;
}


export function addParagraphStopper(MDPT: MarkdownParserTraits, stopper: ParagraphStopper) {
    const traits = MDPT.blockTraitsList.paragraph! as typeof paragraph_traits & { paragraphStoppers: ParagraphStopper[]; };
    if(!traits.paragraphStoppers.some(s => s === stopper))
        traits.paragraphStoppers.push(stopper);
}

export function endRejectingLines(P_: BlockParser<"paragraph">, n_lines: number): BlockContinuationType {
    const P = P_ as ParagraphParser;
    P.lines_to_reject = n_lines;
    console.log('Rejecting paragraph of', P.B.logical_line_extent)
    return (n_lines >= P.B.logical_line_extent ? "reject" : "end");
}
