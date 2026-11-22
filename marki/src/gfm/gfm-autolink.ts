import { ExtensionInlineElementType, InlineElement, InlineElementBase } from "../markdown-types.js";
import { InlineEltTraits_ } from "../traits.js";
import { BlockContentIterator } from "../util.js";
import { MarkdownParserTraits } from "../markdown-parser.js";
import { Inserter, MarkdownRendererTraits } from "../renderer/renderer.js";
import { escapeXML } from "../renderer/util.js";

export const name_gfm_autolink = "ext_gfm_autolink" as ExtensionInlineElementType;
type name_gfm_autolink_t = typeof name_gfm_autolink;

//const rexEmailAutolink = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;

interface GFM_Autolink {
    scheme: "http" | "https" | "mailto" | "xmpp" | "email" | null;
    URI: string;
    xmpp_resource?: string;
}


export const gfm_autolink_traits: InlineEltTraits_<name_gfm_autolink_t, GFM_Autolink & InlineElement<name_gfm_autolink_t>> = {
    startChars: [ 'h', 'm', 'w', 'x', '@' ],

    parse(It, B, P0_) {
        const c0 = It.peek();
        let P0 = { ... P0_  };
        if(c0 === '@') {
            // '@' appears in the middle of an email address, so we rewind to find the beginning
            let c: string | false = false;
            let found = false;
            for(c = It.peekN(-1);  typeof c === "string" && /^[a-zA-Z\d.\-_+]/.test(c);  c = It.peekN(-1)) {
                It.unpop();
                found = true;
            }
            if(!found)
                return false;
            P0 = It.newPos();
        }
        // TODO!! check preconditions!

        let rexres: false | RegExpMatchArray = false;
        switch(c0) {
        case 'h':
            rexres = It.regexInLine(/^https?:\/\//);
            if(!rexres)
                return false;
            if(!takeURL(It, B))
                return false;
            B.scheme = (rexres[0].startsWith('https') ? "https" : "http");
            return true;

        case 'w':
            if(!It.startsWith('www.', false))
                return false;
            return takeURL(It, B);

        case 'm':
        case 'x':
            if(!(rexres = It.regexInLine(/^(?:mailto|xmpp):/)))
                return false;
            if(!takeEmail(It, B))
                return false;
            B.scheme = (rexres[0].startsWith('mailto') ? "mailto" : "xmpp");
            if(B.scheme === "xmpp" && It.peek() === '/') { // xmpp resource
                if(rexres = It.regexInLine(/^\/[a-zA-Z\d@\.]+/))
                    B.xmpp_resource = rexres[0];
            }
            return true;

        case '@':
            if(!takeEmail(It, B))
                return false;
            P0_.char_idx = P0.char_idx;
            return true;

        default:
            return false; // unreachable because of the startChars condition
        } // switch
    },

    defaultElementInstance: {
        type:   name_gfm_autolink,
        scheme: null,
        URI:    ''
    }
};


function takeURL(It: BlockContentIterator, B: GFM_Autolink) {
    let rexres = It.regexInLine(/^([\w\-]+(?:\.[\w\-]+)+)([^\s<]*)/);
    if(!rexres)
        return false;

    // no underscore is allowed in the last two segments:
    const segments = rexres[1].split('.'); // by the regex there is at least one non-null segment
    const n = segments.length;
    if(segments[n - 1].indexOf('_') >= 0 || (n > 1 && segments[n - 2].indexOf('_') >= 0))
        return false;

    // extended autolink path validation:
    // 1) remove trailing punctuation and trailing entity ref lookalikes
    let rewind = 0;
    let url = rexres[0];
    if(rexres = /(?:&[a-zA-Z\d]+;|[?!.,:*_~])+$/.exec(url) || false) {
        rewind = rexres[0].length;
        url = url.slice(0, url.length - rewind);
    }
    // 2) match up closing parentheses
    if(url.endsWith(')')) {
        const count = { "(": 0,  ")": 0 };
        for(const c of url) {
            if(c === '(' || c === ')')
                ++count[c];
        }
        for(let strippable = count[")"] - count["("]; // number of closing parentheses that could be removed
            strippable > 0 && url.endsWith(')');  --strippable)
        {
            url = url.slice(0, url.length - 1);
            ++rewind;
        }
    }

    while(rewind-- > 0)
        It.unpop();
    B.URI = url;
    return true;
}


function takeEmail(It: BlockContentIterator, B: GFM_Autolink) {
    const rexres = It.regexInLine(/^[a-zA-Z\d.\-_+]+@[a-zA-Z\d\-_]+(?:\.[a-zA-Z\d\-_]+)+/);
    if(!rexres)
        return false;
    const email = rexres[0];
    const c = email[email.length - 1];
    if(c === '-' || c === '_')
        return false;
    B.URI    = email;
    B.scheme = "email";
    return true;
}


function gfm_autolink_render(elt: InlineElementBase<`ext_${string}_${string}`>, I: Inserter) {
    const X = elt as GFM_Autolink & InlineElement<name_gfm_autolink_t>;
    let prefix = 'http://',  prefix_display = '';
    switch(X.scheme) {
    case "email":
        prefix = 'mailto:';    break;
    case "mailto":
    case "xmpp":
        prefix_display = prefix = X.scheme + ':';    break;
    case "http":
    case "https":
        prefix_display = prefix = X.scheme + '://';    break;
    }
    const URI = escapeXML(`${X.URI}${X.xmpp_resource || ''}`);
    I.add(`<a href="${prefix}${URI}">${prefix_display}${URI}</a>`);
}


export function register_gfm_autolink(MDPT: MarkdownParserTraits, MDRT?: MarkdownRendererTraits) {
    MDPT.inlineParser_standard.traits[name_gfm_autolink] = gfm_autolink_traits;
    if(MDRT)
        MDRT.elementHandlers[name_gfm_autolink] = gfm_autolink_render;
}
