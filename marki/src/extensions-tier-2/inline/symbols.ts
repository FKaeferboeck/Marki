import { MarkdownParserTraits } from "../../markdown-parser.js";
import { ExtensionInlineElementType, InlineElement } from "../../markdown-types.js";
import { MarkdownRendererTraits } from "../../renderer/renderer.js";
import { InlineElementTraits } from "../../traits.js";


const name = "ext_tier2_special_symbol" as ExtensionInlineElementType;
type name_t = typeof name;


interface SpecialSymbol {
    type:   name_t;
    symbol: string;
    showAs: string;
}

export interface SpecialSymbol_ctx {
    specialSymbols: Record<string, [string, string][]>;
}

/* If you want to modify the list or add your own symbol substitutions, take the MarkdownParserTraits object you're using
   (e.g. global_MDPT) and do the following before instantiating MarkdownParserInstance:

   (global_MDPT as SpecialSymbol_ctx).specialSymbols['-'].splice(1, 0, ['->>', '&#x21A0;']); // for example
*/

const specialSymbols: SpecialSymbol_ctx["specialSymbols"] = {
    '!': [
        ['!=',   '&ne;']
    ],
    '-': [
        ['-->',  '&rarr;'],
        ['->',   '&rarr;']
    ],
    '<': [
        ['<-->', '&harr;'],
        ['<->',  '&harr;'],
        ['<==>', '&hArr;'],
        ['<==',  '&lArr;'],
        ['<=>',  '&hArr;'],
        ['<=',   '&le;'], // less-or-equal is more likely than left-facing double arrow
        ['<>',   '&ne;'], // SQL style inequality
        ['<--',  '&larr;'],
        ['<-',   '&larr;']
    ],
    '=': [
        ['==>',  '&#x21D2;'],
        ['=>',   '&#x21D2;']
    ],
    '>': [
        ['>=',   '&ge;']
    ]
}


const ext_tier2_special_symbol_traits: InlineElementTraits<name_t, SpecialSymbol & InlineElement<name_t>> = {
    startChars: function() { return Object.keys((this.globalCtx as SpecialSymbol_ctx).specialSymbols || {}); },

    parse(It, B) {
        const finder = (this.globalCtx as SpecialSymbol_ctx).specialSymbols || {};
        const candidates = finder[It.peek() as string];
        for(const s of candidates)
            if(It.startsWith(s[0], true)) {
                B.symbol = s[0];
                B.showAs = s[1];
                return true;
            }
        return false;
    },

    defaultElementInstance: {
        type:   name,
        symbol: '',
        showAs: ''
    }
};


export function register_SpecialSymbol(MDPT: MarkdownParserTraits, MDR?: MarkdownRendererTraits) {
    (MDPT.globalCtx as SpecialSymbol_ctx).specialSymbols = specialSymbols;
    MDPT.inlineParser_standard.traits[name] = ext_tier2_special_symbol_traits;

    if(MDR)
        MDR.elementHandlers[name] = function(elt, I) {
            const X = elt as InlineElement<name_t> & SpecialSymbol;
            I.add(X.showAs);
        };
}
