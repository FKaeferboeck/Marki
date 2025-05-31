import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElement, InlinePos } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";
import { BlockContentIterator, contentSlice } from "../util.js";

const rex_tagname    = /^<\/?[A-Za-z][A-Za-z\d\-]*(?=$|[ \t\r\n\/>])/;
const rex_attribName = /^[A-Za-z_:][A-Za-z\d_:\.\-]*/;

function parseXML_element(It: BlockContentIterator, P0: InlinePos, B: InlineElement<"rawHTML">) {
    let rexres = It.regexInPart(rex_tagname);
    if(!rexres)
        return false;
    const closingTag = ((rexres as RegExpMatchArray)[0][1] === '/');

    if(!closingTag)
        while(It.regexInPart(true, rex_attribName)) {
            if(!It.regexInPart(false, /^=/, false))
                continue;
            const c = It.peekChar();
            if(c === '"' || c === '\'') {
                let c1 = It.nextChar();
                while((c1 = It.nextChar()) && c1 !== c) ;
                if(!c1)
                    return false; // end of input before attribute was closed
            }
            else if(!It.regexInPart(/^[^ \t\r\n"'=<>`]+/)) // unquoted attribute value (can be parsed by a single regex because it may not contain line breaks)
                return false;
        }

    const arr = It.regexInPart(false, closingTag ? /^>/ : /^\/?>/);
    if(!arr)
        return false;

    B.tag      = contentSlice(P0, It.newCheckpoint(), true);
    B.XML_type = (closingTag ? "tag_close" : (arr[1] as RegExpMatchArray)[0].length > 1 ? "tag_selfclosed" : "tag");
    return true;
}



export const rawHTML_traits: InlineElementTraits<"rawHTML"> = {
    startChars: [ '<' ],

    parse(It, P0) {
        const c = It.peekForward(1);
        if(c === '?') { // a processing instruction
            let c1 = It.nextChar(); // skip <
            It.nextChar(); // skip ?
            while((c1 = It.nextChar())) {
                if(c1 === '?' && It.peekChar() === '>') {
                    It.nextChar();
                    this.B.tag      = contentSlice(P0, It.newCheckpoint(), true);
                    this.B.XML_type = "processingInstruction";
                    return this.B;
                }
            }
            return false;
        }

        if(c === '!' && It.regexInPart(/^<!\[CDATA\[/)) { // a CDATA section
            let c1: string | false = false;
            while((c1 = It.nextChar())) {
                if(c1 === ']' && It.peekChar() === ']' && It.peekForward(1) === '>') {
                    It.nextChar();
                    It.nextChar();
                    this.B.tag      = contentSlice(P0, It.newCheckpoint(), true);
                    this.B.XML_type = "CDATA";
                    return this.B;
                }
            }
            return false;
        }

        if(c === '!' && It.regexInPart(/^<![A-Za-z]/)) { // a declaration
            let c1: string | false = false;
            while((c1 = It.nextChar())) {
                if(c1 === '>') {
                    this.B.tag      = contentSlice(P0, It.newCheckpoint(), true);
                    this.B.XML_type = "declaration";
                    return this.B;
                }
            }
            return false;
        }

        const X = parseXML_element(It, P0, this.B);
        return (X && this.B);
    },
    
    creator(MDP) { return new InlineParser_Standard<"rawHTML">(MDP, this); },

    defaultElementInstance: {
        type:     "rawHTML",
        XML_type: "tag",
        tag:      ''
    }
};
