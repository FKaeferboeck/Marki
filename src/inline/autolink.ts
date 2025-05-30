import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";

const rexEmailAutolink = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;


export const autolink_traits: InlineElementTraits<"autolink"> = {
    startChars: [ '<' ],

    parse(It) {
        let rexres = It.regexInPart(/^<([A-Za-z][A-Za-z\d+.\-]{1,31}):([^<>\x00-\x20]*)>$/);
        if(rexres) {
            this.B.scheme = rexres[1];
            this.B.URI    = rexres[2];
            return this.B;
        }
        rexres = It.regexInPart(rexEmailAutolink);
        if(rexres) {
            this.B.email = rexres[1];
            return this.B;
        }
        return false;
    },
    
    creator(MDP) { return new InlineParser_Standard<"autolink">(MDP, this); },

    defaultElementInstance: {
        type:   "autolink",
        scheme: '',
        URI:    ''
    }
};
