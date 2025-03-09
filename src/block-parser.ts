import { blockQuote_traits } from './blocks/blockQuote';
import { emptySpace_traits } from './blocks/emptySpace';
import { fenced_traits } from './blocks/fenced';
import { thematicBreak_traits } from './blocks/thematicBreak';
import { indentedCodeBlock_traits } from './blocks/indentedCodeBlock';
import { paragraph_traits } from './blocks/paragraph';
import { sectionHeader_traits } from './blocks/sectionHeader';
import { sectionHeader_setext_traits } from './blocks/sectionHeader_setext';
import { Block, BlockBase, BlockType, BlockTypeMap, ContainerBlockBase, ExtensionBlockType, LogicalLineData } from './markdown-types';
import { TextPart, LineStructure, lineType, LogicalLine, LinePart, LogicalLineType } from './parser';
import { BlockParserTraitsList, BlockContinuationType, BlockTraits, ContainerBlockTraits } from './traits';
import { sliceLLD } from './util';




export const standardBlockParserTraits: BlockParserTraitsList = {
	emptySpace:           emptySpace_traits,
	paragraph:            paragraph_traits,
	sectionHeader:        sectionHeader_traits,
	blockQuote:           blockQuote_traits,
	thematicBreak:        thematicBreak_traits,
	sectionHeader_setext: sectionHeader_setext_traits,
	indentedCodeBlock:    indentedCodeBlock_traits,
	fenced:               fenced_traits
};


export interface BlockContainer {
	addContentBlock(B: Block): void;
}


export interface BlockParser<BT extends Block> {
	type: BlockType;
	// Does a block of this type begin in that logical line, and can it interrupt the given currently open block?
	beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): number;

	// assuming this line doesn't contain a block start that interrupts the block parsed herein, does that block continue in this logical line?
	continues(LLD: LogicalLineData): BlockContinuationType;

	acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start"): void;

	finish(): void; // store the finished block with its surrounding container

	MDP: MarkdownParser;
	parent: BlockContainer | undefined;
	B: BT;
	isInterruption: boolean;
	startLine: LogicalLineData | undefined;
}


export class BlockParser_Standard<K extends BlockType = ExtensionBlockType, Traits extends BlockTraits<K> = BlockTraits<K>> implements BlockParser<BlockBase<K>> {
	type: BlockType;

	constructor(MDP: MarkdownParser, traits: Traits, useSoftContinuations: boolean = true) {
		this.MDP = MDP;
		this.type = traits.defaultBlockInstance.type;
		this.traits = traits;
		this.B = structuredClone(traits.defaultBlockInstance); // make a deep copy because the block object contains arrays
		this.in_end_space = false;
		this.useSoftContinuations = useSoftContinuations;
	}

	static textLines = { text: true,  single: true };

	beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): number {
		//console.log(`Startin ${this.type} here?`);
		if(!BlockParser_Standard.textLines[LLD.type])
			return -1;

		const starts = this.traits.startsHere(LLD, this.B);
		if(starts < 0)    return -1;
		this.B.logical_line_start  = LLD.logl_idx;
		this.B.logical_line_extent = 1;
		this.MDP.blockParserProvider.release(this);
		return starts;
	}

	continues(LLD: LogicalLineData): BlockContinuationType {
		if (this.traits.continuesHere) {
			const x = this.traits.continuesHere(LLD, this.B);
			if(typeof x !== "undefined")
				return x;
		}

		if(LLD.type === "empty")
			return "end";
		if(LLD.type === "comment")
			return (this.traits.allowCommentLines ? "soft" : "end");

		const cpfx = this.traits.continuationPrefix;
		if(cpfx) {
			if(typeof cpfx === "function")
				return cpfx(LLD, this.B);
			const rexres = cpfx.exec(LLD.startPart);
			if(rexres)
				return rexres[0].length;
		}
		return (this.traits.allowSoftContinuations ? "soft" : "end");
	}

	acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start") {
		if(bct === "start")
			this.startLine = LLD;
		this.B.logical_line_extent = LLD.logl_idx - this.B.logical_line_start + 1;
	}

	finish() {
		//if(this.MDP.diagnostics)    console.log('add content to', this.parent)
		if(this.parent)
			this.parent.addContentBlock(this.B);
		//container.addContentBlock(this.B);
	}

	MDP: MarkdownParser;
	parent: BlockContainer | undefined;
	traits: Traits;//BlockTraits<K>;
	B: Traits["defaultBlockInstance"];//BlockBase<K>;
	in_end_space: boolean;
	isInterruption: boolean = false;
	startLine: LogicalLineData | undefined;
	readonly useSoftContinuations: boolean;
}



export class BlockParser_Container<K extends BlockType = ExtensionBlockType>
    extends BlockParser_Standard<K, ContainerBlockTraits<K>>
    implements BlockContainer
{
    constructor(MDP: MarkdownParser, traits: ContainerBlockTraits<K>, useSoftContinuations: boolean = true) {
        super(MDP, traits, useSoftContinuations);
        this.curContentParser = { container: this,  curParser: null,  generator: null };
    }

    beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): number {
        const n0 = super.beginsHere(LLD, curBlock);
		if(n0 < 0)
			return n0;
		const LLD_c = sliceLLD(LLD, n0);
		this.prevReadContent = LLD_c;
        this.curContentParser = this.MDP.processLine({ container: this,  curParser: null,  generator: null }, LLD_c);
        if(!this.curContentParser.curParser)
            throw new Error(`Content of container ${this.type} not recognized as any block type!`);
		return n0;
	}

    continues(LLD: LogicalLineData): BlockContinuationType {
        let cont = super.continues(LLD);

		if(typeof cont === "number") {
			const LLD_c = sliceLLD(LLD, cont);
			this.prevReadContent!.next = LLD_c;
			let curLLD = LLD_c;
			while(true) {
				this.curContentParser = this.MDP.processLine(this.curContentParser, curLLD);
				if(this.curContentParser.retry)
					curLLD = this.curContentParser.retry;
				else if(curLLD !== LLD_c) // this can only happen during backtracking due to a rejected content block
					curLLD = curLLD.next!;
				else
					break;
			}
		}
		else if(cont === "soft") {
            const cop = this.curContentParser;
            // only paragraph content can softly continue a container block
            if(cop.curParser?.type !== "paragraph")
                return "end";

			cont = cop.curParser.continues(LLD);
			// The following behavior isn't fully clear from the CommonMark specification in my opinion, but we replicate what the CommonMark reference implementation does:
			if(cont === "reject")
				cont = "end";
			this.prevReadContent!.next = { ... LLD };
        }
	
		this.prevReadContent = this.prevReadContent!.next;
        return cont;
    }

    addContentBlock(B: Block) { this.B.blocks.push(B); }

    acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start") {
		// an accepted soft continuation of a container block means an unprefixed soft continuation of the same line as content (which is a paragraph)
		// contents of hard continuations have already been accepted during continues()
		if(bct === "soft")
			this.curContentParser.curParser?.acceptLine(LLD, "soft");
        super.acceptLine(LLD, bct);
    }

    finish() {
        this.curContentParser.curParser?.finish();
        super.finish();
	}

    private curContentParser: ParseState;
	private prevReadContent: LogicalLineData | null = null;
}


export class BlockParser_EmptySpace extends BlockParser_Standard<"emptySpace"> {
    static readonly empties: Partial<Record<LogicalLineType, true>> = { empty: true,  emptyish: true,  comment: true };

    constructor(MDP: MarkdownParser, traits: BlockTraits<"emptySpace">, useSoftContinuations: boolean = true) {
        super(MDP, traits, useSoftContinuations);
	}

    beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): number {
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
	//type: K;
	parent: MarkdownParser;
	parser: BlockParser<BlockBase<K>> | undefined;
}
type BlockParserProviderCache = {
	[K in BlockType]: BlockParserProviderItem<K>;
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
		const P = this.processLines(LLD, null, { container: this,  curParser: null,  generator: null });
		if(this.diagnostics)    console.log(`Coming out of parsing with open block`, P.curParser?.type);
		if(P.curParser)
			P.curParser.finish();
		
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
		"thematicBreak",
		"indentedCodeBlock", // must be tried first so that the following block types can skip checking for too large indentations
		"sectionHeader",
		"fenced",
		"blockQuote",
		"paragraph",
		"sectionHeader_setext" // this only get used if a paragraph is rejected due to encountering "=======" (SETEXT header suffix)
	];
	interrupters: BlockType[] = [
		"thematicBreak",
		"indentedCodeBlock",
		"sectionHeader",
		"fenced", // also in CommonMark mode
		"blockQuote"
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
			for(let i = 0, iN = L.length;  i < iN;  ++i) {
				const key = L[i];
				const PP = this.cache[key] || (this.cache[key] = { main: p,  parser: undefined });
				if(!PP.parser)
					PP.parser = p.makeParser(key) as any;
				const P = PP.parser as BlockParser<Block>;
				//console.log('Yielding', key)
				if(P.type !== t0) {
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
	diagnostics = false;
};



/**********************************************************************************************************************/

export function startBlock(this: MarkdownParser, ctx: ParseState, LLD: LogicalLineData): ParseState {
	if(!ctx.generator)
		ctx.generator = this.blockParserProvider.mainBlocks(ctx.container);

	let I: IteratorResult<BlockParser<Block>, any> | undefined;
	while(!(I = ctx.generator.next()).done) {
		const PA = I.value;
		//if(this.diagnostics)    console.log(`Trying "${PA.type}" for line ${LLD.logl_idx} -> ${PA.beginsHere(LLD, PA.B)}`);
		if(PA.beginsHere(LLD, PA.B) >= 0) {
			//const P1 = this.blockParserProvider.release(PA) as BlockParser<Block>;
			PA.acceptLine(LLD, "start");
			if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx} starting with [${LLD.startPart}] -> start ${PA.type}`);
			ctx.curParser = PA;
			return ctx;
		}
	}
	if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx} starting with [${LLD.startPart}] -> no interruption`);
	ctx.generator = null;
	ctx.curParser = null;
	return ctx;
}


export function processLine(this: MarkdownParser, PP: ParseState, LLD: LogicalLineData): ParseState {
	const { container, curParser, generator } = PP;
	PP.retry = undefined;
	//if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx}`)

	if(!curParser) { // start a new block
		this.startBlock(PP, LLD);
		if(!PP.curParser)
			throw new Error(`Line ${LLD.logl_idx} doesn't belong to any block, that's not possible!`)
		return PP;
	}

	// continue an existing block
	const bct = curParser.continues(LLD);
	if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx} starting with [${LLD.startPart}]`, PP.curParser?.type, `-> ${bct}`)
	switch(bct) {
	case "end": // current block cannot continue in this line, i.e. it ends on its own
		curParser.finish();
		return { container,  retry: LLD,  curParser: null,  generator: null }; // will start a new block in the current line
	case "last":
		curParser.acceptLine(LLD, bct);
		curParser.finish();
		return { container,  curParser: null,  generator: null }; // will start a new block in the next line
	case "reject":
		if(curParser.isInterruption)
			throw new Error('Problem! Rejecting a block that interrupted another block is a bit too much in terms of backtracking, so we don\'t allow that.');
		// schedule backtracking:
		return { container,  retry: curParser.startLine!,  curParser: null,  generator };
	case "soft": // it's a soft continuation, which means it's possible that the next block begins here, interrupting the current one
		{
			const P1 = this.startBlock({ container,  curParser: null,  generator: this.blockParserProvider.interrupters(curParser) }, LLD).curParser;
			if(P1) {
				curParser.finish();
				P1.acceptLine(LLD, "start");
				PP.curParser = P1;
				// since the generator would only be used if this block gets rejected, and we don't allow rejection on an interruption, we don't pass on the generator
				PP.generator = null;
				return PP;
			}
		}
		// soft continuation wasn't interrupted, we can accept it
		curParser.acceptLine(LLD, bct);
		if(this.diagnostics)    console.log(`Not interrupted -> accept line ${LLD.logl_idx} as ${PP.curParser?.type}`)
		return PP;
	default: // hard accept
		curParser.acceptLine(LLD, bct);
		return PP;
	}
}



export function processLines(this: MarkdownParser, LLD0: LogicalLineData, LLD1: LogicalLineData | null, PP: ParseState) {
	//let P: BlockParser<Block> | null = null;
	//console.log('Starting', LLD1)
	let curLLD: LogicalLineData | null = LLD0;
	//let i = 0;
	while(curLLD && curLLD !== LLD1) {
		PP = this.processLine(PP, curLLD);
		if(PP.retry)
			curLLD = PP.retry;
		else {
			if(this.diagnostics)    console.log(`Proceed ${curLLD.logl_idx}->${curLLD.next?.logl_idx}`)
			curLLD = curLLD.next;
		}
		//if(++i > 10)    break;
	}
	if(this.diagnostics)    console.log(`Out!`)
	return PP;
}
