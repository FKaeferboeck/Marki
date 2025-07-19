import { InlineElementTraits } from "../traits.js";

const rexEmailAutolink = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;


export const autolink_traits: InlineElementTraits<"autolink"> = {
    startChars: [ '<' ],

    parse(It, B) {
        let rexres = It.regexInLine(/^<([A-Za-z][A-Za-z\d+.\-]{1,31}):([^<>\x00-\x20]*)>/);
        if(rexres) {
            B.scheme = rexres[1];
            B.URI    = rexres[2];
            return true;
        }
        
        rexres = It.regexInLine(rexEmailAutolink);
        if(rexres) {
            B.email = rexres[1];
            return true;
        }
        
        return false;
    },

    defaultElementInstance: {
        type:   "autolink",
        scheme: '',
        URI:    ''
    }
};
