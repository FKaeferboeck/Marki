import { BlockContainer, BlockParser, BlockParser_Container, BlockParser_Standard, standardBlockParserTraits } from "./block-parser.js";
import { codeSpan_traits } from "./inline/code-span.js";
import { link_traits } from "./inline/link.js";
import { AnyBlock, AnyInline, Block, BlockBase, BlockType, BlockType_Container, InlineContent, InlineElementType, LogicalLineData } from "./markdown-types.js";
import { LinePart, LineStructure } from "./parser.js";
import { BlockParserTraitsList, BlockTraits, BlockTraits_Container, InlineParserTraitsList } from "./traits.js";
import { BlockContentIterator, contentSlice, LLDinfo, makeBlockContentIterator } from "./util.js";


interface BlockParserProviderItem<K extends BlockType> {
	parent: MarkdownParser;
	parser: BlockParser<K> | undefined;
}
type BlockParserProviderCache = {
	[K in BlockType]: BlockParserProviderItem<K> | undefined;
};

export interface ParseState {
	container: BlockContainer;
	curParser: BlockParser | null;
	generator: Generator<BlockParser> | null;
	retry?:    LogicalLineData;
}


export type TakeBlockResult = {
	finished_block: AnyBlock;
	lineAfter:      LogicalLineData | null;
	ended_by?:      BlockParser | "eof";
};


export const standardInlineParserTraits: InlineParserTraitsList = {
	codeSpan: codeSpan_traits,
	link:     link_traits
};



export class MarkdownParser implements BlockContainer {
	constructor() {
		// TODO!! Adjust traits to the desired configuration
		//console.log(this.traitsList)
	}

	reset() {
		this.linkDefs = {};
	}

	startBlock   = startBlock;
	processLine  = processLine;
	processLines = processLines;

	processContent(LLD: LogicalLineData) {
		this.blocks = [];
		let LLD0: LogicalLineData | null = LLD;
		while(LLD0) {
			const P = this.processLines(LLD0, null, { container: this,  curParser: null,  generator: null });
			if(this.diagnostics)    console.log(`Coming out of parsing with open block`, P.curParser?.type, P.curParser?.getCheckpoint());
			LLD0 = (P.curParser?.finish()?.next || null);
		}
		
		return this.blocks;
	}

    processInline = processInline;


	traitsList:	BlockParserTraitsList = { ... standardBlockParserTraits };
	LS: LineStructure = {
		all: [],
		logical_lines: []
	};

	isContainerType(type: BlockType): type is BlockType_Container {
		const traits = this.traitsList[type];
		return ((traits && "isContainer" in traits && traits.isContainer) || false);
	}

	private makeParser<K extends BlockType>(type: K) {
		const traits = this.traitsList[type] as BlockTraits<K> | undefined;
		if(!traits)
			throw new Error(`Missing block parser traits for block type "${type}"`)
		if(traits.creator)
			return traits.creator(this, type);

		// No individual parser creator function found -> use the default version
		if(this.isContainerType(type))
			return new BlockParser_Container<typeof type>(this, type, traits as BlockTraits_Container<typeof type>);
		else
			return new BlockParser_Standard<K>(this, type, traits);
	}

	tryOrder: BlockType[] = [
		"emptySpace",
		"indentedCodeBlock", // must be tried first so that the following block types can skip checking for too large indentations
		"thematicBreak",
		"sectionHeader",
		"fenced",
		"blockQuote",
		"listItem",
		"linkDef",
		"paragraph",
		"sectionHeader_setext" // this only get used if a paragraph is rejected due to encountering "=======" (SETEXT header suffix)
	];
	interrupters: BlockType[] = [
		"thematicBreak",
		"sectionHeader",
		"fenced", // also in CommonMark mode
		"blockQuote",
		"listItem"
	];

	blockParserProvider = {
		cache: { } as BlockParserProviderCache,
		release(P: BlockParser) {
			if(this.cache[P.type]?.parser !== P)
				throw new Error(`Trying to release a block parser for "${P.type}" that isn't in the cache`);
			this.cache[P.type] = undefined;
			return P;
		},

		*interrupters(interruptee: BlockParser): Generator<BlockParser> { yield* this.run("interrupters", interruptee.type, interruptee.parent || this.MDP); },
		*mainBlocks  (BC?: BlockContainer):      Generator<BlockParser> { yield* this.run("tryOrder",     undefined, BC || this.MDP); },

		*run(s: "tryOrder" | "interrupters", t0: BlockType | undefined, BC: BlockContainer | undefined): Generator<BlockParser> {
			const p = (this.MDP as MarkdownParser);
			const L = p[s];
			const allowSelfInterrupt = (t0 && p.traitsList[t0]?.canSelfInterrupt);
			for(let i = 0, iN = L.length;  i < iN;  ++i) {
				const key = L[i];
				const PP = this.cache[key] || (this.cache[key] = { parent: p,  parser: undefined });
				if(!PP.parser)
					PP.parser = p.makeParser(key) as any;
				const P = PP.parser as BlockParser;
				if(P.type !== t0 || allowSelfInterrupt) {
					P.parent = BC; // where will a finished block be stored — either the central MarkdownParser instance or a container block
					P.isInterruption = (s === "interrupters");
					yield P;
				}
			}
		},
		MDP: this,
	}

	
	addContentBlock<K extends BlockType>(B: BlockBase<K>) { this.blocks.push(B as AnyBlock); }
	blocks: AnyBlock[] = [];
	blockContainerType = "MarkdownParser" as const;
	diagnostics = false;

	linkDefs: Record<string, Block<"linkDef">> = { };
	registerLinkDef(B: Block<"linkDef">) {
		this.linkDefs[B.linkLabel] = B;
	}

    /******************************************************************************************************************/

    inlineTraitsList: InlineParserTraitsList = { ... standardInlineParserTraits };

    /* During inline parsing we check for element start chars before calling their full parsers, so the order below only
     * matters between elements that share a start char. */
    inlineTryOrder: InlineElementType[] = [
		"codeSpan"
	];

    getInlineParser<K extends InlineElementType>(type: K) {
		const traits = this.inlineTraitsList[type];
		if(!traits)
			throw new Error(`Missing inline parser traits for inline element type "${type}"`)
		return traits.creator(this);
	}

    startCharMap: Record<string, InlineElementType[]> = {};
    makeStartCharMap() {
        this.startCharMap = {};
        for(const t in this.inlineTraitsList) {
            const to_add = this.inlineTraitsList[t as InlineElementType]?.startChars;
            to_add?.forEach(sc => {
                (this.startCharMap[sc] ||= [] as InlineElementType[]).push(t as InlineElementType);
            });
        }
    }

	inlineParseLoop = inlineParseLoop;
};



/**********************************************************************************************************************/

export function startBlock(this: MarkdownParser, ctx: ParseState, LLD: LogicalLineData, interrupting?: BlockType): ParseState {
	if(!ctx.generator)
		ctx.generator = this.blockParserProvider.mainBlocks(ctx.container);

	let I: IteratorResult<BlockParser, any> | undefined;
	while(!(I = ctx.generator.next()).done) {
		const PA = I.value;
		
		const n = PA.beginsHere(LLD, interrupting);
		//if(this.diagnostics)    console.log(`Trying "${PA.type}" for line ${LLD.logl_idx} -> ${n}`);
		if(n >= 0) {
			if(this.diagnostics)    console.log(`  Processing line ${LLDinfo(LLD)} -> start <${PA.type}>`);
			PA.acceptLine(LLD, "start", n);
			ctx.curParser = PA;
			return ctx;
		}
	}
	if(this.diagnostics)    console.log(`  Processing line ${LLDinfo(LLD)} -> no interruption of <${interrupting}>`);
	ctx.generator = null;
	ctx.curParser = null;
	return ctx;
}


export function processLine(this: MarkdownParser, PP: ParseState, LLD: LogicalLineData): ParseState {
	const { container, curParser, generator } = PP;
	PP.retry = undefined;
	if(this.diagnostics)    console.log(`  processLine ${LLDinfo(LLD)} in ${container.blockContainerType} ${curParser ? `continuing <${curParser.type}>` : 'starting a new block'}`);

	if(!curParser) { // start a new block
		this.startBlock(PP, LLD);
		if(!PP.curParser)
			throw new Error(`Line ${LLD.logl_idx} doesn't belong to any block, that's not possible!`)
		return PP;
	}

	// continue an existing block
	const bct = curParser.continues(LLD);
	if(this.diagnostics)    console.log(`  Processing line ${LLDinfo(LLD)} in <${PP.curParser?.type}> -> ${bct}`)
	switch(bct) {
	case "end": // current block cannot continue in this line, i.e. it ends on its own
		{
			const LLD_last = curParser.finish();
			return { container,  retry: LLD_last.next!,  curParser: null,  generator: null }; // will start a new block in the current line
		}
	case "last":
		curParser.acceptLine(LLD, bct, 0);
		curParser.finish();
		return { container,  curParser: null,  generator: null }; // will start a new block in the next line
	case "reject":
		if(curParser.isInterruption)
			throw new Error('Problem! Rejecting a block that interrupted another block is a bit too much in terms of backtracking, so we don\'t allow that.');
		// schedule backtracking:
		return { container,  retry: curParser.startLine!,  curParser: null,  generator };
	case "soft": // it's a soft continuation, which means it's possible that the next block begins here, interrupting the current one
		{
			const P1 = this.startBlock({ container,  curParser: null,  generator: this.blockParserProvider.interrupters(curParser) }, LLD, curParser.type).curParser;
			if(P1) {
				curParser.finish();
				PP.curParser = P1;
				// since the generator would only be used if this block gets rejected, and we don't allow rejection on an interruption, we don't pass on the generator
				PP.generator = null;
				return PP;
			}
		}
		// soft continuation wasn't interrupted, we can accept it
		if(this.diagnostics)    console.log(`  Not interrupted -> accept line ${LLD.logl_idx} as <${PP.curParser?.type}>`)
		curParser.acceptLine(LLD, bct, 0);
		return PP;
	default: // hard accept
		curParser.acceptLine(LLD, bct, bct);
		return PP;
	}
}



export function processLines(this: MarkdownParser, LLD0: LogicalLineData, LLD1: LogicalLineData | null, PP: ParseState) {
	let curLLD: LogicalLineData | null = LLD0;
	while(curLLD && curLLD !== LLD1) {
		PP = this.processLine(PP, curLLD);
		if(PP.retry) {
			if(this.diagnostics)    console.log(`* Retry in line ${LLDinfo(PP.retry)}`);
			curLLD = PP.retry;
		} else {
			if(this.diagnostics)    console.log(`* Proceed ${curLLD.logl_idx}->${LLDinfo(curLLD.next)}`);
			curLLD = curLLD.next;
		}
	}
	if(this.diagnostics)    console.log(`Out!`)
	return PP;
}



/**********************************************************************************************************************/

function inlineParseLoop(this: MarkdownParser, It: BlockContentIterator, buf: InlineContent,
	                     contCbk?:  (It: BlockContentIterator, c: string | LinePart) => boolean,
						 contCbk2?: (It: BlockContentIterator, c: string | LinePart) => boolean) {
	let c: false | string | LinePart = false;
	const checkpoint = It.newCheckpoint(), checkpoint1 = It.newCheckpoint();
	let returnVal = "EOF";

	while(c = It.peekItem()) {
		if(contCbk?.(It, c) === false) {
			returnVal = "byCbk";
			break;
		}

		if(typeof c === "string" && this.startCharMap[c]) {
			It.setCheckPoint(checkpoint1);
			let found = false;
			for(const t of this.startCharMap[c]) {
				const P = this.getInlineParser(t);
				const elt = P.parse(It);
				if(elt) {
					const flush = contentSlice(checkpoint, checkpoint1, false);
					if(flush)
						buf.push(flush);
					buf.push(elt);
					It.setCheckPoint(checkpoint);
					found = true;
					break;
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



function processInline(this: MarkdownParser, LLD: LogicalLineData) {
		let It = makeBlockContentIterator(LLD);
		const buf: InlineContent = [];
		inlineParseLoop.call(this, It, buf);
		return buf;
}
