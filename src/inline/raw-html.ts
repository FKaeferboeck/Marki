import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";
import { contentSlice, sliceLLD } from "../util.js";

const rex_tagname    = /^<\/?[A-Za-z][A-Za-z\d\-]*(?=$|[ \t\r\n\/>])/;
const rex_attribName = /^[ \t\r\n]*[A-Za-z_:][A-Za-z\d_:\.\-]*[ \t\r\n]*=[ \t\r\n]*/


export const rawHTML_traits: InlineElementTraits<"rawHTML"> = {
    startChars: [ '<' ],

    parse(It, P0) {
        let rexres = It.regexInPart(rex_tagname);
        if(!rexres)
            return false;
        const closingTag = (rexres[0][1] === '/');

        while(It.regexInPart(rex_attribName)) {
            if(!It.regexInPart(/^[^ \t\r\n"'=<>`]+|^'[^']*'|^"[^"]"/)) // attribute value
                return false;
        }

        if(!It.regexInPart(closingTag ? /^[ \t\r\n]*?>/ : /^[ \t\r\n]*\/?>/))
            return false;

        this.B.tag = contentSlice(P0, It.newCheckpoint(), true);
        return this.B;
    },
    
    creator(MDP) { return new InlineParser_Standard<"rawHTML">(MDP, this); },

    defaultElementInstance: {
        type: "rawHTML",
        tag:  ''
    }
};
