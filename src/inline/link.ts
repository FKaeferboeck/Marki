import { InlineParser_Standard, parseBackslashEscapes } from "../inline-parser.js";
import { MarkdownParser } from "../markdown-parser.js";
import { AnyInline, InlineElement } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";
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


export const link_traits: InlineElementTraits<"link"> = {
    startChars: [ '[' ],

    parse(It) {
        if(It.peekChar() !== '[')
            return false;
        const B = this.B;

        const label = It.takeDelimited({ '[': ']' });
        if(!label)
            return false;
        this.B.linkLabel = label.slice(1, -1);

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
            return (It.nextChar() === ')' && B);
        }

        if(c === '[') { // reference link, full or collapsed
            It.nextChar();
            if(It.peekChar() === ']') {
                It.nextChar();
                B.linkType = "collapsed";
                return acceptable(this.MDP, B);
            }
            const ref = It.takeDelimited({ '[': ']' });
            if(ref === false)
                return false;
            B.linkType = (ref ? "reference" : "collapsed");
            parseBackslashEscapes(removeDelimiter(ref), B.destination);
            return acceptable(this.MDP, B);
        }

        // shortcut reference link
        B.linkType = "shortcut";
        return acceptable(this.MDP, B);
    },
    
    creator(MDP) { return new InlineParser_Standard<"link">(MDP, this); },

    defaultElementInstance: {
        type:        "link",
        linkType:    "inline",
        linkLabel:   '',
        destination: []
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
