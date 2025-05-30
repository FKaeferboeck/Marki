import { BlockContainer, BlockParser, BlockParserBase, BlockParser_Container, BlockParser_Standard, standardBlockParserTraits } from "./block-parser.js";
import { InlineParserProvider, processInline } from "./inline-parsing-context.js";
import { autolink_traits } from "./inline/autolink.js";
import { escaped_traits } from "./inline/backslash-escape.js";
import { codeSpan_traits } from "./inline/code-span.js";
import { emphasis_traits_asterisk, emphasis_traits_underscore } from "./inline/emphasis.js";
import { hardBreak_traits } from "./inline/hard-break.js";
import { htmlEntity_traits } from "./inline/html-entity.js";
import { bang_bracket_traits, image_traits } from "./inline/image.js";
import { bracket_traits, link_traits } from "./inline/link.js";
import { AnyBlock, Block, BlockBase, BlockType, BlockType_Container, LogicalLineData, isContainer } from "./markdown-types.js";
import { LineStructure } from "./parser.js";
import { BlockParserTraitsList, BlockTraits, BlockTraits_Container, DelimiterTraits, InlineParserTraitsList } from "./traits.js";
import { LLDinfo } from "./util.js";


interface BlockParserProviderItem {
	parent: MarkdownParser;
	parser: BlockParserBase | undefined;
}
type BlockParserProviderCache = {
	[K in BlockType]: BlockParserProviderItem | undefined;
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
	escaped:    escaped_traits,
	codeSpan:   codeSpan_traits,
	link:       link_traits,
	hardBreak:  hardBreak_traits,
	htmlEntity: htmlEntity_traits,
	image:      image_traits,
	autolink:   autolink_traits
};

export const standardDelimiterTraits: Record<string, DelimiterTraits> = {
	emph_asterisk:   emphasis_traits_asterisk,
	emph_underscore: emphasis_traits_underscore,
	bracket:         bracket_traits,
	bang_bracket:    bang_bracket_traits // ![ ... ] — in CommonMark only used for image descriptions
}


export class MarkdownParser implements BlockContainer {
	constructor() {
		// TODO!! Adjust traits to the desired configuration
		//console.log(this.traitsList)

		this.inlineParser_standard.traits = { ... standardInlineParserTraits };
		this.inlineParser_standard.delims = { ... standardDelimiterTraits };
		this.inlineParser_standard.makeStartCharMap();

		this.inlineParser_minimal.traits = {
			escaped:    escaped_traits,
			htmlEntity: htmlEntity_traits
		};
		this.inlineParser_minimal.delims = { ... standardDelimiterTraits };
		this.inlineParser_minimal.makeStartCharMap();
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

	processBlock(B: AnyBlock) {
		const T = this.traitsList[B.type];
		if(!T)    throw new Error(`Cannot process content of block "${B.type}"`);
		if(isContainer(B))
			B.blocks.forEach(B1 => this.processBlock(B1));
		else if(B.type !== "fenced" && B.type !== "indentedCodeBlock" && B.content?.parts.length)
			B.inlineContent = this.processInline(B.content);
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
		release(P: BlockParserBase) {
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

	private linkDefs: Record<string, Block<"linkDef">> = { };
	registerLinkDef(B: Block<"linkDef">) {
		/* CommonMark: "Consecutive internal spaces, tabs, and line endings are treated as one space for purposes of determining matching" */
		// Note: CommonMark prescribes "Unicode case fold", but the reference implementation just does this ".toLowerCase().toUpperCase()"
		//       procedure, so apparently that's good enough.
		const label = B.linkLabel.trim().replace(/[ \t\r\n]+/g, ' ').toLowerCase().toUpperCase();
		this.linkDefs[label] ||= B; // ||= because the first occurance of a link label takes precedence
	}
	findLinkDef(label: string): Block<"linkDef"> | undefined {
		label = label.trim().replace(/[ \t\r\n]+/g, ' ').toLowerCase().toUpperCase();
		return this.linkDefs[label];
	}

    /******************************************************************************************************************/

    inlineParser_standard = new InlineParserProvider(this);
	inlineParser_minimal  = new InlineParserProvider(this);
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
		return { container,  retry: curParser.getCheckpoint() || curParser.startLine!,  curParser: null,  generator };
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
