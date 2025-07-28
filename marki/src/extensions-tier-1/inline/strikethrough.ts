import { MarkdownParserTraits } from "src/markdown-parser.js";
import { makeDelimiter } from "../../delimiter-processing.js";
import { DelimiterTraits } from "../../traits.js";
import { BlockContentIterator } from "../../util.js";
import { MarkdownRendererTraits } from "../../renderer/renderer.js";


function parseDelimiter(It: BlockContentIterator) {
    const delim_char = It.pop();
    if(It.peekN(-2) === delim_char)
        return false;
    if(!delim_char) // impossible, we checked the startChar right before this
        return false;
    if(It.pop() != '~') // second char of ~~
        return false;
    return makeDelimiter(It, '~~', 2);
}


const strikethrough_delim_traits: DelimiterTraits = {
    name: "ext_tier1_strikethrough",
    startChars: ['~'],
    category: "emphStrict",
    parseDelimiter
};



export function register_strikethrough(MDPT: MarkdownParserTraits, MDR?: MarkdownRendererTraits) {
    MDPT.inlineParser_standard.delims[strikethrough_delim_traits.name] = strikethrough_delim_traits;

    if(MDR)
        MDR.delimHandlers[strikethrough_delim_traits.name] = (I, direction) => I.add(direction === "close" ? '</s>' : '<s>');
}
