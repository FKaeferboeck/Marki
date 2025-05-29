import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";


/* For performance we want to avoid having to check for end-of-line spaces at each space (which usually isn't at the end of a line)
 * Therefore we trigger hard break detection at line breaks and backtrack whitespace from there
 */

export const hardBreak_traits: InlineElementTraits<"hardBreak"> = {
    startChars: [ '\n' ],

    parse(It, pos0) {
        let n = 0;
        // I. Backslashed hard break
        while(It.peekBack(++n) === '\\');
        if((n % 2) === 0) { // there was an odd number of backslashes, so we know (1) there is at least one and (2) the last one isn't backslash-escaped
            It.getPosition(pos0, -1);
            It.nextChar();
            this.B.nSpaces = false;
            return this.B;
        };
        for(n = 1;  It.peekBack(n) === ' ';  ++n);
        if(--n < /*2*/1)
            return false;
        It.getPosition(pos0, -n);
        It.nextChar();
        this.B.nSpaces = n;
        return this.B;
    },
    
    creator(MDP) { return new InlineParser_Standard<"hardBreak">(MDP, this); },

    defaultElementInstance: {
        type:    "hardBreak",
        nSpaces: 0
    }
};
