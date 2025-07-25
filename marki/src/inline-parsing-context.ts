import { BlockParser, BlockParserBase, ParsingContext } from "./block-parser.js";
import { pairUpDelimiters, parseDelimiter } from "./delimiter-processing.js";
import { InlineParser_Standard } from "./inline-parser.js";
import { LogicalLine } from "./linify.js";
import { MarkdownParser, MarkdownParserTraits } from "./markdown-parser.js";
import { InlineElementType, Delimiter_nestable, InlineContent, InlineElement, Delimiter, InlinePos, isNestableDelimiter, MarkdownParserContext } from "./markdown-types.js";
import { LinePart } from "./parser.js";
import { InlineParserTraitsList, DelimiterTraits, isDelimFollowerTraits } from "./traits.js";
import { BlockContentIterator, contentSlice, makeBlockContentIterator } from "./util.js";



export class InlineParserProvider {
    traits: InlineParserTraitsList = { };
    delims: Record<string, DelimiterTraits> = { };
    parent?: InlineParserProvider; // an InlineParserProvider can optionally be derived from another
    startCharMap:     Record<string, (InlineElementType | DelimiterTraits)[]> = { };
    delimFollowerMap: Record<string,  InlineElementType[]> = { };
    MPT: MarkdownParserTraits;

    constructor(MPT: MarkdownParserTraits, parent?: InlineParserProvider) {
        this.MPT    = MPT;
        this.parent = parent;
    }

    getInlineParser<K extends InlineElementType>(type: K, ctx: ParsingContext, followingDelim?: Delimiter_nestable) {
        const traits = this.traits[type] || this.parent?.traits[type];
        if(!traits)
            throw new Error(`Missing inline parser traits for inline element type "${type}"`)
        if(followingDelim && !isDelimFollowerTraits(traits))
            throw new Error(`Expecting a delimiter-following inline parser for delimiter "${followingDelim.type}", but traits for "${type}" isn't`);
        if(traits.creator)
            return traits.creator(ctx);
        else
            return new InlineParser_Standard(ctx, traits);
    }

    getDelimiterTraits(delim_name: string): DelimiterTraits {
        const traits = this.delims[delim_name] || this.parent?.getDelimiterTraits(delim_name);
        if(!traits)
            throw new Error(`Failed to acquire traits for delimiter "${delim_name}"`);
        return traits;
    }
    
    makeStartCharMap() {
        this.startCharMap = {};
        this.delimFollowerMap = {};
        const traits = (this.parent ? { ... this.traits, ...this.parent.traits } : this.traits);
        for(const t in traits) {
            const iet = t as InlineElementType;
            const trait = traits[iet];
            if(trait && "startChars" in trait) {
                const startChars = (typeof trait.startChars === "function" ? trait.startChars.call(this.MPT) : trait.startChars);
                startChars.forEach(sc => {
                    (this.startCharMap[sc] ||= [] as InlineElementType[]).push(iet);
                });
            }
            if(trait && "startDelims" in trait)
                trait.startDelims.forEach(sd => {
                    (this.delimFollowerMap[sd] ||= [] as InlineElementType[]).push(iet);
                });
        }
        // delimiter openers are mixed together with the normal start chars
        const delims = (this.parent ? { ... this.delims, ...this.parent.delims } : this.delims);
        for(const t in delims) {
            const sc_ = delims[t].startChars;
            const startChars = (typeof sc_ === "function" ? sc_.call(this.MPT) : sc_);
            startChars.forEach(sc => {
                (this.startCharMap[sc] ||= []).push(delims[t]);
            });
        }
    }
} // class InlineParserProvider


export class InlineParsingContext {
    provider: InlineParserProvider;
    startCharMap:     Record<string, (InlineElementType | DelimiterTraits)[]>;
    delimFollowerMap: Record<string,  InlineElementType[]> = { };
    delimiterStack: Delimiter_nestable[] = [];
    curDelimClosingStartChar: string | false = ''; // false signifies a delimiter ending at end-of-block
    ctx: ParsingContext

    constructor(provider: InlineParserProvider, ctx: ParsingContext) {
        this.provider         = provider;
        this.ctx              = ctx;
        this.startCharMap     = provider.startCharMap;
        this.delimFollowerMap = provider.delimFollowerMap;
    }

    inlineParseLoop(this: InlineParsingContext, It: BlockContentIterator, buf: InlineContent,
                    contCbk?:  (It: BlockContentIterator, c: string | LinePart) => boolean,
                    contCbk2?: (It: BlockContentIterator, c: string | LinePart) => boolean)
    {
        let c: false | string | LinePart = false;
        const checkpoint = It.newPos(), checkpoint1 = It.newPos();
        let returnVal = "EOF";
    
        while(c = It.peek()) {
            if(contCbk?.(It, c) === false) {
                returnVal = "byCbk";
                break;
            }
    
            if(typeof c === "string") {
                let found = false;
                if(this.curDelimClosingStartChar && this.curDelimClosingStartChar === c) {
                    It.setCheckPoint(checkpoint1);
                    const curOpenDelimiter = this.delimiterStack[this.delimiterStack.length - 1];
                    const curOpenDelimiterTraits = this.provider.getDelimiterTraits(curOpenDelimiter.type);
                    found = inlineParse_try.call(this, curOpenDelimiterTraits, curOpenDelimiter, It, buf, checkpoint, checkpoint1);
                    if(found && this.delimFollowerMap[curOpenDelimiter.type]) { // open delimiter successfully closed, now we'll look if it has a delimiter follower
                        It.setCheckPoint(checkpoint1);
                        for(const t of this.delimFollowerMap[curOpenDelimiter.type]) {
                            if(inlineParse_try.call(this, t, curOpenDelimiter, It, buf, checkpoint, checkpoint1)) {
                                found = true;
                                break;
                            }
                        }
                    }
                }
                if(!found && this.startCharMap[c]) {
                    It.setCheckPoint(checkpoint1);
                    for(const t of this.startCharMap[c]) {
                        if(inlineParse_try.call(this, t, undefined, It, buf, checkpoint, checkpoint1)) {
                            found = true;
                            break;
                        }
                    }
                }
                if(found)
                    continue;
            }
    
            if(contCbk2?.(It, c) === false) {
                returnVal = "byCbk";
                break;
            }
    
            It.pop();
        } // while

        if(this.curDelimClosingStartChar === false || this.curDelimClosingStartChar === '\n') {
            It.setCheckPoint(checkpoint1);
            const curOpenDelimiter = this.delimiterStack[this.delimiterStack.length - 1];
            const curOpenDelimiterTraits = this.provider.getDelimiterTraits(curOpenDelimiter.type);
            // With a closing delimiter that is end-of-block there's not much to check, but there might be lookbehinds:
            let found = inlineParse_try.call(this, curOpenDelimiterTraits, curOpenDelimiter, It, buf, checkpoint, checkpoint1);
            if(found && this.delimFollowerMap[curOpenDelimiter.type]) { // open delimiter successfully closed, now we'll look if it has a delimiter follower
                It.setCheckPoint(checkpoint1);
                for(const t of this.delimFollowerMap[curOpenDelimiter.type]) {
                    if(inlineParse_try.call(this, t, curOpenDelimiter, It, buf, checkpoint, checkpoint1)) {
                        found = true;
                        break;
                    }
                }
            }
        }

        const flush = contentSlice(checkpoint, It.newPos(), false);
        if(flush)
            buf.push(flush);
        return returnVal;
    }
} // class InlineParsingContext


export const makeInlineContext_minimal = (P: BlockParser<any, any>) => new InlineParsingContext(P.MDP.MDPT.inlineParser_minimal, P.MDP);


function inlineParse_try(this: InlineParsingContext, t: InlineElementType | DelimiterTraits,
                         openDelim: Delimiter_nestable | undefined,
                         It: BlockContentIterator, buf: InlineContent, checkpoint: InlinePos, checkpoint1: InlinePos)
{
    let elt: InlineElement<InlineElementType> | Delimiter | false = false;
    if(typeof t === "string") {
        const P = this.provider.getInlineParser(t, this.ctx, openDelim);
        if(openDelim) {
            P.setBuf(buf);
            elt = P.parseFollowingDelim(openDelim, It, checkpoint1);
            if(elt) {
                const i0 = buf.indexOf(openDelim);
                if(i0 < 0)
                    throw new Error('Opening delimiter not found where it should be!');
                buf[i0] = elt; // The delimiter-following element replaces the opening delimiter in the inline content array, this makes it much easier to render.
                if("contentOwner" in P.traits && P.traits.contentOwner)
                    buf.splice(i0 + 1); // Remove delimited content from primary sequence, it's contained somewhere in the delimiter-following element instead.
                It.setCheckPoint(checkpoint);
                return true;
            }
        } else
            elt = P.parse(It, checkpoint1);
    } else { // it's a delimiter
        elt = parseDelimiter(this, It, checkpoint1, t, openDelim);
        if(!elt)
            It.setPosition(checkpoint1);
    }
    if(!elt)
        return false;
    const flush = contentSlice(checkpoint, checkpoint1, false);
    if(flush)
        buf.push(flush);
    buf.push(elt);
    
    // update nested delimiter stack
    if(isNestableDelimiter(elt)) {
        if(elt.isOpener)
            this.delimiterStack.push(elt);
        else
            this.delimiterStack.pop();
        const n = this.delimiterStack.length;
        this.curDelimClosingStartChar = '';
        if(n > 0) {
            const c = this.delimiterStack[n - 1].endDelimStartChar;
            this.curDelimClosingStartChar = (c === undefined ? '' : c);
        }
    }

    It.setCheckPoint(checkpoint);
    return true;
}



export function processInline(this: MarkdownParser, LL: LogicalLine, customContentParser?: InlineParserProvider) {
	let It = makeBlockContentIterator(LL);
	const buf: InlineContent = [];
	const context = new InlineParsingContext(customContentParser || this.MDPT.inlineParser_standard, this);
	context.inlineParseLoop(It, buf);
    pairUpDelimiters(buf);
	return buf;
}
