import { MarkdownParserTraits } from "../markdown-parser.js";
import { makeDelimiter } from "../delimiter-processing.js";
import { DelimiterTraits } from "../traits.js";
import { BlockContentIterator } from "../util.js";
import { MarkdownRendererTraits } from "../renderer/renderer.js";
import { InlineParsingContext } from "../inline-parsing-context.js";


export function makeDelimiterParser(delim_char: string, rex: RegExp) {
    return function (this: InlineParsingContext, It: BlockContentIterator) {
        /* Unlike CommonMark delimiters, strikethrough delimiters are one or two tildes BUT NOT MORE.
        * Since we're checking at every character position we have to look back if the current tilde is maybe just the end
        * of a longer sequence of tildes, which would not be a strikethrough delimiter.
        * An exception is \~~~, where the preceding tilde is escaped. But then again \\~~~ is not an escaped preceding tilde
        * because the backslash is itself escaped.
        */ 
        if(!It.isFirstOfSame(delim_char))
            return false;
        
        const rexres = It.regexInLine(rex);
        if(!rexres)
            return false;
        return makeDelimiter(It, rexres[1], 2);
    }
}


const strikethrough_delim_traits: DelimiterTraits = {
    name: "ext_gfm_strikethrough",
    startChars: ['~'],
    category: "emphStrict",
    parseDelimiter: makeDelimiterParser('~', /^(~~?)(?!~)/)
};



export function register_strikethrough(MDPT: MarkdownParserTraits, MDR?: MarkdownRendererTraits) {
    MDPT.inlineParser_standard.delims[strikethrough_delim_traits.name] = strikethrough_delim_traits;

    if(MDR)
        MDR.inlineHandlers.normal.delimHandlers[strikethrough_delim_traits.name] = (I, direction) => I.add(direction === "close" ? '</del>' : '<del>');
}
