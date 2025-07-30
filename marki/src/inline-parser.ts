import { MarkdownLocalContext, ParsingContext } from "./block-parser.js";
import { backslashEscapeds } from "./inline/backslash-escape.js";
import { parseHTML_entities } from "./inline/html-entity.js";
import { MarkdownParser } from "./markdown-parser.js";
import { AnyInline, Delimiter_nestable, ExtensionInlineElementType, InlineContent, InlineElement, InlineElementType, InlinePos, MarkdownParserContext } from "./markdown-types.js";
import { PositionOps } from "./position-ops.js";
import { DelimFollowerTraits, InlineElementTraits } from "./traits.js";
import { BlockContentIterator } from "./util.js";


export interface InlineParser<K extends InlineElementType = ExtensionInlineElementType, Elt extends InlineElement<K> = InlineElement<K>>
    extends ParsingContext
{
    type: K;

    // guarantee: if an element is successfully parsed, It will afterwards point behind it
    //            if it cannot be parsed here, It will be at the same start position it was in before (though the checkpoint may have been changed)
    parse(It: BlockContentIterator, startCheckpoint: InlinePos): Elt | false;

    parseFollowingDelim(D: Delimiter_nestable, It: BlockContentIterator, startCheckpoint: InlinePos): false | InlineElement<K>;

    setBuf(buf: InlineContent): void;
    getDelimitedContent(D: Delimiter_nestable): InlineContent; // for use in parseFollowingDelim()

    B: Elt;
    traits: InlineElementTraits<K> | DelimFollowerTraits<K>;
}


export class InlineParser_Standard<K extends InlineElementType = ExtensionInlineElementType, Elt extends InlineElement<K> = InlineElement<K>> {
    type: K;
    buf?: InlineContent;

    constructor(ctx: ParsingContext, traits: InlineElementTraits<K, Elt> | DelimFollowerTraits<K, Elt>) {
        this.type      = traits.defaultElementInstance.type as K;
        this.MDP       = ctx.MDP;
		this.globalCtx = ctx.globalCtx;
		this.localCtx  = ctx.localCtx;
        this.traits    = traits;
        this.B         = structuredClone(traits.defaultElementInstance) as Elt;
        this.B.endPos  = { line: 0,  character: 0 };
    }

    parse(It: BlockContentIterator, startCheckpoint: InlinePos): false | Elt {
        if(!("startChars" in this.traits)) // this function doesn't handle DelimFollowerTraits
            return false;
        const found = this.traits.parse.call(this, It, this.B, startCheckpoint);
        if(!found) {
            It.setPosition(startCheckpoint); // rewind position
            return false;
        }
        else {
            this.B.endPos = It.relativePos();
            /*const endCheckpoint = It.newPos();*/
            return this.B;
        }
    }

    parseFollowingDelim(D: Delimiter_nestable, It: BlockContentIterator, startCheckpoint: InlinePos): false | InlineElement<K> {
        if("startChars" in this.traits) // this function only handles DelimFollowerTraits
            return false;
        const found = this.traits.parse.call(this, this.B, D, It, startCheckpoint);
        if(found) {
            D.follower = this.B;
            D.follower.followedDelimiter = D;
            this.B.endPos = It.relativePos();
        } else
            It.setPosition(startCheckpoint); // rewind position
        return (found && this.B);
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
    globalCtx: MarkdownParserContext;
    localCtx:  MarkdownLocalContext;
    B: Elt;
    traits: InlineElementTraits<K, Elt> | DelimFollowerTraits<K, Elt>;
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
        const endPos = PositionOps.endPos(buf);
        endPos.character += 2;
        buf.push({ type: "escaped",  endPos,  character: s[i + 1] });
        ++i;
        checkpoint = i + 1;
    }
    if(checkpoint !== s.length)
        pusher(s.slice(checkpoint), buf);
}
