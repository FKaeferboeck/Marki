import { makeDelimiter, pairUpDelimiters, reassembleContent } from "../delimiter-processing.js";
import { parseBackslashEscapes } from "../inline-parser.js";
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
    const bracketed = It.regexInLine(/^<(?:\\[<>]|[^<>])*>/);
    if(bracketed)
        parseBackslashEscapes(bracketed[0].slice(1, -1), destination);
    else {
        if(It.peek() === '<')
            return false;
        const chkp = It.newPos();
        untilSpaceOrStop(It);
        const S = contentSlice(chkp, It.newPos(), true);
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
        It.pop(); // '['
        return makeDelimiter(It, '[', ']');
    }
};


export function parseLinkDestination(It: BlockContentIterator) {
    const X: {
        destination: AnyInline[];
        linkTitle?:  AnyInline[];
    } = { destination: [] };
    
    if(It.pop() !== '(')
        return false;

    It.skip({ ' ': true,  '\n': true });
    const bracketed = It.regexInLine(/^<(?:\\[<>]|[^<>])*>/);
    if(bracketed)
        parseBackslashEscapes(bracketed[0].slice(1, -1), X.destination);
    else {
        if(It.peek() === '<')
            return false;
        const chkp = It.newPos();
        if(untilSpaceOrStop(It) === "invalid")
            return false;
        parseBackslashEscapes(contentSlice(chkp, It.newPos(), true), X.destination);
        It.skip({ ' ': true,  '\n': true });
        const title = It.takeDelimited({ '"': '"',  '\'': '\'',  '(': ')' });
        if(title)
            parseBackslashEscapes(removeDelimiter(title), X.linkTitle = []);
    }
    It.skip({ ' ': true,  '\n': true });
    return (It.pop() === ')' && X);
}


export function referenceLinkExtra(It: BlockContentIterator) { // reference link, full or collapsed
    if(It.peek() !== '[')
        return false;
    let X: {
        linkType:    "collapsed" | "reference",
        destination: AnyInline[];
    } = { linkType: "collapsed",  destination: [] };

    if(It.peekN(1) === ']') {
        It.pop();
        It.pop();
        return X;
    }
    const ref = It.takeDelimited({ '[': ']' });
    if(ref === false)
        return false;
    X.linkType = (ref ? "reference" : "collapsed");
    ///*parseBackslashEscapes*/(removeDelimiter(ref), X.destination);
    X.destination = [ removeDelimiter(ref) ];
    return X;
}



export const link_traits: DelimFollowerTraits<"link"> = {
    startDelims: [ bracket_traits.name ],
    contentOwner: true,

    parse(B, openingDelim: Delimiter_nestable, It: BlockContentIterator, startPos: InlinePos) {
        const ret = (B: InlineElement<"link"> | false) => {
            if(B === false)
                return false;
            pairUpDelimiters(B.linkLabelContents);
            return true;
        };

        B.linkLabelContents = this.getDelimitedContent(openingDelim);
        if(containsElement(B.linkLabelContents, "link"))
            return false;
        B.linkLabel = reassembleContent(B.linkLabelContents, this);
        const cpt = It.newPos();

        if(It.peek() === '(') { // inline link
            const X = parseLinkDestination(It);
            if(X) {
                B.destination = X.destination;
                if(X.linkTitle)
                    B.linkTitle = X.linkTitle;
                B.linkType = "inline";
                return ret(B);
            }
            It.setPosition(cpt); // rewind
        }
        
        if(It.peek() === '[') { // reference link, full or collapsed
            const X = referenceLinkExtra(It);
            if(X) {
                B.linkType    = X.linkType;
                B.destination = X.destination;
                return ret(acceptable(this.MDP, B));
            }
            It.setPosition(cpt); // rewind
        }

        // shortcut reference link
        B.linkType = "shortcut";
        return ret(acceptable(this.MDP, B));
    },

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
        switch(c = It.peek()) {
        case '(':
            if(It.peekN(-1) !== '\\')
                ++nesting;
            break;
        case ')':
            if(It.peekN(-1) !== '\\')
                --nesting;
            if(nesting === 0)
                return "stop";
            break;
        case ' ':  case '\n':
            return (nesting === 1 ? "space" : "invalid");
        case false:  case '\t':
            return "invalid";
        }
        It.pop();
    }
}
