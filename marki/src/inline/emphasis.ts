import { makeDelimiter } from "../delimiter-processing.js";
import { DelimiterTraits } from "../traits.js";
import { BlockContentIterator } from "../util.js";

function parseDelimiter(It: BlockContentIterator) {
    const delim_char = It.pop();
    if(It.peekN(-2) === delim_char)
        return false;
    if(!delim_char) // impossible, we checked the startChar right before this
        return false;
    let delim_size = 1;
    while (It.peek() === delim_char) {
        ++delim_size;
        It.pop();
    }
    return makeDelimiter(It, delim_char.repeat(delim_size), delim_size);
}


export const emphasis_traits_asterisk: DelimiterTraits = {
    name: "emph_asterisk",
    startChars: ['*'],
    category: "emphLoose",
    parseDelimiter
};

export const emphasis_traits_underscore: DelimiterTraits = {
    name: "emph_underscore",
    startChars: ['_'],
    category: "emphStrict",
    parseDelimiter
};
