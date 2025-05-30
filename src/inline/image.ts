import { T } from "vitest/dist/chunks/environment.d.C8UItCbf.js";
import { makeDelimiter, pairUpDelimiters, reassembleContent } from "../delimiter-processing.js";
import { parseBackslashEscapes, InlineParser_Standard, InlineParser } from "../inline-parser.js";
import { InlinePos, InlineElement, Delimiter_nestable } from "../markdown-types.js";
import { DelimFollowerTraits, DelimiterTraits } from "../traits.js";
import { BlockContentIterator, contentSlice, removeDelimiter } from "../util.js";
import { acceptable, containsElement, parseLinkDestination, referenceLinkExtra, untilSpaceOrStop } from "./link.js";


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
        const ret = (B: InlineElement<"image"> | false) => {
            if(B === false)
                return false;
            pairUpDelimiters(B.linkLabelContents);
            return B;
        };

        const B = this.B;
        B.linkLabelContents = this.getDelimitedContent(openingDelim);
        B.linkLabel = reassembleContent(B.linkLabelContents);
        const cpt = It.newCheckpoint();

        if(It.peekChar() === '(') { // inline link
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
        
        if(It.peekChar() === '[') { // reference link, full or collapsed
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
    
    creator(MDP) { return new InlineParser_Standard<"image">(MDP, this); },

    defaultElementInstance: {
        type:              "image",
        linkType:          "inline",
        linkLabelContents: [],
        linkLabel:         '',
        destination:       []
    }
};
