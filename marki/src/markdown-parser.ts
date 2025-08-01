import { BlockContainer, BlockParser, BlockParserBase, BlockParser_Container, BlockParser_Standard, MarkdownLocalContext, ParsingContext, standardBlockTryOrder } from "./block-parser.js";
import { pairUpDelimiters } from "./delimiter-processing.js";
import { Tier2_ctx } from "./extensions-tier-2/traits.js";
import { InlineParserProvider, processInline } from "./inline-parsing-context.js";
import { autolink_traits } from "./inline/autolink.js";
import { escaped_traits } from "./inline/backslash-escape.js";
import { codeSpan_traits } from "./inline/code-span.js";
import { emphasis_traits_asterisk, emphasis_traits_underscore } from "./inline/emphasis.js";
import { hardBreak_traits } from "./inline/hard-break.js";
import { htmlEntity_traits } from "./inline/html-entity.js";
import { bang_bracket_traits, image_traits } from "./inline/image.js";
import { bracket_traits, link_traits } from "./inline/link.js";
import { rawHTML_traits } from "./inline/raw-html.js";
import { lineContent, linify, LogicalLine, LogicalLine_with_cmt } from "./linify.js";
import { AnyBlock, Block, BlockBase, BlockType, BlockType_Container, InlineElement, InlineElementType, isContainer, MarkdownParserContext, MarkiDocument } from "./markdown-types.js";
import { AnyBlockTraits, BlockTraits, BlockTraits_Container, DelimiterTraits, InlineParserTraitsList } from "./traits.js";
import { blockIterator, LLinfo } from "./util.js";

interface BlockParserProviderItem {
	parent: MarkdownParser;
	parser: BlockParserBase | undefined;
}
type BlockParserProviderCache = {
	[K in BlockType]: BlockParserProviderItem | undefined;
};

export interface ParseState {
	tryOrderName: string | undefined;
	container:    BlockContainer;
	curParser:    BlockParser | null;
	generator:    Generator<BlockParser> | null;
	retry?:       LogicalLine;
}


export type TakeBlockResult = {
	finished_block: AnyBlock;
	lineAfter:      LogicalLine | null;
	ended_by?:      BlockParser | "eof";
};


export const standardInlineParserTraits: InlineParserTraitsList = {
	escaped:    escaped_traits,
	codeSpan:   codeSpan_traits,
	link:       link_traits,
	hardBreak:  hardBreak_traits,
	htmlEntity: htmlEntity_traits,
	image:      image_traits,
	autolink:   autolink_traits,
	rawHTML:    rawHTML_traits
};

export const standardDelimiterTraits: Record<string, DelimiterTraits> = {
	emph_asterisk:   emphasis_traits_asterisk,
	emph_underscore: emphasis_traits_underscore,
	bracket:         bracket_traits,
	bang_bracket:    bang_bracket_traits // ![ ... ] — in CommonMark only used for image descriptions
}

export class BlockParserProvider {
	constructor(MDPT: MarkdownParserTraits, ctx: ParsingContext, customTryOderName?: string) {
		this.ctx  = ctx;
		this.MDPT = MDPT;
		this.tryOrder = MDPT.tryOrder;
		if(customTryOderName) {
			this.tryOrder = MDPT.customTryOrders[customTryOderName];
			if(!this.tryOrder)
				throw new Error(`Custom block try order "${customTryOderName}" not found in MarkdownParserTraits`);
		}
	}

	cache: Partial<BlockParserProviderCache> = { };
	release(P: BlockParserBase) {
		if(this.cache[P.type]?.parser !== P)
			throw new Error(`Trying to release a block parser for "${P.type}" that isn't in the cache`);
		this.cache[P.type] = undefined;
		return P;
	}

	*interrupters(interruptee: BlockParser): Generator<BlockParser> { yield* this.run("interrupters", interruptee.type, interruptee.parent || this.ctx.MDP); }
	*mainBlocks  (BC?: BlockContainer):      Generator<BlockParser> { yield* this.run("tryOrder",     undefined, BC || this.ctx.MDP); }

	*run(s: "tryOrder" | "interrupters", t0: BlockType | undefined, BC: BlockContainer | undefined): Generator<BlockParser> {
		const MDP = this.ctx.MDP;
		const L = this.tryOrder;
		const blockTraitsList = this.MDPT.blockTraitsList;
		const allowSelfInterrupt = (t0 && blockTraitsList[t0]?.canSelfInterrupt);
		for(let i = 0, iN = L.length;  i < iN;  ++i) {
			const key = L[i];
			if(s === "interrupters" && !blockTraitsList[key]?.isInterrupter)
				continue;
			const PP = this.cache[key] || (this.cache[key] = { parent: MDP,  parser: undefined });
			if(!PP.parser)
				PP.parser = MDP.makeParser(key, this) as any;
			const P = PP.parser as BlockParser;
			if(P.type !== t0 || allowSelfInterrupt) {
				P.parent = BC; // where will a finished block be stored — either the central MarkdownParser instance or a container block
				P.isInterruption = (s === "interrupters");
				yield P;
			}
		}
	}

	MDPT: MarkdownParserTraits;
	ctx: ParsingContext;
	tryOrder: BlockType[];
}



export class MarkdownParserTraits {
	blockTraitsList: Partial<Record<BlockType, AnyBlockTraits>>;
	tryOrder: BlockType[];

	constructor() {
		this.blockTraitsList = { };
		this.tryOrder = standardBlockTryOrder.map(bt => (this.blockTraitsList[bt.blockType] = bt).blockType);

		this.inlineParser_standard = new InlineParserProvider(this);
		this.inlineParser_minimal  = new InlineParserProvider(this);

		this.inlineParser_standard.traits = { ... standardInlineParserTraits };
		this.inlineParser_standard.delims = { ... standardDelimiterTraits };
		this.inlineParser_standard.makeStartCharMap();

		this.inlineParser_minimal.traits = {
			escaped:    escaped_traits,
			htmlEntity: htmlEntity_traits
		};
		this.inlineParser_minimal.delims = { ... standardDelimiterTraits };
		this.inlineParser_minimal.makeStartCharMap();

		this.globalCtx = { tier2_command_char: '$' } as Tier2_ctx; // If the tier 2 extension isn't hooked in this has no effect
	}

	inlineParser_standard: InlineParserProvider;
	inlineParser_minimal:  InlineParserProvider;
	customInlineParserProviders: Record<string, InlineParserProvider> = { };
	customTryOrders: Record<string, BlockType[]> = { };
	afterBlockParsingSteps: {
		unparallel: BlockType[];
		parallel:   BlockType[];
	} = { unparallel: [],  parallel: [ "listItem" ] };
	afterInlineSteps: InlineElementType[] = [];
	globalCtx: MarkdownParserContext; // for caching of data which isn't restricted to a particular document

	addExtensionBlocks(traits: AnyBlockTraits, position: "first" | "last" | "silent"): void; // "silent" means the block doesn't go into the main block try order; it's probably meant for use in some custom try order
	addExtensionBlocks(traits: AnyBlockTraits, position: "before" | "after", before_after: BlockType): void;
	addExtensionBlocks(traits: AnyBlockTraits, position: "first" | "before" | "after" | "last" | "silent", before_after?: BlockType): void {
		const type = traits.blockType;
		if((position === "first" || position === "last" || position === "silent") != !before_after)
			throw new Error('Wrong input for addExtensionBlocks');

		if(traits.processingStep) {
			if(traits.processingStepParallelable === false && !this.afterBlockParsingSteps.unparallel.some(t => t === type))
				this.afterBlockParsingSteps.unparallel.push(type);
			if(traits.processingStepParallelable !== false && !this.afterBlockParsingSteps.parallel.some(t => t === type))
				this.afterBlockParsingSteps.parallel.push(type);
		}
		if(this.blockTraitsList[type]) {
			// just replace existing block type, don't change position
			this.blockTraitsList[type] = traits;
			return;
		}
		this.blockTraitsList[type] = traits;

		if(position === "silent")
			return;
		if(position === "first") {
			position = "after";
			before_after = "emptySpace";
		}
		if(position === "last") {
			position = "before";
			before_after = "paragraph";
		}

		const i_b_a = this.tryOrder.findIndex(bt => bt === before_after);
		if(i_b_a < 0)
			throw new Error(`Wanting to place extension ${position} "${before_after}", but we don't have that block type in the list.`);
		this.tryOrder.splice(i_b_a + (position === "after" ? 1 : 0), 0, type);
	}

	updateStartCharMaps() {
		this.inlineParser_standard.makeStartCharMap();
		this.inlineParser_minimal .makeStartCharMap();
		for(const IPP in this.customInlineParserProviders)
			this.customInlineParserProviders[IPP].makeStartCharMap();
	}

	findLinkDef(MDP: MarkdownParser, label: string, B: InlineElement<"link"> | InlineElement<"image">): Block<"linkDef"> | undefined {
		label = label.trim().replace(/[ \t\r\n]+/g, ' ').toLowerCase().toUpperCase();
		return MDP.localCtx.linkDefs[label];
	}
}


export const global_MDPT = new MarkdownParserTraits();



export class MarkdownParser implements BlockContainer, ParsingContext {
	MDPT: MarkdownParserTraits;
	globalCtx: MarkdownParserContext;
	localCtx:  MarkdownLocalContext;
	MDP: MarkdownParser;

	constructor(MDPT?: MarkdownParserTraits) {
		this.MDP       = this;
		this.MDPT      = MDPT || global_MDPT;
		this.globalCtx = this.MDPT.globalCtx;
		this.localCtx  = {
			URL: undefined,
			linkDefs: { }
		}; // TODO!!
		this.blockParserProvider = new BlockParserProvider(this.MDPT, this);

		this.MDPT.updateStartCharMaps();
	}

	/*scheduleExtension(prom: () => Promise<(MDP: MarkdownParser) => void>) {
		prom().then(ext => {
			console.error('???????Wha?')
			ext(this);
		});
	}

	loadPlugin(pluginFile: string) {
		
	}*/

	reset() {
		for (const key in this.localCtx)
			delete this.localCtx[key];
		this.localCtx.linkDefs = { };
	}

	blockSteps(input: string) {
		const LLs = linify(input, false); // TODO!!
        const blocks = this.processContent(LLs[0], undefined);
		return blocks;
	}

	/* Full parsing of a complete document (contents as string) */
	processDocument(doc: MarkiDocument): Promise<MarkiDocument> {
		if(doc.input === undefined)
			throw new Error(`MarkdownParser.processDocument: document has no input content, please load it first!`);
		this.reset();
		this.localCtx.URL = doc.URL;
		doc.localCtx = this.localCtx;

		const LLs = linify(doc.input, false); // TODO!!
        doc.blocks = this.processContent(LLs[0], undefined);
		return this.processAfterBlockParsing(doc)
		.then(() => {
			for(const B of blockIterator(doc.blocks)) {
				this.processBlock(B, this);
				if(B.inlineContent)
					pairUpDelimiters(B.inlineContent);
			}
		}).then(() => this.processAfterInlineStep()).then(() => doc)
		.catch(exc => {
			console.log('Error in processDocument', exc);
			return doc;
		});
	}

	startBlock   = startBlock;
	processLine  = processLine;

	processContent(LL: LogicalLine_with_cmt, tryOrderName: string | undefined): AnyBlock[] {
		this.blocks = [];
		let LL0: LogicalLine_with_cmt | null = LL;
		while(LL0) {
			const P: ParseState = processLines.call(this, LL0, null, { tryOrderName,  container: this,  curParser: null,  generator: null });
			if(this.diagnostics)    console.log(`Coming out of parsing with open block`, P.curParser?.type, P.curParser?.getCheckpoint());
			LL0 = (P.curParser?.finish()?.next || null);
		}
		return this.blocks;
	}

	processBlock(B: AnyBlock, ctx: ParsingContext, PP?: InlineParserProvider) {
		const T = this.MDPT.blockTraitsList[B.type];
		if(!T)    throw new Error(`Cannot process content of block "${B.type}"`);
		if(isContainer(B)) {
			const T1 = T as BlockTraits_Container<any>;
			B.blocks.forEach((B1, i) => this.processBlock(B1, ctx, T1.customChildParser?.(B, i, ctx)));
		}
		else if((T.inlineProcessing === undefined || T.inlineProcessing === true) && B.content)
			B.inlineContent = this.processInline(B.content, PP || T.customContentParser);
		else if(typeof T.inlineProcessing === "function")
			T.inlineProcessing.call(ctx, B);
	}

    processInline = processInline;

	processAfterBlockParsing(doc: MarkiDocument) {
		let prom = Promise.resolve();
		for(const k of this.MDPT.afterBlockParsingSteps.unparallel) {
			const step = this.MDPT.blockTraitsList[k]?.processingStep;
			if(step)
				prom = prom.then(() => step.call(this, doc));
		}
		return prom.then(() => Promise.all(this.MDPT.afterBlockParsingSteps.parallel
				.map(k => (this.MDPT.blockTraitsList[k]?.processingStep)?.call(this, doc))).then(() => { }));
	}

	processAfterInlineStep() {
		return Promise.all(this.MDPT.afterInlineSteps.map(k => {
			const fct = this.MDPT.inlineParser_standard.traits[k]?.processingStep;
			return (fct ? fct.call(this) : Promise.resolve());
		})).then(() => {});
	}

	isContainerType(type: BlockType): type is BlockType_Container {
		const traits = this.MDPT.blockTraitsList[type];
		return !!((traits && "containerMode" in traits && traits.containerMode === "Container") || false);
	}

	makeParser<K extends BlockType>(type: K, PP: BlockParserProvider) {
		const traits = this.MDPT.blockTraitsList[type] as BlockTraits<K> | undefined;
		if(!traits)
			throw new Error(`Missing block parser traits for block type "${type}"`)
		if(traits.creator)
			return traits.creator(PP, type);

		// No individual parser creator function found -> use the default version
		if(this.isContainerType(type))
			return new BlockParser_Container<typeof type>(PP, type, traits as BlockTraits_Container<typeof type>);
		else
			return new BlockParser_Standard<K>(PP, type, traits);
	}

	private blockParserProvider: BlockParserProvider;
	customBlockParserProviders: Record<string, BlockParserProvider> = {};
	getBlockParserProvider(tryOrderName: string | undefined) {
		if(!tryOrderName)
			return this.blockParserProvider;
		let PP = this.customBlockParserProviders[tryOrderName];
		if(PP)
			return PP;
		return (this.customBlockParserProviders[tryOrderName] = new BlockParserProvider(this.MDPT, this, tryOrderName));
	}

	addContentBlock<K extends BlockType>(B: BlockBase<K>) { this.blocks.push(B as AnyBlock); }
	blocks: AnyBlock[] = [];
	blockContainerType = "MarkdownParser" as const;
	diagnostics = false;

	registerLinkDef(B: Block<"linkDef">) {
		/* CommonMark: "Consecutive internal spaces, tabs, and line endings are treated as one space for purposes of determining matching" */
		// Note: CommonMark prescribes "Unicode case fold", but the reference implementation just does this ".toLowerCase().toUpperCase()"
		//       procedure, so apparently that's good enough.
		const label = B.linkLabel.trim().replace(/[ \t\r\n]+/g, ' ').toLowerCase().toUpperCase();
		this.localCtx.linkDefs[label] ||= B; // ||= because the first occurance of a link label takes precedence
	}
}; // class MarkdownParser



/**********************************************************************************************************************/

export function startBlock(this: MarkdownParser, ctx: ParseState, LL: LogicalLine_with_cmt, interrupting?: BlockType): ParseState {
	if(!ctx.generator)
		ctx.generator = this.getBlockParserProvider(ctx.tryOrderName).mainBlocks(ctx.container);

	let I: IteratorResult<BlockParser, any> | undefined;
	while(!(I = ctx.generator.next()).done) {
		const PA = I.value;
		
		const n = PA.beginsHere(LL, interrupting);
		//if(this.diagnostics)    console.log(`Trying "${PA.type}" for line ${LLD.logl_idx} -> ${n}`);
		if(n >= 0) {
			if(this.diagnostics)    console.log(`  Processing line ${LLinfo(LL)} -> start <${PA.type}>`);
			PA.acceptLine(LL, "start", n);
			ctx.curParser = PA;
			return ctx;
		}
	}
	if(this.diagnostics)    console.log(`  Processing line ${LLinfo(LL)} -> no interruption of <${interrupting}>`);
	ctx.generator = null;
	ctx.curParser = null;
	return ctx;
}


export function processLine(this: MarkdownParser, PP: ParseState, LL: LogicalLine_with_cmt): ParseState {
	const { tryOrderName, container, curParser, generator } = PP;
	PP.retry = undefined;
	if(this.diagnostics)    console.log(`  processLine ${LLinfo(LL)} in ${container.blockContainerType} ${curParser ? `continuing <${curParser.type}>` : 'starting a new block'}`);

	if(!curParser) { // start a new block
		this.startBlock(PP, LL);
		if(!PP.curParser) {
			const s = lineContent(LL);
			throw new Error(`Line ${LL.lineIdx} doesn't belong to any block, that's not possible!  Content "${s.length > 32 ? s.slice(0, 32) + ' ...' : s}"`);
		}
		return PP;
	}

	// continue an existing block
	const bct = curParser.continues(LL);
	if(this.diagnostics)    console.log(`  Processing line ${LLinfo(LL)} in <${PP.curParser?.type}> -> ${bct}`)
	switch(bct) {
	case "end": // current block cannot continue in this line, i.e. it ends on its own
		{
			const LLD_last = curParser.finish();
			return { tryOrderName,  container,  retry: LLD_last.next! as LogicalLine,  curParser: null,  generator: null }; // will start a new block in the current line
		}
	case "last":
		curParser.acceptLine(LL, bct, 0);
		curParser.finish();
		return { tryOrderName,  container,  curParser: null,  generator: null }; // will start a new block in the next line
	case "reject":
		if(curParser.isInterruption)
			throw new Error('Problem! Rejecting a block that interrupted another block is a bit too much in terms of backtracking, so we don\'t allow that.');
		// schedule backtracking:
		return { tryOrderName,  container,  retry: curParser.getCheckpoint() || curParser.startLine!,  curParser: null,  generator };
	case "soft": // it's a soft continuation, which means it's possible that the next block begins here, interrupting the current one
		{
			const generator = this.getBlockParserProvider(tryOrderName).interrupters(curParser)
			const P1 = this.startBlock({ tryOrderName,  container,  curParser: null,  generator }, LL, curParser.type).curParser;
			if(P1) {
				curParser.finish();
				PP.curParser = P1;
				// since the generator would only be used if this block gets rejected, and we don't allow rejection on an interruption, we don't pass on the generator
				PP.generator = null;
				return PP;
			}
		}
		// soft continuation wasn't interrupted, we can accept it
		if(this.diagnostics)    console.log(`  Not interrupted -> accept line ${LL.lineIdx} as <${PP.curParser?.type}>`)
		curParser.acceptLine(LL, bct, 0);
		return PP;
	default: // hard accept
		curParser.acceptLine(LL, bct, bct);
		return PP;
	}
}



function processLines(this: MarkdownParser, LL0: LogicalLine_with_cmt, LL1: LogicalLine_with_cmt | null, PP: ParseState) {
	let curLL: LogicalLine_with_cmt | null = LL0;
	while(curLL && curLL !== LL1) {
		PP = this.processLine(PP, curLL);
		if(PP.retry) {
			if(this.diagnostics)    console.log(`* Retry in line ${LLinfo(PP.retry)}`);
			curLL = PP.retry;
		} else {
			if(this.diagnostics)    console.log(`* Proceed ${curLL.lineIdx}->${LLinfo(curLL.next)}`);
			curLL = curLL.next || null;
		}
	}
	if(this.diagnostics)    console.log(`Out!`)
	return PP;
}
