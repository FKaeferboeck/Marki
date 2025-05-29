import { parseDelimiter } from "./delimiter-processing.js";
import { MarkdownParser } from "./markdown-parser.js";
import { InlineElementType, Delimiter_nestable, AnyInline, InlineContent, InlineElement, Delimiter, InlinePos, isNestableDelimiter, LogicalLineData } from "./markdown-types.js";
import { LinePart } from "./parser.js";
import { InlineParserTraitsList, DelimiterTraits, isDelimFollowerTraits } from "./traits.js";
import { BlockContentIterator, contentSlice, makeBlockContentIterator } from "./util.js";



export class InlineParserProvider {
    traits: InlineParserTraitsList = { };
    delims: Record<string, DelimiterTraits> = { };
    startCharMap:     Record<string, (InlineElementType | DelimiterTraits)[]> = { };
    delimFollowerMap: Record<string,  InlineElementType[]> = { };
    MDP: MarkdownParser;

    constructor(MDP: MarkdownParser) { this.MDP = MDP; }

    getInlineParser<K extends InlineElementType>(type: K, followingDelim?: Delimiter_nestable) {
        const traits = this.traits[type];
        if(!traits)
            throw new Error(`Missing inline parser traits for inline element type "${type}"`)
        if(followingDelim && !isDelimFollowerTraits(traits))
            throw new Error(`Expecting a delimiter-following inline parser for delimiter "${followingDelim.type}", but traits for "${type}" isn't`);
        return traits.creator(this.MDP);
    }
    
    makeStartCharMap() {
        this.startCharMap = {};
        this.delimFollowerMap = {};
        for(const t in this.traits) {
            const iet = t as InlineElementType;
            const traits = this.traits[iet];
            if(traits && "startChars" in traits)
                traits.startChars.forEach(sc => {
                    (this.startCharMap[sc] ||= [] as InlineElementType[]).push(iet);
                });
            if(traits && "startDelims" in traits)
                traits.startDelims.forEach(sd => {
                    (this.delimFollowerMap[sd] ||= [] as InlineElementType[]).push(iet);
                });
        }
        // delimiter openers are mixed together with the normal start chars
        for(const t in this.delims) {
            this.delims[t].startChars.forEach(sc => {
                (this.startCharMap[sc] ||= []).push(this.delims[t]);
            });
        }
    }
} // class InlineParserProvider


export class InlineParsingContext {
    provider: InlineParserProvider;
    startCharMap:     Record<string, (InlineElementType | DelimiterTraits)[]>;
    delimFollowerMap: Record<string,  InlineElementType[]> = { };
    delimiterStack: Delimiter_nestable[] = [];
    curDelimClosingStartChar: string = '';
    MDP: MarkdownParser;

    constructor(provider: InlineParserProvider) {
        this.provider         = provider;
        this.MDP              = provider.MDP;
        this.startCharMap     = provider.startCharMap;
        this.delimFollowerMap = provider.delimFollowerMap;
    }

    /* During inline parsing we check for element start chars before calling their full parsers, so the order below only
     * matters between elements that share a start char. */
    /*inlineTryOrder: InlineElementType[] = [
        "codeSpan"
    ];*/

    inlineParseLoop(this: InlineParsingContext, It: BlockContentIterator, buf: InlineContent,
                    contCbk?:  (It: BlockContentIterator, c: string | LinePart) => boolean,
                    contCbk2?: (It: BlockContentIterator, c: string | LinePart) => boolean)
    {
        let c: false | string | LinePart = false;
        const checkpoint = It.newCheckpoint(), checkpoint1 = It.newCheckpoint();
        let returnVal = "EOF";
    
        while(c = It.peekItem()) {
            if(contCbk?.(It, c) === false) {
                returnVal = "byCbk";
                break;
            }
    
            if(typeof c === "string") {
                let found = false;
                if(this.curDelimClosingStartChar && this.curDelimClosingStartChar === c) {
                    It.setCheckPoint(checkpoint1);
                    const curOpenDelimiter = this.delimiterStack[this.delimiterStack.length - 1];
                    const curOpenDelimiterTraits = this.provider.delims[curOpenDelimiter.type];
                    if(!curOpenDelimiterTraits)
                        throw new Error(`Failed to acquire traits for currently open delimiter "${curOpenDelimiter.type}"`)
                    found = inlineParse_try.call(this, curOpenDelimiterTraits, curOpenDelimiter, It, buf, checkpoint, checkpoint1);
                    if(found && this.delimFollowerMap[curOpenDelimiter.type]) { // open delmiter successfully closed, now we'll look if it has a delmiter follower
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
    
            if(typeof c !== "string") {
                It.setCheckPoint(checkpoint1);
                const flush = contentSlice(checkpoint, checkpoint1, false);
                if(flush)
                    buf.push(flush);
                const elt: AnyInline = { type: "html",  stuff: c.content };
                if(c.type === "HTML_Tag" && c.continues)
                    elt.continues = true;
                buf.push(elt);
                It.nextItem();
                It.setCheckPoint(checkpoint);
                continue;
            }
    
            It.nextItem();
        }
        const flush = contentSlice(checkpoint, It.pos, false);
        if(flush)
            buf.push(flush);
        return returnVal;
    }
} // class InlineParsingContext




function inlineParse_try(this: InlineParsingContext, t: InlineElementType | DelimiterTraits,
                         openDelim: Delimiter_nestable | undefined,
                         It: BlockContentIterator, buf: InlineContent, checkpoint: InlinePos, checkpoint1: InlinePos)
{
    let elt: InlineElement<InlineElementType> | Delimiter | false = false;
    if(typeof t === "string") {
        const P = this.provider.getInlineParser(t, openDelim);
        if(openDelim) {
            elt = P.parseFollowingDelim(openDelim, It, checkpoint1);
            if(elt) {
                const i0 = buf.indexOf(openDelim);
                if(i0 < 0)
                    throw new Error('Opening delimiter not found where it should be!');
                buf[i0] = elt; // The delimiter-following element replaces the opening delimiter in the inline content array, this makes it much easier to render.
                It.setCheckPoint(checkpoint);
                return true;
            }
        } else
            elt = P.parse(It, checkpoint1);
    } else { // it's a delimiter
        elt = parseDelimiter(It, checkpoint1, t, openDelim);
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
        this.curDelimClosingStartChar = (n > 0 ? this.delimiterStack[n - 1].endDelimStartChar || '' : '');
    }

    It.setCheckPoint(checkpoint);
    return true;
}



export function processInline(this: MarkdownParser, LLD: LogicalLineData) {
	let It = makeBlockContentIterator(LLD);
	const buf: InlineContent = [];
	const context = new InlineParsingContext(this.inlineParser_standard);
	context.inlineParseLoop(It, buf);
	return buf;
}
