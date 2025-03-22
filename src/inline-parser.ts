
import { codeSpan_traits } from "./inline/code-span.js";
import { MarkdownParser } from "./markdown-parser.js";
import { ExtensionInlineElementType, InlineElement, InlineElementType } from "./markdown-types.js";
import { InlineElementTraits, InlineParserTraitsList } from "./traits.js";
import { BlockContentIterator } from "./util.js";


export const standardInlineParserTraits: InlineParserTraitsList = {
	codeSpan: codeSpan_traits
};



export interface InlineParser<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;

    // guarantee: if an element is successfully parsed, It will afterwards point behind it
    //            if it cannot be parsed here, It will be at the same start position it was in before (though the checkpoint may have been changed)
    parse(It: BlockContentIterator): InlineElement<K> | false;

    MDP: MarkdownParser;
}


export class InlineParser_Standard<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;

    constructor(MDP: MarkdownParser, traits: InlineElementTraits<K>) {
        this.type   = traits.defaultElementInstance.type as K;
        this.MDP    = MDP;
        this.traits = traits;
    }

    parse(It: BlockContentIterator) {
        const pos0 = { ... It.pos };
        const elt = this.traits.parse(It, pos0);
        if(!elt)
            It.setPosition(pos0); // rewind position
        return elt;
    }

    MDP: MarkdownParser;
    traits: InlineElementTraits<K>;
}
