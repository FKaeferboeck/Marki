import { BlockContainer, BlockParser, BlockParserBase, BlockParser_Container, BlockParser_Standard, ParsingContext, standardBlockTryOrder } from "./block-parser.js";
import { collectLists } from "./blocks/listItem.js";
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
import { linify, LogicalLine, LogicalLine_with_cmt } from "./linify.js";
import { AnyBlock, Block, BlockBase, BlockType, BlockType_Container, isContainer, MarkdownParserContext } from "./markdown-types.js";
import { AnyBlockTraits, BlockTraits, BlockTraits_Container, DelimiterTraits, InlineParserTraitsList } from "./traits.js";
import { LLinfo } from "./util.js";

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
	retry?:    LogicalLine;
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

class BlockParserProvider {
	constructor(ctx: ParsingContext) {
		this.ctx = ctx;
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
		const L = MDP.tryOrder;
		const allowSelfInterrupt = (t0 && MDP.traitsList[t0]?.canSelfInterrupt);
		for(let i = 0, iN = L.length;  i < iN;  ++i) {
			const key = L[i];
			if(s === "interrupters" && !MDP.traitsList[key]?.isInterrupter)
				continue;
			const PP = this.cache[key] || (this.cache[key] = { parent: MDP,  parser: undefined });
			if(!PP.parser)
				PP.parser = MDP.makeParser(key, this.ctx) as any;
			const P = PP.parser as BlockParser;
			if(P.type !== t0 || allowSelfInterrupt) {
				P.parent = BC; // where will a finished block be stored — either the central MarkdownParser instance or a container block
				P.isInterruption = (s === "interrupters");
				yield P;
			}
		}
	}
	ctx: ParsingContext;
}





export class MarkdownParser implements BlockContainer {
	constructor() {
		this.traitsList = { };
		this.tryOrder = standardBlockTryOrder.map(bt => (this.traitsList[bt.blockType] = bt).blockType);

		this.ctx = {
			MDP: this,
			globalCtx: { tier2_command_char: '$' } as Tier2_ctx,
			localCtx: { } // TODO!!
		};

		this.inlineParser_standard = new InlineParserProvider(this.ctx);
		this.inlineParser_minimal  = new InlineParserProvider(this.ctx);

		this.inlineParser_standard.traits = { ... standardInlineParserTraits };
		this.inlineParser_standard.delims = { ... standardDelimiterTraits };
		this.inlineParser_standard.makeStartCharMap();

		this.inlineParser_minimal.traits = {
			escaped:    escaped_traits,
			htmlEntity: htmlEntity_traits
		};
		this.inlineParser_minimal.delims = { ... standardDelimiterTraits };
		this.inlineParser_minimal.makeStartCharMap();

		this.blockParserProvider = new BlockParserProvider(this.ctx); // TODO!!
	}

	addExtensionBlocks(traits: AnyBlockTraits, position: "first" | "last"): void;
	addExtensionBlocks(traits: AnyBlockTraits, position: "before" | "after", before_after: BlockType): void;
	addExtensionBlocks(traits: AnyBlockTraits, position: "first" | "before" | "after" | "last", before_after?: BlockType): void {
		const type = traits.blockType;
		if((position === "first" || position === "last") != !before_after)
			throw new Error('Wrong input for addExtensionBlocks');
		if(this.traitsList[type]) {
			// just replace existing block type, don't change position
			this.traitsList[type] = traits;
			return;
		}
		this.traitsList[type] = traits;

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

	scheduleExtension(prom: () => Promise<(MDP: MarkdownParser) => void>) {
		prom().then(ext => {
			
			console.error('???????Wha?')
			ext(this);
		});
	}

	loadPlugin(pluginFile: string) {
		
	}

	reset() {
		this.linkDefs = {};
	}

	/* Full parsing of a complete document (contents as string) */
	processDocument(input: string): AnyBlock[] {
		this.reset();
		const ctx = this.ctx; // TODO!!
		const LLs = linify(input, false); // TODO!!
        const blocks = this.processContent(LLs[0]);
        collectLists(blocks);
        blocks.forEach(B => {
            this.processBlock(B, ctx);
            if(B.inlineContent)
                pairUpDelimiters(B.inlineContent);
        });
		return blocks;
	}

	startBlock   = startBlock;
	processLine  = processLine;
	processLines = processLines;

	processContent(LL: LogicalLine_with_cmt): AnyBlock[] {
		this.blocks = [];
		let LL0: LogicalLine_with_cmt | null = LL;
		while(LL0) {
			const P = this.processLines(LL0, null, { container: this,  curParser: null,  generator: null });
			if(this.diagnostics)    console.log(`Coming out of parsing with open block`, P.curParser?.type, P.curParser?.getCheckpoint());
			LL0 = (P.curParser?.finish()?.next || null);
		}
		return this.blocks;
	}

	processBlock(B: AnyBlock, ctx: ParsingContext) {
		const T = this.traitsList[B.type];
		if(!T)    throw new Error(`Cannot process content of block "${B.type}"`);
		if(isContainer(B))
			B.blocks.forEach(B1 => this.processBlock(B1, ctx));
		else if((T.inlineProcessing === undefined || T.inlineProcessing === true) && B.content)
			B.inlineContent = this.processInline(B.content);
		else if(typeof T.inlineProcessing === "function")
			T.inlineProcessing.call(ctx, B);
	}

    processInline = processInline;

	traitsList: Partial<Record<BlockType, AnyBlockTraits>>;
	tryOrder: BlockType[];

	isContainerType(type: BlockType): type is BlockType_Container {
		const traits = this.traitsList[type];
		return !!((traits && "isContainer" in traits && traits.isContainer) || false);
	}

	makeParser<K extends BlockType>(type: K, ctx: ParsingContext) {
		const traits = this.traitsList[type] as BlockTraits<K> | undefined;
		if(!traits)
			throw new Error(`Missing block parser traits for block type "${type}"`)
		if(traits.creator)
			return traits.creator(ctx, type);

		// No individual parser creator function found -> use the default version
		if(this.isContainerType(type))
			return new BlockParser_Container<typeof type>(ctx, type, traits as BlockTraits_Container<typeof type>);
		else
			return new BlockParser_Standard<K>(ctx, type, traits);
	}

	ctx: ParsingContext;
	blockParserProvider: BlockParserProvider;
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

    inlineParser_standard: InlineParserProvider;
	inlineParser_minimal:  InlineParserProvider;
	customInlineParserProviders: Record<string, InlineParserProvider> = { };
};



/**********************************************************************************************************************/

export function startBlock(this: MarkdownParser, ctx: ParseState, LL: LogicalLine_with_cmt, interrupting?: BlockType): ParseState {
	if(!ctx.generator)
		ctx.generator = this.blockParserProvider.mainBlocks(ctx.container);

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
	const { container, curParser, generator } = PP;
	PP.retry = undefined;
	if(this.diagnostics)    console.log(`  processLine ${LLinfo(LL)} in ${container.blockContainerType} ${curParser ? `continuing <${curParser.type}>` : 'starting a new block'}`);

	if(!curParser) { // start a new block
		this.startBlock(PP, LL);
		if(!PP.curParser)
			throw new Error(`Line ${LL.lineIdx} doesn't belong to any block, that's not possible!`)
		return PP;
	}

	// continue an existing block
	const bct = curParser.continues(LL);
	if(this.diagnostics)    console.log(`  Processing line ${LLinfo(LL)} in <${PP.curParser?.type}> -> ${bct}`)
	switch(bct) {
	case "end": // current block cannot continue in this line, i.e. it ends on its own
		{
			const LLD_last = curParser.finish();
			return { container,  retry: LLD_last.next! as LogicalLine,  curParser: null,  generator: null }; // will start a new block in the current line
		}
	case "last":
		curParser.acceptLine(LL, bct, 0);
		curParser.finish();
		return { container,  curParser: null,  generator: null }; // will start a new block in the next line
	case "reject":
		if(curParser.isInterruption)
			throw new Error('Problem! Rejecting a block that interrupted another block is a bit too much in terms of backtracking, so we don\'t allow that.');
		// schedule backtracking:
		return { container,  retry: curParser.getCheckpoint() || curParser.startLine!,  curParser: null,  generator };
	case "soft": // it's a soft continuation, which means it's possible that the next block begins here, interrupting the current one
		{
			const P1 = this.startBlock({ container,  curParser: null,  generator: this.blockParserProvider.interrupters(curParser) }, LL, curParser.type).curParser;
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



export function processLines(this: MarkdownParser, LL0: LogicalLine_with_cmt, LL1: LogicalLine_with_cmt | null, PP: ParseState) {
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
