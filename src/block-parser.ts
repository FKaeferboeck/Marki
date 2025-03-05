import { blockQuote_traits } from './blocks/blockQuote';
import { emptySpace_traits } from './blocks/emptySpace';
import { fenced_traits } from './blocks/fenced';
import { horizontalRule_traits } from './blocks/horizontalRule';
import { indentedCodeBlock_traits } from './blocks/indentedCodeBlock';
import { paragraph_traits } from './blocks/paragraph';
import { sectionHeader_traits } from './blocks/sectionHeader';
import { sectionHeader_setext_traits } from './blocks/sectionHeader_setext';
import { Block, BlockBase, BlockType, BlockTypeMap, ContainerBlockBase, ExtensionBlockType, LogicalLineData } from './markdown-types';
import { TextPart, LineStructure, lineType, LogicalLine, LinePart, LogicalLineType } from './parser';
import { BlockParserTraitsList, BlockContinuationType, BlockTraits, ContainerBlockTraits } from './traits';




export const standardBlockParserTraits: BlockParserTraitsList = {
	emptySpace:           emptySpace_traits,
	paragraph:            paragraph_traits,
	sectionHeader:        sectionHeader_traits,
	blockQuote:           blockQuote_traits,
	horizontalRule:       horizontalRule_traits,
	sectionHeader_setext: sectionHeader_setext_traits,
	indentedCodeBlock:    indentedCodeBlock_traits,
	fenced:               fenced_traits
};


export interface BlockContainer {
	addContentBlock(B: Block): void;
	blocks: Block[];
}


export interface BlockParser<BT extends Block> {
	type: BlockType;
	// Does a block of this type begin in that logical line, and can it interrupt the given currently open block?
	//beginsHere(logl: number, curBlock: Block | undefined): boolean;
	beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): boolean;

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
		this.B = { ... traits.defaultBlockInstance };
		this.in_end_space = false;
		this.useSoftContinuations = useSoftContinuations;
	}

	static textLines = { text: true,  single: true };

	beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): boolean {
		//console.log(`Startin ${this.type} here?`);
		if(!BlockParser_Standard.textLines[LLD.type])
			return false;

		const starts = this.traits.startsHere(LLD, this.B);
		if(starts < 0)    return false;
		this.B.logical_line_start  = LLD.logl_idx;
		this.B.logical_line_extent = 1;
		return true;
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
		if(this.parent)
			this.parent.addContentBlock(this.B);
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
        this.curContentParser = { curParser: null,  generator: MDP.blockParserProvider.mainBlocks(this) };
    }

    beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): boolean {
		// Caution! We assume that LLD === this.MDP.curLLD
        if(!super.beginsHere(LLD, curBlock))
            return false;
        this.curContentParser = this.MDP.processLine({ curParser: null,  generator: this.MDP.blockParserProvider.mainBlocks(this) });
        if(!this.curContentParser.curParser)
            throw new Error(`Content of container ${this.type} not recognized as any block type!`);
		return true;
	}

    continues(LLD: LogicalLineData): BlockContinuationType {
        const cont = super.continues(LLD);
        if(cont === "soft") {
            const cop = this.curContentParser;
            if(!cop.curParser)
                throw new Error(`Looking for continuation on a ${this.type} container block that doesn't have any content.`);
            
            // only paragraph content can softly continue a container block
            if(cop.curParser.type !== "paragraph")
                return "end";

            return cop.curParser.continues(LLD);
        }
        return cont;
    }

    addContentBlock(B: Block) { this.blocks.push(B); }
	blocks: Block[] = [];

    acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start") {
        super.acceptLine(LLD, bct);
    }

    finish() {
        this.curContentParser.curParser?.finish();
        super.finish();
	}

    private curContentParser: EligibleParsers;
}


export class BlockParser_EmptySpace /*implements BlockParser<BlockBase<"emptySpace">> {*/extends BlockParser_Standard<"emptySpace"> {
    //type: "emptySpace";
    static readonly empties: Partial<Record<LogicalLineType, true>> = { empty: true,  emptyish: true,  comment: true };

    constructor(MDP: MarkdownParser, traits: BlockTraits<"emptySpace">, useSoftContinuations: boolean = true) {
        super(MDP, traits, useSoftContinuations);
        /*this.MDP = MDP;
		this.type = traits.defaultBlockInstance.type;
		this.traits = traits;
		this.B = { ... traits.defaultBlockInstance };*/
		//this.in_end_space = false;
		//this.useSoftContinuations = useSoftContinuations;
	}

    beginsHere(LLD: LogicalLineData, curBlock: Block | undefined): boolean {
        if(!BlockParser_EmptySpace.empties[LLD.type])
            return false;
        this.B.logical_line_start  = LLD.logl_idx;
        this.B.logical_line_extent = 1;
        return true;
    }

    continues(LLD: LogicalLineData): BlockContinuationType {
        return (BlockParser_EmptySpace.empties[LLD.type] ? 0 : "end");
    }

    /*MDP: MarkdownParser;
    traits: BlockTraits<"emptySpace">;
    B: BlockBase<"emptySpace">;*/
    isInterruption: boolean = false;
    //startLine: LogicalLineData | undefined;
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
export interface EligibleParsers {
	curParser: BlockParser<Block> | null;
	generator: Generator<BlockParser<Block>> | null;
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

	/*parseDocument = parseDocument;*/
	startBlock    = startBlock;
	/*takeBlock     = takeBlock;*/
	processLine   = processLine;
	processLines  = processLines;

	processContent(LLD: LogicalLineData) {
		this.blocks = [];
		const P = this.processLines(LLD, null, { curParser: null,  generator: this.blockParserProvider.mainBlocks(this) });
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
		"indentedCodeBlock", // must be tried first so that the following block types can skip checking for too large indentations
		"sectionHeader",
		"fenced",
		"blockQuote",
		"paragraph",
		"sectionHeader_setext" // this only get used if a paragraph is rejected due to encountering "=======" (SETEXT header suffix)
	];
	interrupters: BlockType[] = [
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

		*interrupters(interruptee: BlockParser<Block>): Generator<BlockParser<Block>> { yield* this.run("interrupters", interruptee.type, interruptee.parent || this.parent); },
		*mainBlocks  (BC?: BlockContainer):             Generator<BlockParser<Block>> { yield* this.run("tryOrder",     undefined, BC || this.parent); },

		*run(s: "tryOrder" | "interrupters", t0: BlockType | undefined, BC: BlockContainer | undefined): Generator<BlockParser<Block>> {
			const p = (this.parent as MarkdownParser);
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
		parent: this,
	}

	
	addContentBlock(B: Block) { this.blocks.push(B); }
	blocks: Block[] = [];

	curLLD: LogicalLineData | null = null;
	diagnostics = false;
};


/**********************************************************************************************************************/

function measureIndent(s: string) {
	let n = 0;
	for (let i = 0, iN = s.length;  i < iN;  i++)
		switch(s[i]) {
		case ' ':     ++n;       break;
		case '\t':    n += 4;    break;
		default:      return n;
		}
	return n;
}

function lineData(LS: LineStructure, logl_idx: number): LogicalLineData {
	const LL = LS.logical_lines[logl_idx];
	const P  = LS.all[LL.start];
	const p0 = (P.type === "TextPart" ? P.content : '');
	return {
		logl_idx:    logl_idx,
		parts:       LS.all.slice(LL.start, LL.start + LL.extent),
		startPart:   p0.trimStart(),
		startIndent: measureIndent(p0),
		type:        (LL.type === "text" ? "single" : LL.type),
		next:        null
	};
}

export function lineDataAll(LS: LineStructure, logl_idx_start: number): LogicalLineData {
	let lld = lineData(LS, logl_idx_start);
	const lld0 = lld;
	while(++logl_idx_start < LS.logical_lines.length)
		lld = (lld.next = lineData(LS, logl_idx_start));
	return lld0;
}



export function startBlock(this: MarkdownParser, generator: Generator<BlockParser<Block>>): EligibleParsers {
	const LLD = this.curLLD;
	if(!LLD)
		throw new Error('MarkdownParser.curLLD not set');
	let I: IteratorResult<BlockParser<Block>, any> | undefined;
	while(generator && !(I = generator.next()).done) {
		const PA = I.value;
		//if(this.diagnostics)    console.log(`Trying "${PA.type}" for line ${LLD.logl_idx} -> ${PA.beginsHere(LLD, PA.B)}`);
		if(PA.beginsHere(LLD, PA.B)) {
			const P1 = this.blockParserProvider.release(PA) as BlockParser<Block>;
			P1.acceptLine(LLD, "start");
			if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx} starting with [${LLD.startPart}] -> start ${P1.type}`);
			return { curParser: P1,  generator };
		}
	}
	if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx} starting with [${LLD.startPart}] -> no interruption`);
	return { curParser: null,  generator: null }; // this is valid when the function is called to check for block interruptions
}


export function processLine(this: MarkdownParser, PP: EligibleParsers): EligibleParsers & { retry?: true } {
	const { curParser, generator } = PP;
	const LLD = this.curLLD;
	if(!LLD)
		throw new Error('MarkdownParser.curLLD not set');
	//if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx}`)

	if(!curParser) { // start a new block
		const PP1 = this.startBlock(generator!);
		if(!PP1.curParser)
			throw new Error(`Line ${this.curLLD?.logl_idx} doesn't belong to any block, that's not possible!`)
		return PP1;
	}

	// continue an existing block
	const bct = curParser.continues(LLD);
	if(this.diagnostics)    console.log(`Processing line ${LLD.logl_idx} starting with [${LLD.startPart}]`, PP.curParser?.type, `-> ${bct}`)
	switch(bct) {
	case "end": // current block cannot continue in this line, i.e. it ends on its own
		curParser.finish();
		return { retry: true,  curParser: null,  generator: this.blockParserProvider.mainBlocks(curParser.parent) }; // start a new block
	case "last":
		curParser.acceptLine(LLD, bct);
		curParser.finish();
		return { curParser: null,  generator: null };
	case "reject":
		if(curParser.isInterruption)
			throw new Error('Problem! Rejecting a block that interrupted another block is a bit too much in terms of backtracking, so we don\'t allow that.');
		// do backtracking
		this.curLLD = curParser.startLine!;
		return { retry: true,  curParser: null,  generator };
	case "soft": // it's a soft continuation, which means it's possible that the next block begins here, interrupting the current one
		{
			const P1 = this.startBlock(this.blockParserProvider.interrupters(curParser)).curParser;
			if(P1) {
				curParser.finish();
				P1.acceptLine(LLD, "start");
				return { curParser: P1,  generator: null };
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


export function processLines(this: MarkdownParser, LLD0: LogicalLineData, LLD1: LogicalLineData | null, PP: EligibleParsers) {
	//let P: BlockParser<Block> | null = null;
	//console.log('Starting', LLD1)
	this.curLLD = LLD0;
	while(this.curLLD && this.curLLD !== LLD1) {
		if(!PP.generator) {
			PP.curParser = null;
			PP.generator = this.blockParserProvider.mainBlocks(this);
			if(this.diagnostics)    console.log(`Making new generator`)
		}
		const PP1 = this.processLine(PP);
		if(!PP1.retry) {
			if(this.diagnostics)    console.log(`Proceed ${this.curLLD.logl_idx}->${this.curLLD.next?.logl_idx}`)
			this.curLLD = this.curLLD.next;
		}
		PP.generator = PP1.generator;
		PP.curParser = PP1.curParser;
		//console.log(LLD && (LLD !== LLD1), LLD1)
	}
	if(this.diagnostics)    console.log(`Out!`)
	return PP;
}
