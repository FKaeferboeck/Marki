import { makeDelimiter, pairUpDelimiters, reassembleContent } from "../delimiter-processing.js";
import { InlineParser_Standard, InlineParser } from "../inline-parser.js";
import { InlinePos, InlineElement, Delimiter_nestable } from "../markdown-types.js";
import { DelimFollowerTraits, DelimiterTraits } from "../traits.js";
import { BlockContentIterator } from "../util.js";
import { acceptable, parseLinkDestination, referenceLinkExtra } from "./link.js";


export const bang_bracket_traits: DelimiterTraits = {
    name: "bang_bracket",
    startChars: ['!'],
    category: "emphLoose",

    parseDelimiter(It: BlockContentIterator) {
        It.pop(); // '!'
        if(It.pop() !== '[')
            return false;
        return makeDelimiter(It, '![', ']');
    }
};



export const image_traits: DelimFollowerTraits<"image"> = {
    startDelims: [ bang_bracket_traits.name ],
    contentOwner: true,

    parse(B, openingDelim: Delimiter_nestable, It: BlockContentIterator, startPos: InlinePos) {
        const ret = (B: InlineElement<"image"> | false) => {
            if(B === false)
                return false;
            pairUpDelimiters(B.linkLabelContents);
            return true;
        };

        B.linkLabelContents = this.getDelimitedContent(openingDelim);
        B.linkLabel = reassembleContent(B.linkLabelContents);
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
    
    creator(MDP) { return new InlineParser_Standard<"image">(MDP, this); },

    defaultElementInstance: {
        type:              "image",
        linkType:          "inline",
        linkLabelContents: [],
        linkLabel:         '',
        destination:       []
    }
};
