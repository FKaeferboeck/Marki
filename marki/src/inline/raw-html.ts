import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElement, InlinePos } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";
import { BlockContentIterator, contentSlice } from "../util.js";

const rex_tagname    = /^<\/?[A-Za-z][A-Za-z\d\-]*(?=$|[ \t\r\n\/>])/;
const rex_attribName = /^[A-Za-z_:][A-Za-z\d_:\.\-]*/;

function parseXML_element(It: BlockContentIterator, P0: InlinePos, B: InlineElement<"rawHTML">) {
    let rexres = It.regexInLine(rex_tagname);
    if(!rexres)
        return false;
    const closingTag = ((rexres as RegExpMatchArray)[0][1] === '/');

    if(!closingTag)
        while(It.regexInLine(true, rex_attribName)) {
            if(!It.regexInLine(false, /^=/, false))
                continue;
            const c = It.peek();
            if(c === '"' || c === '\'') {
                let c1 = It.pop();
                while((c1 = It.pop()) && c1 !== c) ;
                if(!c1)
                    return false; // end of input before attribute was closed
            }
            else if(!It.regexInLine(/^[^ \t\r\n"'=<>`]+/)) // unquoted attribute value (can be parsed by a single regex because it may not contain line breaks)
                return false;
        }

    const arr = It.regexInLine(false, closingTag ? /^>/ : /^\/?>/);
    if(!arr)
        return false;

    B.tag      = contentSlice(P0, It.newPos(), true);
    B.XML_type = (closingTag ? "tag_close" : (arr[1] as RegExpMatchArray)[0].length > 1 ? "tag_selfclosed" : "tag");
    return true;
}



export const rawHTML_traits: InlineElementTraits<"rawHTML"> = {
    startChars: [ '<' ],

    parse(It, B, P0) {
        const c = It.peekN(1);
        if(c === '?') { // a processing instruction
            let c1 = It.pop(); // skip <
            It.pop(); // skip ?
            while((c1 = It.pop())) {
                if(c1 === '?' && It.peek() === '>') {
                    It.pop();
                    B.tag      = contentSlice(P0, It.newPos(), true);
                    B.XML_type = "processingInstruction";
                    return true;
                }
            }
            return false;
        }

        if(c === '!' && It.regexInLine(/^<!\[CDATA\[/)) { // a CDATA section
            let c1: string | false = false;
            while((c1 = It.pop())) {
                if(c1 === ']' && It.peek() === ']' && It.peekN(1) === '>') {
                    It.pop();
                    It.pop();
                    B.tag      = contentSlice(P0, It.newPos(), true);
                    B.XML_type = "CDATA";
                    return true;
                }
            }
            return false;
        }

        /* Caution! The following behavior follows the CommonMark standard, but it is wrong by the XML/HTML specification!
         * In other words, there's an error in CommonMark.
         * We will fix it with Marki extension tier 1, which departs from CommonMark in a few areas.
         */
        if(c === '!' && It.regexInLine(/^<!--/)) { // an XML comment
            It.unpop();  It.unpop(); // This allows <!--> to be a comment, which in XML it isn't!
            let c1: string | false = false;
            while((c1 = It.pop())) {
                if(c1 === '-' && It.peek() === '-' && It.peekN(1) === '>') {
                    It.pop();
                    It.pop();
                    B.tag      = contentSlice(P0, It.newPos(), true);
                    B.XML_type = "XML_comment";
                    return true;
                }
            }
            return false;
        }

        if(c === '!' && It.regexInLine(/^<![A-Za-z]/)) { // a declaration
            let c1: string | false = false;
            while((c1 = It.pop())) {
                if(c1 === '>') {
                    B.tag      = contentSlice(P0, It.newPos(), true);
                    B.XML_type = "declaration";
                    return true;
                }
            }
            return false;
        }

        return parseXML_element(It, P0, B);
    },
    
    creator(MDP) { return new InlineParser_Standard<"rawHTML">(MDP, this); },

    defaultElementInstance: {
        type:     "rawHTML",
        XML_type: "tag",
        tag:      ''
    }
};
