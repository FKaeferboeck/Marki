import { ParsingContext } from "./block-parser.js";
import { InlineParsingContext } from "./inline-parsing-context.js";
import { Delimiter_emph, Delimiter, InlinePos, InlineContent, InlineContentElement, DelimiterSide, Delimiter_nestable, isNestableDelimiter } from "./markdown-types.js";
import { renderInline } from "./renderer/inline-renderer.js";
import { getInlineRenderer_reassemble } from "./renderer/utility-renderers.js";
import { DelimiterTraits } from "./traits.js";
import { BlockContentIterator } from "./util.js";

const rex_whitespace = /^\s$/;
const rex_special = /^[\s\p{P}\p{S}]$/u;


function checkEmphDelimiterContext(D: Delimiter_emph, T: DelimiterTraits, It: BlockContentIterator) {
    let c = It.peekN(-(D.delim.length + 1));
    const white_before   = (!c || rex_whitespace.test(c)),
          special_before = (!c || rex_special.test(c));

    c = It.peek();
    const white_after   = (!c || rex_whitespace.test(c)),
          special_after = (!c || rex_special.test(c));

    /*  aaa_bbb_   // left_flanking === true, right_flanking === true
     *  aaa._bbb_  // left_flanking === true, right_flanking === false -> opening
     *  aaa._.bbb_ // left_flanking === true, right_flanking === "._." -> opening
     */

    const left_flanking  = (!white_after  && (!special_after  || (special_before && "._.")));
    const right_flanking = (!white_before && (!special_before || (special_after  && "._.")));
    if(!(left_flanking || right_flanking))
        return false;

    let opening: boolean = !!left_flanking;
    if(opening && T.category === "emphStrict")
        opening = (right_flanking !== true); // false or "._."

    let closing: boolean = !!right_flanking;
    if(closing && T.category === "emphStrict")
        closing = (left_flanking !== true); // false or "._."

    if(!(opening || closing))
        return false;

    if(opening)
        D.opening = { active: true };
    if(closing)
        D.closing = { active: true };
    return true;
}


export function parseDelimiter(context: InlineParsingContext, It: BlockContentIterator, checkpoint1: InlinePos, T: DelimiterTraits, toClose: Delimiter_nestable | undefined,) {
    let delim: false | Delimiter = false;
    if(toClose) {
        let endDelim: string | false = false;
        if(!T.parseCloser) {
            // skip the closing delimiter (it's assumed to be a single character when parseCloser() is not defined)
            if(!(endDelim === false || endDelim === '\n')) // EOL delimiters don't get consumed as end delimiters unless we really want to via parseCloser()
                endDelim = It.pop();
        } else if(!(endDelim = T.parseCloser(It, checkpoint1)))
            return false;
        // opening and closing delimiter get double-linked
        delim = {
            type:         toClose.type,
            delim:        endDelim || '',
            isOpener:     false,
            partnerDelim: toClose,
            active:       true,
            endPos:       It.relativePos()
        };
        toClose.partnerDelim = delim;
    }
    else
        delim = T.parseDelimiter.call(context, It, checkpoint1);

    if(!delim)
        return false;
    delim.type = T.name;
    if(!isNestableDelimiter(delim) && !checkEmphDelimiterContext(delim, T, It))
        return false;
    return delim;
}


export function makeDelimiter(It: BlockContentIterator, delim: string, expected_end_delim: string | number): Delimiter {
    if(typeof expected_end_delim === "string")
        return {
            type: '?',
            delim,  endDelimStartChar: expected_end_delim,
            isOpener: true,  active: true,
            endPos: It.relativePos()
        };
    else
        return {
            type: '?',
            delim,
            remaining: expected_end_delim,
            endPos: It.relativePos()
        };
}


const isEmphDelim = (elt: InlineContentElement): elt is Delimiter_emph => (typeof elt === "object" && "delim" in elt && !("endDelim" in elt));

function rule9allows(D0: Delimiter_emph, D1: Delimiter_emph) {
    /* CommonMark: If one of the delimiters can both open and close emphasis, then the sum of the lengths of the delimiter runs containing
     *             the opening and closing delimiters must not be a multiple of 3 unless both lengths are multiples of 3. */
    if(!((D0.opening && D0.closing) || (D1.opening && D1.closing)))
        return true;
    const n0 = D0.delim.length,  n1 = D1.delim.length;
    return (((n0 + n1) % 3) !== 0 || (n0 % 3) + (n1 % 3) === 0);
}


export function pairUpDelimiters(content: InlineContent) {
    const N = content.length;
    let stack_bottom = 0, curPos = 0;

    while(true) {
        /* CommonMark: Move current_position forward in the delimiter stack (if needed) until we find the first potential closer with delimiter * or _.
         *             (This will be the potential closer closest to the beginning of the input – the first one in parse order.) */
        for(; curPos < N;  ++curPos) {
            const elt = content[curPos];
            if(isEmphDelim(elt) && elt.closing?.active && elt.remaining > 0)
                break;
        }
        if(curPos >= N) // no further closing delimiter exists
            return;

        /* CommonMark: Now, look back in the stack (staying above stack_bottom and the openers_bottom for this delimiter type)
         *             for the first matching potential opener (“matching” means same delimiter). */
        const D1 = content[curPos] as Delimiter_emph & { closing: DelimiterSide; };
        const n1 = D1.delim.length;
        let i_opener = curPos - 1;
        for(;  i_opener >= stack_bottom;  --i_opener) {
            const elt = content[i_opener];
            if(isEmphDelim(elt) && elt.opening?.active && elt.type === D1.type && elt.remaining > 0 && rule9allows(elt, D1))
                break;
        }
        if(i_opener < stack_bottom) {
            D1.closing.active = false; // this closer has no matching opener -> discard it as closer (but it may still be used as an opener)
            continue;
        }
        const D0 = content[i_opener] as Delimiter_emph & { opening: DelimiterSide; };

        /* CommonMark: Figure out whether we have emphasis or strong emphasis: if both closer and opener spans have length >= 2, we have strong, otherwise regular. */
        const isStrong = Math.min(D1.remaining, D0.remaining, 2); // 1 or 2

        /* Insert an emph or strong emph node accordingly, after the text node corresponding to the opener. */
        (D0.opening.actualized ||= []).splice(0, 0, isStrong);
        (D1.closing.actualized ||= []).push(isStrong);

        /* CommonMark: Remove any delimiters between the opener and closer from the delimiter stack. */
        // For the reason why this is relevant see CommonMark examples (469) and (470).
        while(++i_opener < curPos) {
            let D = content[i_opener];
            if(isEmphDelim(D)) {
                if(D.opening)
                    D.opening.active = false;
                if(D.closing)
                    D.closing.active = false;
            }
        }

        /* CommonMark: Remove 1 (for regular emph) or 2 (for strong emph) delimiters from the opening and closing text nodes.
         *             If they become empty as a result, remove them and remove the corresponding element of the delimiter stack.
         *             If the closing node is removed, reset current_position to the next element in the stack. */
        D0.remaining -= isStrong;
        D1.remaining -= isStrong;
    }
}


export const reassembleContent = (C: InlineContent, ctx: ParsingContext) =>
    renderInline(C, getInlineRenderer_reassemble(ctx));
