import { makeDelimiter, pairUpDelimiters, reassembleContent } from "../delimiter-processing.js";
import { InlineParser, InlineParser_Standard, parseBackslashEscapes } from "../inline-parser.js";
import { MarkdownParser } from "../markdown-parser.js";
import { AnyInline, Delimiter_nestable, InlineContent, InlineElement, InlineElementType, InlinePos } from "../markdown-types.js";
import { DelimFollowerTraits, DelimiterTraits } from "../traits.js";
import { BlockContentIterator, contentSlice, removeDelimiter } from "../util.js";


export function acceptable<T extends "link" | "image">(MDP: MarkdownParser, B: InlineElement<T>) {
    switch(B.linkType) {
    case "reference":
        {
            const L = MDP.findLinkDef(B.destination[0] as string); // TODO!! Improve!
            if(!L)    return false; // link not found
            B.reference = L;
            return B;
        }
    case "collapsed":
    case "shortcut":
        {
            const L = MDP.findLinkDef(B.linkLabel); // TODO!! Improve!
            if(!L)    return false; // link not found
            B.reference = L;
            return B;
        }
    default:
        return B;
    }
}


export function takeLinkDestination(It: BlockContentIterator, destination: AnyInline[]) {
    It.skip({ ' ': true,  '\n': true });
    const bracketed = It.regexInPart(/^<(?:\\[<>]|[^<>])*>/);
    if(bracketed)
        parseBackslashEscapes(bracketed[0].slice(1, -1), destination);
    else {
        if(It.peekChar() === '<')
            return false;
        const chkp = It.newCheckpoint();
        untilSpaceOrStop(It);
        const S = contentSlice(chkp, It.pos, true);
        if(!S)
            return false; // this should be impossible
        parseBackslashEscapes(S, destination);
    }
    //It.skip({ ' ': true,  '\n': true });
    return true;
}


export function takeLinkTitle(It: BlockContentIterator, linkTitle: AnyInline[]) {
    It.skipNobrSpace();
    const title = It.takeDelimited({ '"': '"',  '\'': '\'',  '(': ')' });
    if(!title)
        return false;
    parseBackslashEscapes(removeDelimiter(title), linkTitle);
    It.skip({ ' ': true,  '\n': true });
    return true;
}


export const containsElement = (C: InlineContent, t: InlineElementType) => C.some(elt => {
    if(typeof elt === "string")
        return false;
    // TODO!! Make recursive for indirect contains
    return (elt.type === t);
});



export const bracket_traits: DelimiterTraits = {
    name: "bracket",
    startChars: [ '[' ],
    category: "emphLoose",

    parseDelimiter(It: BlockContentIterator) {
        It.nextChar(); // '['
        return makeDelimiter('[', ']');
    }
};



export const link_traits: DelimFollowerTraits<"link"> = {
    startDelims: [ bracket_traits.name ],

    parse(this: InlineParser<"link">, openingDelim: Delimiter_nestable, It: BlockContentIterator, startPos: InlinePos): InlineElement<"link"> | false {
        const ret = (B: InlineElement<"link"> | false) => {
            if(B === false)
                return false;
            pairUpDelimiters(B.linkLabelContents);
            return B;
        };

        const B = this.B;
        B.linkLabelContents = this.getDelimitedContent(openingDelim);
        if(containsElement(B.linkLabelContents, "link"))
            return false;
        B.linkLabel = reassembleContent(B.linkLabelContents);

        let c = It.peekChar();
        if(c === "(") { // link destination present -> it is an inline link
            It.nextChar();
            It.skip({ ' ': true,  '\n': true });
            B.linkType = "inline";
            const bracketed = It.regexInPart(/^<(?:\\[<>]|[^<>])*>/);
            if(bracketed)
                parseBackslashEscapes(bracketed[0].slice(1, -1), B.destination);
            else {
                if(It.peekChar() === '<')
                    return false;
                const chkp = It.newCheckpoint();
                if(untilSpaceOrStop(It) === "invalid")
                    return false;
                parseBackslashEscapes(contentSlice(chkp, It.pos, true), B.destination);
                It.skip({ ' ': true,  '\n': true });
                const title = It.takeDelimited({ '"': '"',  '\'': '\'',  '(': ')' });
                if(title)
                    parseBackslashEscapes(removeDelimiter(title), B.linkTitle = []);
            }
            It.skip({ ' ': true,  '\n': true });
            return ret(It.nextChar() === ')' && B);
        }

        if(c === '[') { // reference link, full or collapsed
            if(It.peekForward(1) === ']') {
                It.nextChar();
                It.nextChar();
                B.linkType = "collapsed";
                return ret(acceptable(this.MDP, B));
            }
            const ref = It.takeDelimited({ '[': ']' });
            if(ref === false)
                return false;
            B.linkType = (ref ? "reference" : "collapsed");
            parseBackslashEscapes(removeDelimiter(ref), B.destination);
            return ret(acceptable(this.MDP, B));
        }

        // shortcut reference link
        B.linkType = "shortcut";
        return ret(acceptable(this.MDP, B));
    },
    
    creator(MDP) { return new InlineParser_Standard<"link">(MDP, this); },

    defaultElementInstance: {
        type:              "link",
        linkType:          "inline",
        linkLabelContents: [],
        linkLabel:         '',
        destination:       []
    }
};


export function untilSpaceOrStop(It: BlockContentIterator) {
    let c: false | string = false;
    let nesting = 1;
    while(true) {
        switch(c = It.peekChar()) {
        case '(':
            if(It.prevCharInPart() !== '\\')
                ++nesting;
            break;
        case ')':
            if(It.prevCharInPart() !== '\\')
                --nesting;
            if(nesting === 0)
                return "stop";
            break;
        case ' ':  case '\n':
            return (nesting === 1 ? "space" : "invalid");
        case false:  case '\t':
            return "invalid";
        }
        It.nextChar();
    }
}
