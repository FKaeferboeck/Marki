import { InlineParser_Standard, parseBackslashEscapes } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";
import { BlockContentIterator, contentSlice, removeDelimiter } from "../util.js";


export const link_traits: InlineElementTraits<"link"> = {
    startChars: [ '[' ],

    parse(It) {
        if(It.nextChar() !== '[')
            return false;
        const B = this.B;
        if(this.MDP.inlineParseLoop(It, B.linkText, (_It, c) => (c === ']')) === "EOF")
            return false;
        It.nextChar(); // skip ']'

        let c = It.nextItem();
        if(c === "(") { // link destination present -> it is an inline link
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
            if(It.peekChar() === ']') {
                It.nextChar();
                B.linkType = "collapsed";
                return B;
            }
            const ref = It.takeDelimited({ '[': ']' });
            if(ref === false)
                return false;
            B.linkType = (ref ? "reference" : "collapsed");
            parseBackslashEscapes(removeDelimiter(ref), B.destination);
            return B;
        }

        // shortcut reference link
        B.linkType = "shortcut";
        return B;
    },
    
    creator(MDP) { return new InlineParser_Standard<"link">(MDP, this); },

    defaultElementInstance: {
        type:        "link",
        linkType:    "inline",
        linkText:    [],
        destination: []
    }
};



function untilSpaceOrStop(It: BlockContentIterator) {
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
