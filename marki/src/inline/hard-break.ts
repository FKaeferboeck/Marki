import { InlineElementTraits } from "../traits.js";

/* For performance we want to avoid having to check for end-of-line spaces at each space (which usually isn't at the end of a line)
 * Therefore we trigger hard break detection at line breaks and backtrack whitespace from there
 */

export const hardBreak_traits: InlineElementTraits<"hardBreak"> = {
    startChars: [ '\n' ],

    parse(It, B, pos0) {
        let n = 0;
        // I. Backslashed hard break
        while(It.peekN(-(++n)) === '\\');
        if((n % 2) === 0) { // there was an odd number of backslashes, so we know (1) there is at least one and (2) the last one isn't backslash-escaped
            It.getPosition(pos0, -1);
            It.pop();
            B.nSpaces = false;
            return true;
        };
        for(n = 1;  It.peekN(-n) === ' ';  ++n);
        if(--n < /*2*/1)
            return false;
        It.getPosition(pos0, -n);
        It.pop();
        B.nSpaces = n;
        return true;
    },

    defaultElementInstance: {
        type:    "hardBreak",
        nSpaces: 0
    }
};



/* Normally line breaks are not parsed as inline elements unless they are deliberate hard breaks.
 * However we may need them for extensions, e.g. for tables (where they mark the end of a table row, naturally)
 */
export const lineBreak_traits: InlineElementTraits<"lineBreak"> = {
    startChars: [ '\n' ],
    parse(It) {
        It.pop();
        return true;
    },
    defaultElementInstance: { type: "lineBreak" }
};
