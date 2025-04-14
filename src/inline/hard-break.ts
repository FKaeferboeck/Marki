import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";


/* For performance we want to avoid having to check for end-of-line spaces at each space (which usually isn't at the end of a line)
 * Therefore we trigger hard break detection at line breaks and backtrack whitespace from there
 */

export const hardBreak_traits: InlineElementTraits<"hardBreak"> = {
    startChars: [ '\n' ],

    parse(It, pos0) {
        let n = 0;
        while(It.peekBack(++n) === ' ');
        if(--n < 2)
            return false;
        It.getPosition(pos0, -n);
        It.nextChar();
        return { type: "hardBreak" };
    },
    
    creator(MDP) { return new InlineParser_Standard<"hardBreak">(MDP, this); },

    defaultElementInstance: {
        type:    "hardBreak"
    }
};
