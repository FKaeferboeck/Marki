
import { codeSpan_traits } from "./inline/code-span.js";
import { link_traits } from "./inline/link.js";
import { MarkdownParser } from "./markdown-parser.js";
import { AnyInline, ExtensionInlineElementType, InlineElement, InlineElementType } from "./markdown-types.js";
import { InlineElementTraits, InlineParserTraitsList } from "./traits.js";
import { BlockContentIterator } from "./util.js";
import entityList from "./htmlEntities.json";


export const standardInlineParserTraits: InlineParserTraitsList = {
	codeSpan: codeSpan_traits,
    link:     link_traits
};



export interface InlineParser<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;

    // guarantee: if an element is successfully parsed, It will afterwards point behind it
    //            if it cannot be parsed here, It will be at the same start position it was in before (though the checkpoint may have been changed)
    parse(It: BlockContentIterator): InlineElement<K> | false;

    MDP: MarkdownParser;
    B: InlineElement<K>;
}


export class InlineParser_Standard<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;

    constructor(MDP: MarkdownParser, traits: InlineElementTraits<K>) {
        this.type   = traits.defaultElementInstance.type as K;
        this.MDP    = MDP;
        this.B      = structuredClone(traits.defaultElementInstance);
        this.traits = traits;
    }

    parse(It: BlockContentIterator) {
        const pos0 = It.newCheckpoint();
        const elt = this.traits.parse.call(this, It, pos0);
        if(!elt)
            It.setPosition(pos0); // rewind position
        return elt;
    }

    MDP: MarkdownParser;
    B: InlineElement<K>;
    traits: InlineElementTraits<K>;
}



export function parseHTML_entities(s: string, buf: AnyInline[]) {
    let checkpoint = 0;
    for(let i = 0, iN = s.length;  i < iN;  ++i) {
        const c = s[i];
        if(c !== '&')
            continue;
        // TODO!! Numerical entity codes
        const entity = /^&[A-Za-z][A-Za-z\d]{0,32};/.exec(s.slice(i))?.[0];
        if(!entity)
            continue;
        if(i !== checkpoint)
            buf.push(s.slice(checkpoint, i));
        buf.push({ type: "htmlEntity",  code: entity,
                   codePoint: (entityList as Record<string, number>)[entity.slice(1, -1)] });
        i += entity.length - 1;
        checkpoint = i + 1;
    }
    if(checkpoint !== s.length)
        buf.push(s.slice(checkpoint));
}



const escapeds: Record<string, boolean> = {
    '!': true,  '"': true,  '#': true,  '$': true,  '%': true,  '&': true,  '\'': true,  '(': true,
    ')': true,  '_': true,  '`': true,  '{': true,  '|': true,  '}': true,  '~': true,  '\\': true
};
export function parseBackslashEscapes(s: string, buf: AnyInline[], pusher?: (s: string, buf: AnyInline[]) => void) {
    if(!pusher)
        pusher = parseHTML_entities;
    let checkpoint = 0;
    for(let i = 0, iN = s.length;  i < iN;  ++i) {
        const c = s[i];
        if(c !== '\\' || !escapeds[s[i + 1]])
            continue;
        if(i !== checkpoint)
            pusher(s.slice(checkpoint, i), buf);
        buf.push({ type: "escaped",  character: s[i + 1] });
        ++i;
        checkpoint = i + 1;
    }
    if(checkpoint !== s.length)
        pusher(s.slice(checkpoint), buf);
}
