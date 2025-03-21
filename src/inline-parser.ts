
import { codeSpan_traits } from "./inline/code-span";
import { MarkdownParser } from "./markdown-parser";
import { ExtensionInlineElementType, InlineElementType } from "./markdown-types";
import { InlineElementTraits, InlineParserTraitsList } from "./traits";


export const standardInlineParserTraits: InlineParserTraitsList = {
	codeSpan: codeSpan_traits
};



export interface InlineParser<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;

    MDP: MarkdownParser;
}


export class InlineParser_Standard<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;

    constructor(MDP: MarkdownParser, traits: InlineElementTraits<K>) {
        this.type = traits.defaultElementInstance.type as K;
        this.MDP  = MDP;
    }

    MDP: MarkdownParser;
}
