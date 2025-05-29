import { T } from "vitest/dist/chunks/environment.d.C8UItCbf.js";
import { makeDelimiter, reassembleContent } from "../delimiter-processing.js";
import { parseBackslashEscapes, InlineParser_Standard, InlineParser } from "../inline-parser.js";
import { InlinePos, InlineElement, Delimiter_nestable } from "../markdown-types.js";
import { DelimFollowerTraits, DelimiterTraits, InlineElementTraits } from "../traits.js";
import { BlockContentIterator, contentSlice, removeDelimiter } from "../util.js";
import { acceptable, untilSpaceOrStop } from "./link.js";


export const bang_bracket_traits: DelimiterTraits = {
    name: "bang_bracket",
    startChars: ['!'],
    category: "emphLoose",

    parseDelimiter(It: BlockContentIterator) {
        It.nextChar(); // '!'
        if(It.nextChar() !== '[')
            return false;
        return makeDelimiter('![', ']');
    }
};



export const image_traits: DelimFollowerTraits<"image"> = {
    startDelims: [ bang_bracket_traits.name ],

    parse(this: InlineParser<"image">, openingDelim: Delimiter_nestable, It: BlockContentIterator, startPos: InlinePos): InlineElement<"image"> | false {
        const B = this.B;
        B.linkLabelContents = this.getDelimitedContent(openingDelim);
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
            return (It.nextChar() === ')' && B);
        }

        if(c === '[') { // reference link, full or collapsed
            if(It.peekForward(1) === ']') {
                It.nextChar();
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
    
    creator(MDP) { return new InlineParser_Standard<"image">(MDP, this); },

    defaultElementInstance: {
        type:              "image",
        linkType:          "inline",
        linkLabelContents: [],
        linkLabel:         '',
        destination:       []
    }
};
