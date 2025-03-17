import { blockQuote_traits } from './blocks/blockQuote.js';
import { emptySpace_traits } from './blocks/emptySpace.js';
import { fenced_traits } from './blocks/fenced.js';
import { thematicBreak_traits } from './blocks/thematicBreak.js';
import { indentedCodeBlock_traits } from './blocks/indentedCodeBlock.js';
import { paragraph_traits } from './blocks/paragraph.js';
import { sectionHeader_traits } from './blocks/sectionHeader.js';
import { sectionHeader_setext_traits } from './blocks/sectionHeader_setext.js';
import { Block, BlockBase, BlockType, BlockTypeMap, ContainerBlockBase, ExtensionBlockType, LogicalLineData } from './markdown-types.js';
import { TextPart, LineStructure, lineType, LogicalLine, LinePart, LogicalLineType } from './parser.js';
import { BlockParserTraitsList, BlockContinuationType, BlockTraits, ContainerBlockTraits } from './traits.js';
import { LLDinfo, sliceLLD } from './util.js';
import { listItem_traits } from './blocks/listItem.js';



export const standardBlockParserTraits: BlockParserTraitsList = {
	emptySpace:           emptySpace_traits,
	paragraph:            paragraph_traits,
	sectionHeader:        sectionHeader_traits,
	blockQuote:           blockQuote_traits,
	thematicBreak:        thematicBreak_traits,
	sectionHeader_setext: sectionHeader_setext_traits,
	indentedCodeBlock:    indentedCodeBlock_traits,
	fenced:               fenced_traits,
	listItem:             listItem_traits
};


export interface BlockContainer {
	addContentBlock(B: Block): void;
	blockContainerType: "containerBlock" | "MarkdownParser";
}


export interface BlockParser<BT extends Block> {
	type: BlockType;
	// Does a block of this type begin in that logical line, and can it interrupt the given currently open block?
	beginsHere(LLD: LogicalLineData, interrupting?: BlockType | undefined): number;

	// assuming this line doesn't contain a block start that interrupts the block parsed herein, does that block continue in this logical line?
	continues(LLD: LogicalLineData, isSoftContainerContinuation?: boolean): BlockContinuationType;

	acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start", prefix_length: number): void;

	finish(): LogicalLineData; // store the finished block with its surrounding container, return the last line that was accepted

	setCheckpoint(LLD: LogicalLineData): void;
	getCheckpoint(): LogicalLineData | null;
	MDP: MarkdownParser;
	parent: BlockContainer | undefined;
	B: BT;
	isInterruption: boolean;
	startLine: LogicalLineData | undefined;
	blockContainerType: BlockContainer["blockContainerType"] | "none";
}


export class BlockParser_Standard<K extends BlockType = ExtensionBlockType, Traits extends BlockTraits<K> = BlockTraits<K>> implements BlockParser<BlockBase<K>> {
	type: BlockType;

	constructor(MDP: MarkdownParser, traits: Traits, useSoftContinuations: boolean = true) {
		this.MDP = MDP;
		this.type = traits.defaultBlockInstance.type;
		this.traits = traits;
		this.B = structuredClone(traits.defaultBlockInstance); // make a deep copy because the block object contains arrays
		this.useSoftContinuations = useSoftContinuations;
	}

	static textLines: Partial<Record<LogicalLineType, boolean>> = { text: true,  single: true };

	beginsHere(LLD: LogicalLineData, interrupting?: BlockType | undefined): number {
		if(!BlockParser_Standard.textLines[LLD.type])
			return -1;

		const starts = this.traits.startsHere.call(this, LLD, this.B, interrupting);
		if(starts < 0)    return -1;
		this.B.logical_line_start  = LLD.logl_idx;
		this.B.logical_line_extent = 1;
		this.MDP.blockParserProvider.release(this);
		return starts;
	}

	continues(LLD: LogicalLineData, isSoftContainerContinuation?: boolean): BlockContinuationType {
		const ret = (t: BlockContinuationType) => {
			if(t === "soft" && isSoftContainerContinuation)
				LLD.isSoftContainerContinuation = true;
			return t;
		};

		if (this.traits.continuesHere) {
			const x = this.traits.continuesHere.call(this, LLD, isSoftContainerContinuation);
			if(typeof x !== "undefined")
				return ret(x);
		}

		if(LLD.type === "empty")
			return ret("end");
		if(LLD.type === "comment")
			return ret(this.traits.allowCommentLines ? "soft" : "end");

		const cpfx = this.traits.continuationPrefix;
		if(cpfx) {
			if(typeof cpfx === "function")
				return ret(cpfx(LLD, this.B));
			const rexres = cpfx.exec(LLD.startPart);
			if(rexres)
				return ret(rexres[0].length);
		}
		return ret(this.traits.allowSoftContinuations ? "soft" : "end");
	}

	acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start", prefix_length: number) {
		if(this.traits.acceptLineHook && !this.traits.acceptLineHook.call(this, LLD, bct))
			return;
		if(bct === "start")
			this.startLine = LLD;
		//if(this.MDP.diagnostics)    console.log('acceptLine into', this.type, LLD, prefix_length, sliceLLD(LLD, prefix_length))

		// We prepare the content part of the line for acceptance, even if we don't accept it right away due to checkpoint (and perhaps never will)
		// This way when the next checkpoint arrives we have the pending content lines in the linked list.
		// continuing lines inside block containers are already enqueued during continues().
		if((this.blockContainerType !== "containerBlock" /*|| bct === "start"*/) &&
		   !(bct === "last" && !this.traits.lastIsContent))
			this.enqueueContentSlice(LLD, prefix_length, bct);

		if(this.checkpoint && LLD.logl_idx > this.checkpoint.logl_idx)
			return;
		this.lastLine = LLD;
		this.B.logical_line_extent = LLD.logl_idx - this.B.logical_line_start + 1;
		if(bct !== "last" || this.traits.lastIsContent) {
			// flush pending content lines to the block contents array
			const n = this.B.contents.length;
			let LLD_content = (n > 0 ? (this.B.contents[n - 1] as LogicalLineData).next : this.lastEnqueuedContent!)
			for(;  LLD_content;  LLD_content = LLD_content.next) {
				this.B.contents.push(LLD_content);
				if(this.MDP.diagnostics)    console.log(`      Adding content ${LLDinfo(LLD_content)} to "${this.type}"`);
			}
		}
	}

	finish(): LogicalLineData {
		if(this.traits.finalizeBlockHook)
			this.traits.finalizeBlockHook.call(this);
		if(this.parent)
			this.parent.addContentBlock(this.B);
		//container.addContentBlock(this.B);
		if(this.MDP.diagnostics)    console.log(`  Finish [${this.type}], to continue in line ${(this.lastLine?.logl_idx || 0) + 1}`)
		return this.lastLine!;
	}

	setCheckpoint(LLD: LogicalLineData) { this.checkpoint = LLD; }
	getCheckpoint(): LogicalLineData | null { return this.checkpoint || null; }
	MDP: MarkdownParser;
	parent: BlockContainer | undefined;
	traits: Traits;
	B: Traits["defaultBlockInstance"];
	isInterruption: boolean = false;
	startLine:  LogicalLineData | undefined;
	lastLine:   LogicalLineData | undefined; // the line most recently added to the block through acceptLine()
	checkpoint: LogicalLineData | undefined;
	lastEnqueuedContent: LogicalLineData | undefined;
	blockContainerType: BlockContainer["blockContainerType"] | "none" = "none";
	readonly useSoftContinuations: boolean;

	protected enqueueContentSlice(LLD: LogicalLineData, slice_length: number, bct?: BlockContinuationType | "start") {
		// because a block container might try to double enqueue a line
		if((this.lastEnqueuedContent?.logl_idx || -1) >= LLD.logl_idx)
			//return this.lastEnqueuedContent.contentSlice!;
			throw new Error(`Trying to double enqueue cline ${LLDinfo(LLD)}`);

		let LLD_C = sliceLLD(LLD, slice_length);
		if(typeof bct !== "undefined" && this.traits.postprocessContentLine)
			LLD_C = this.traits.postprocessContentLine.call(this, LLD_C, bct);

		if(this.lastEnqueuedContent)
			this.lastEnqueuedContent.next = LLD_C;
		this.lastEnqueuedContent = LLD_C;
		if(this.MDP.diagnostics)    console.log(`      Enqueuing ${LLDinfo(LLD)}>${LLDinfo(LLD_C)} in <${this.type}>`)
		return LLD_C;
	}
}



export class BlockParser_Container<K extends BlockType = ExtensionBlockType>
    extends BlockParser_Standard<K, ContainerBlockTraits<K>>
    implements BlockContainer
{
    constructor(MDP: MarkdownParser, traits: ContainerBlockTraits<K>, useSoftContinuations: boolean = true) {
        super(MDP, traits, useSoftContinuations);
        this.curContentParser = { container: this,  curParser: null,  generator: null };
    }

    beginsHere(LLD: LogicalLineData, interrupting?: BlockType | undefined): number {
        const n0 = super.beginsHere(LLD, interrupting);
		if(n0 < 0)
			return n0;
		const LLD_c = this.enqueueContentSlice(LLD, n0);
        this.curContentParser = this.MDP.processLine({ container: this,  curParser: null,  generator: null }, LLD_c);
        if(!this.curContentParser.curParser)
            throw new Error(`Content of container ${this.type} not recognized as any block type!`);
		return n0;
	}

    continues(LLD: LogicalLineData): BlockContinuationType {
        let cont = super.continues(LLD);
		if(this.MDP.diagnostics && cont !== "soft")    console.log(`  block container <${this.type}> continues at line ${LLD.logl_idx}? ${cont}`);
		if(cont === "end")
			return cont;
			
		/* The following line will sometimes cause a line to be enqueued that in the end isn't used because the block ends,
		 * but that doesn't hurt. It keept the code simpler. */
		const LLD_c = this.enqueueContentSlice(LLD, typeof cont === "number" ? cont : 0);

		if(typeof cont === "number") {
			//const LLD_c = this.enqueueContentSlice(LLD, cont);
			let curLLD = LLD_c;
			while(true) {
				if(this.MDP.diagnostics)    console.log(`      = Parsing content slice ${LLDinfo(curLLD)} inside ${this.type}`);
				this.curContentParser = this.MDP.processLine(this.curContentParser, curLLD);
				if(this.curContentParser.retry) {
					curLLD = this.curContentParser.retry;
					if(this.MDP.diagnostics)    console.log(`      = Retry in line ${LLDinfo(curLLD)}`);
				} else if(curLLD.logl_idx < LLD_c.logl_idx) { // this can only happen during backtracking due to a rejected content block
					if(this.MDP.diagnostics)    console.log(`      = Proceed ${curLLD.logl_idx}->${LLDinfo(curLLD.next)}  (because we haven't reached ${LLDinfo(LLD_c)})`);
					curLLD = curLLD.next!;
				} else
					break;
			}
		}
		else if(cont === "soft") {
			const P = this.curContentParser.curParser;
			if(!P)
				throw new Error('Continuing line of a block container but there is no current content parser');
			

			// only paragraph content can softly continue a container block
			// if there's nested block containers the innermost content is the one that counts, so we delegate the decision to the inner container
			if(P.blockContainerType == "none" && P.type !== "paragraph") {
				if(this.MDP.diagnostics)    console.log(`  block container <${this.type}> softly continues at line ${LLD.logl_idx} with content <${P.type}>? No, it's not paragraph content`);
				return "end";
			}

			//const LLD_c = this.enqueueContentSlice(LLD, 0);
			cont = P.continues(LLD_c, true);

			// The following behavior isn't fully clear from the CommonMark specification in my opinion, but we replicate what the CommonMark reference implementation does:
			if(cont === "reject")
				cont = "end";
			//const LLD_c = this.enqueueContentSlice(LLD, 0);
			/*if(cont === "soft")
				LLD_c.isSoftContainerContinuation = true;*/
			if(this.MDP.diagnostics)    console.log(`  block container <${this.type}> softly continues at line ${LLD.logl_idx} with content <${P.type}>? -> ${cont}`);
        }
        return cont;
    }

    addContentBlock(B: Block) { this.B.blocks.push(B); }

    acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start") {
		// an accepted soft continuation of a container block means an unprefixed soft continuation of the same line as content (which is a paragraph)
		// contents of hard continuations have already been accepted during continues()
		if(bct === "soft")
			this.curContentParser.curParser?.acceptLine(LLD.contentSlice!, "soft", 0);
        super.acceptLine(LLD, bct, typeof bct === "number" ? bct : 0);
    }

    finish(): LogicalLineData {
        this.curContentParser.curParser?.finish();
        return super.finish();
	}

	curContentType() {
		return this.curContentParser.curParser?.type;
	}

    private curContentParser: ParseState;
	blockContainerType = "containerBlock" as const;
}


export class BlockParser_EmptySpace extends BlockParser_Standard<"emptySpace"> {
    static readonly empties: Partial<Record<LogicalLineType, true>> = { empty: true,  emptyish: true,  comment: true };

    constructor(MDP: MarkdownParser, traits: BlockTraits<"emptySpace">, useSoftContinuations: boolean = true) {
        super(MDP, traits, useSoftContinuations);
	}

    beginsHere(LLD: LogicalLineData): number {
        if(!BlockParser_EmptySpace.empties[LLD.type])
            return -1;
        this.B.logical_line_start  = LLD.logl_idx;
        this.B.logical_line_extent = 1;
		this.MDP.blockParserProvider.release(this);
        return 0;
    }

    continues(LLD: LogicalLineData): BlockContinuationType {
        return (BlockParser_EmptySpace.empties[LLD.type] ? 0 : "end");
    }

    isInterruption: boolean = false;
}



interface BlockParserProviderItem<K extends BlockType> {
	parent: MarkdownParser;
	parser: BlockParser<BlockBase<K>> | undefined;
}
type BlockParserProviderCache = {
	[K in BlockType]: BlockParserProviderItem<K> | undefined;
};

//export type EligibleParsers = Generator<BlockParser<Block>> | BlockParser<Block>;
export interface ParseState {
	container: BlockContainer;
	curParser: BlockParser<Block> | null;
	generator: Generator<BlockParser<Block>> | null;
	retry?:    LogicalLineData;
}


export type TakeBlockResult = {
	finished_block: Block;
	lineAfter:      LogicalLineData | null;
	ended_by?:      BlockParser<Block> | "eof";
};


export class MarkdownParser implements BlockContainer {
	constructor() {
		// TODO!! Adjust traits to the desired configuration
	}

	startBlock   = startBlock;
	processLine  = processLine;
	processLines = processLines;

	processContent(LLD: LogicalLineData) {
		this.blocks = [];
		let LLD0: LogicalLineData | null = LLD;
		while(LLD0) {
			const P = this.processLines(LLD0, null, { container: this,  curParser: null,  generator: null });
			if(this.diagnostics)    console.log(`Coming out of parsing with open block`, P.curParser?.type, P.curParser?.B.contents, P.curParser?.getCheckpoint());
			LLD0 = (P.curParser?.finish()?.next || null);
		}
		
		return this.blocks;
	}


	traitsList:	BlockParserTraitsList = { ... standardBlockParserTraits };
	LS: LineStructure = {
		all: [],
		logical_lines: []
	};

	private makeParser<K extends BlockType>(blockType: K) {
		const traits = this.traitsList[blockType];
		if(!traits)
			throw new Error(`Missing block parser traits for block type "${blockType}"`)
		return traits.creator(this);
	}

	tryOrder: BlockType[] = [
		"emptySpace",
		"indentedCodeBlock", // must be tried first so that the following block types can skip checking for too large indentations
		"thematicBreak",
		"sectionHeader",
		"fenced",
		"blockQuote",
		"listItem",
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
		release(P: BlockParser<Block>) {
			if(this.cache[P.type]?.parser !== P)
				throw new Error(`Trying to release a block parser for "${P.type}" that isn't in the cache`);
			this.cache[P.type] = undefined;
			return P;
		},

		*interrupters(interruptee: BlockParser<Block>): Generator<BlockParser<Block>> { yield* this.run("interrupters", interruptee.type, interruptee.parent || this.MDP); },
		*mainBlocks  (BC?: BlockContainer):             Generator<BlockParser<Block>> { yield* this.run("tryOrder",     undefined, BC || this.MDP); },

		*run(s: "tryOrder" | "interrupters", t0: BlockType | undefined, BC: BlockContainer | undefined): Generator<BlockParser<Block>> {
			const p = (this.MDP as MarkdownParser);
			const L = p[s];
			const allowSeltInterrupt = (t0 && p.traitsList[t0]?.canSelfInterrupt);
			for(let i = 0, iN = L.length;  i < iN;  ++i) {
				const key = L[i];
				const PP = this.cache[key] || (this.cache[key] = { parent: p,  parser: undefined });
				if(!PP.parser)
					PP.parser = p.makeParser(key) as any;
				const P = PP.parser as BlockParser<Block>;
				if(P.type !== t0 || allowSeltInterrupt) {
					P.parent = BC; // where will a finished block be stored — either the central MarkdownParser instance or a container block
					P.isInterruption = (s === "interrupters");
					yield P;
				}
			}
		},
		MDP: this,
	}

	
	addContentBlock(B: Block) { this.blocks.push(B); }
	blocks: Block[] = [];
	blockContainerType = "MarkdownParser" as const;
	diagnostics = false;
};



/**********************************************************************************************************************/

export function startBlock(this: MarkdownParser, ctx: ParseState, LLD: LogicalLineData, interrupting?: BlockType): ParseState {
	if(!ctx.generator)
		ctx.generator = this.blockParserProvider.mainBlocks(ctx.container);

	let I: IteratorResult<BlockParser<Block>, any> | undefined;
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
