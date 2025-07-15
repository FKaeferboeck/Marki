import { makeDelimiter } from "../../delimiter-processing.js";
import { MarkdownParserTraits } from "../../markdown-parser.js";
import { InlineElement } from "../../markdown-types.js";
import { Inserter, Renderer } from "../../renderer/renderer.js";
import { DelimFollowerTraits, DelimiterTraits } from "../../traits.js";
import { BlockContentIterator } from "../../util.js";


interface CustomStyling {
    type:       "ext_tier2_custom_styling";
    styleClass: string;
}


export const ext_tier2_custom_styling_delim: DelimiterTraits = {
    name: "ext_tier2_custom_styling_delim",
    startChars: ['$'],
    category: "emphLoose",

    parseDelimiter(It: BlockContentIterator) {
        It.pop(); // '$'
        if(It.pop() !== 'c')
            return false;
        const rexres = It.regexInLine(/^[A-Za-z\d_\-]+\{/);
        if(!rexres)
            return false;

        return makeDelimiter(It, '$c' + rexres[0], '}');
    }
};


export const ext_tier2_custom_styling_traits: DelimFollowerTraits<"ext_tier2_custom_styling", InlineElement<"ext_tier2_custom_styling"> & CustomStyling> = {
    startDelims: [ ext_tier2_custom_styling_delim.name ],
    contentOwner: false,

    parse(B, openingDelim)
    {
        B.styleClass = openingDelim.delim.slice(2, -1);
        //pairUpDelimiters(B.linkLabelContents);
        return true;
    },

    defaultElementInstance: {
        type:       "ext_tier2_custom_styling",
        styleClass: ''
    }
};


export function register(MDPT: MarkdownParserTraits, MDR?: Renderer) {
    MDPT.inlineParser_standard.delims['ext_tier2_custom_styling_delim'] = ext_tier2_custom_styling_delim;
    MDPT.inlineParser_standard.traits['ext_tier2_custom_styling'] = ext_tier2_custom_styling_traits;
    MDPT.inlineParser_standard.makeStartCharMap();

    if(MDR)
        MDR.inlineHandler["ext_tier2_custom_styling"] = function(elt, I: Inserter, data, i, closing?: boolean) {
            const X = elt as InlineElement<"ext_tier2_custom_styling"> & CustomStyling;
            if(closing)
                I.add(`</span>`);
            else
                I.add(`<span class="style-${X.styleClass}">`);
        };
}
