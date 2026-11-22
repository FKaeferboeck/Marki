import { MarkdownParserTraits } from "../../markdown-parser.js";
import { DelimiterTraits } from "../../traits.js";
import { MarkdownRendererTraits } from "../../renderer/renderer.js";
import { makeDelimiterParser } from "../../gfm/strikethrough.js";

/* This adds another type of stronger emphasis, which is written !!like this!!
 * It is rendered as <span>s with a CSS class, so you can style it as you like (e.g. bold in color)
 */

const hardEmphasis_delim_traits: DelimiterTraits = {
    name: "ext_tier1_hardEmphasis",
    startChars: ['!'],
    category: "emphStrict",
    parseDelimiter: makeDelimiterParser('!', /^(\!\!?)(?!\!)/)
};


export function register_hardEmphasis(MDPT: MarkdownParserTraits, MDR?: MarkdownRendererTraits) {
    MDPT.inlineParser_standard.delims[hardEmphasis_delim_traits.name] = hardEmphasis_delim_traits;

    if(MDR)
        MDR.inlineHandlers.normal.delimHandlers[hardEmphasis_delim_traits.name] =
            (I, direction) => I.add(direction === "close" ? '</span>' : '<span class="hardEmphasis">');
}
