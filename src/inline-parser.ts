import { backslashEscapeds } from "./inline/backslash-escape.js";
import { parseHTML_entities } from "./inline/html-entity.js";
import { MarkdownParser } from "./markdown-parser.js";
import { AnyInline, Delimiter_nestable, ExtensionInlineElementType, InlineContent, InlineElement, InlineElementType, InlinePos } from "./markdown-types.js";
import { DelimFollowerTraits, InlineElementTraits } from "./traits.js";
import { BlockContentIterator } from "./util.js";


export interface InlineParser<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;

    // guarantee: if an element is successfully parsed, It will afterwards point behind it
    //            if it cannot be parsed here, It will be at the same start position it was in before (though the checkpoint may have been changed)
    parse(It: BlockContentIterator, startCheckpoint: InlinePos): InlineElement<K> | false;

    parseFollowingDelim(D: Delimiter_nestable, It: BlockContentIterator, startCheckpoint: InlinePos): false | InlineElement<K>;

    setBuf(buf: InlineContent): void;
    getDelimitedContent(D: Delimiter_nestable): InlineContent; // for use in parseFollowingDelim()

    MDP: MarkdownParser;
    B: InlineElement<K>;
}


export class InlineParser_Standard<K extends InlineElementType = ExtensionInlineElementType> {
    type: K;
    buf?: InlineContent;

    constructor(MDP: MarkdownParser, traits: InlineElementTraits<K> | DelimFollowerTraits<K>) {
        this.type   = traits.defaultElementInstance.type as K;
        this.MDP    = MDP;
        this.B      = structuredClone(traits.defaultElementInstance);
        this.traits = traits;
    }

    parse(It: BlockContentIterator, startCheckpoint: InlinePos): false | InlineElement<K> {
        if(!("startChars" in this.traits)) // this function doesn't handle DelimFollowerTraits
            return false;
        const elt: false | InlineElement<K>  = this.traits.parse.call(this, It, startCheckpoint);
        if(!elt)
            It.setPosition(startCheckpoint); // rewind position
        return elt;
    }

    parseFollowingDelim(D: Delimiter_nestable, It: BlockContentIterator, startCheckpoint: InlinePos): false | InlineElement<K> {
        if("startChars" in this.traits) // this function only handles DelimFollowerTraits
            return false;
        const elt: false | InlineElement<K>  = this.traits.parse.call(this, D, It, startCheckpoint);
        if(elt) {
            D.follower = elt;
            elt.followedDelimiter = D;
        } else
            It.setPosition(startCheckpoint); // rewind position
        return elt;
    }

    setBuf(buf: InlineContent) { this.buf = buf; }
    getDelimitedContent(D: Delimiter_nestable) {
        if(!this.buf)
            throw new Error('InlineParser:buf not set');
        if(!(D.isOpener && D.partnerDelim))
            throw new Error('InlineParser:getDelimitedContent: given delimiter invalid for this purpose');
        const i0 = this.buf.indexOf(D), iN = this.buf.length;
        let i1 = i0;
        while(++i1 < iN && this.buf[i1] !== D.partnerDelim) ;
        return this.buf.slice(i0 + 1, i1);
    }

    MDP: MarkdownParser;
    B: InlineElement<K>;
    traits: InlineElementTraits<K> | DelimFollowerTraits<K>;
}


export function parseBackslashEscapes(s: string, buf: AnyInline[], pusher?: (s: string, buf: AnyInline[]) => void) {
    if(!pusher)
        pusher = parseHTML_entities;
    let checkpoint = 0;
    for(let i = 0, iN = s.length;  i < iN;  ++i) {
        const c = s[i];
        if(c !== '\\' || !backslashEscapeds[s[i + 1]])
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
