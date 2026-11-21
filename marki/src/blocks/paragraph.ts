import { BlockParser, BlockParser_Standard } from "../block-parser.js";
import { BlockContinuationType, BlockTraits } from "../traits.js";
import { setext_end_line } from "./sectionHeader_setext.js";
import { LogicalLine, LogicalLine_with_cmt } from "../linify.js";
import { MarkdownParserTraits } from "../markdown-parser.js";
import { BlockIndividualData } from "src/markdown-types.js";


export interface Paragraph { };

export type ParagraphStopper =
    (this: BlockParser<"paragraph">, LL: LogicalLine, isFristLineOfParagrapg: boolean, isSoftContainerContinuation: boolean) => BlockContinuationType | undefined;

export interface ParagraphTraits_Extra {
    paragraphStoppers: ParagraphStopper[];
}

type ParagraphTraits = BlockTraits<"paragraph", BlockIndividualData<"paragraph">, ParagraphTraits_Extra>;

type ParagraphParser = BlockParser<"paragraph", ParagraphTraits> & { lines_to_reject: number; };

export const paragraph_traits: ParagraphTraits = {
    blockType: "paragraph",

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
        for(const stopper of this.traits.paragraphStoppers) {
            const stop = stopper.call(this, LL, false, isSoftContainerContinuation || false);
            if(stop !== undefined)
                return stop;
        }
        return undefined;
    },

    startsHere(LL) {
        /* Paragraph stoppers can also apply in the first line already, in which case we can simply decline to start a paragraph. */
        for(const stopper of this.traits.paragraphStoppers) {
            const stop = stopper.call(this, LL, true, false);
            if(stop !== undefined)
                return -1;
        }
        return 0;
    },

    paragraphStoppers: [
        (LL, isFirst, isSoftContainerContinuation) => {
            /* By the philosophy of the parsing algorithm we should look for SETEXT headers before looking for a paragraph and
             * paragraphs shouldn't be aware that such a thing as a SETEXT header even exists.
             * However paragraphs are common and SETEXT headers are rare, so we would parse most markdown content twice, looking
             * for SETEXT headers that aren't there.
             * So as a small optimization we scan for paragraphs first and reject them if it would be a SETEXT header instead.
             */
            if(!isFirst && !isSoftContainerContinuation && setext_end_line(LL) > 0)
                return "reject";
        }
    ],

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
}


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
    return (n_lines >= P.B.logical_line_extent ? "reject" : "end");
}
