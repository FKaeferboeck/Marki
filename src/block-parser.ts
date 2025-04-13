import { blockQuote_traits } from './blocks/blockQuote.js';
import { emptySpace_traits } from './blocks/emptySpace.js';
import { fenced_traits } from './blocks/fenced.js';
import { thematicBreak_traits } from './blocks/thematicBreak.js';
import { indentedCodeBlock_traits } from './blocks/indentedCodeBlock.js';
import { paragraph_traits } from './blocks/paragraph.js';
import { sectionHeader_traits } from './blocks/sectionHeader.js';
import { sectionHeader_setext_traits } from './blocks/sectionHeader_setext.js';
import { AnyBlock, Block, BlockBase, BlockType, BlockType_Container, BlockType_Leaf, LogicalLineData } from './markdown-types.js';
import { LogicalLineType } from './parser.js';
import { BlockParserTraitsList, BlockContinuationType, BlockTraits, BlockTraits_Container } from './traits.js';
import { LLDinfo, sliceLLD } from './util.js';
import { listItem_traits } from './blocks/listItem.js';
import { MarkdownParser, ParseState } from './markdown-parser.js';
import { linkDef_traits } from './blocks/linkDef.js';



export const standardBlockParserTraits: BlockParserTraitsList = {
	emptySpace:           emptySpace_traits,
	paragraph:            paragraph_traits,
	sectionHeader:        sectionHeader_traits,
	thematicBreak:        thematicBreak_traits,
	sectionHeader_setext: sectionHeader_setext_traits,
	indentedCodeBlock:    indentedCodeBlock_traits,
	fenced:               fenced_traits,
	listItem:             listItem_traits,
	blockQuote:           blockQuote_traits,
	linkDef:              linkDef_traits
};


export interface BlockContainer {
	addContentBlock<K extends BlockType>(B: BlockBase<K>): void;
	blockContainerType: "containerBlock" | "MarkdownParser";
}


export interface BlockParser<K extends BlockType = BlockType> {
	type: K;
	// Does a block of this type begin in that logical line, and can it interrupt the given currently open block?
	beginsHere(LLD: LogicalLineData, interrupting?: BlockType | undefined): number;

	// assuming this line doesn't contain a block start that interrupts the block parsed herein, does that block continue in this logical line?
	continues(LLD: LogicalLineData, isSoftContainerContinuation?: boolean): BlockContinuationType;

	acceptLine(LLD: LogicalLineData, bct: BlockContinuationType | "start", prefix_length: number): void;

	finish(): LogicalLineData; // store the finished block with its surrounding container, return the last line that was accepted

	setCheckpoint(LLD: LogicalLineData): void;
	getCheckpoint(): LogicalLineData | null;
	resetBlock(): Block<K>;
	MDP: MarkdownParser;
	parent: BlockContainer | undefined;
	B: Block<K>;
	isInterruption: boolean;
	startLine: LogicalLineData | undefined;
	blockContainerType: BlockContainer["blockContainerType"] | "none";
}


export class BlockParser_Standard<K extends BlockType = BlockType_Leaf, Traits extends BlockTraits<K> = BlockTraits<K>> implements BlockParser<K> {
	type: K;

	constructor(MDP: MarkdownParser, type: K, traits: Traits, useSoftContinuations: boolean = true) {
		this.MDP = MDP;
		this.type = type;
		this.traits = traits;
		if(MDP.diagnostics)
			console.log(`Making new parser [${type}]`)
		this.B = this.resetBlock();
		this.useSoftContinuations = useSoftContinuations;
	}

	resetBlock() {
		this.B = structuredClone(this.traits.defaultBlockInstance) as Block<K>; // make a deep copy because the individual block data can contain arrays
		this.B.type                = this.type;
		this.B.logical_line_start  = -1;
		this.B.logical_line_extent = 0;
		return this.B;
	}

	static textLines: Partial<Record<LogicalLineType, boolean>> = { text: true,  single: true };

	beginsHere(LLD: LogicalLineData, interrupting?: BlockType | undefined): number {
		if(!BlockParser_Standard.textLines[LLD.type])
			return -1;

		const starts = this.traits.startsHere.call(this, LLD, this.B, interrupting);
		if(starts < 0)    return -1;
		
		this.B.logical_line_start  = LLD.logl_idx;
		this.B.logical_line_extent = 1;
		if(this.MDP.diagnostics)
			console.log(`Releasing [${this.type}]`);
		
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
			let LLD_content = (this.lastAddedContent ? this.lastAddedContent.next : this.lastEnqueuedContent!);
			if(!this.B.content && LLD_content && this.traits.hasContent !== false)
				this.B.content = LLD_content;
			for(;  LLD_content;  LLD_content = LLD_content.next) {
				this.lastAddedContent = LLD_content;
				if(this.MDP.diagnostics)    console.log(`      Adding content ${LLDinfo(LLD_content)} to "${this.type}"`);
			}
		}
	}

	finish(): LogicalLineData {
		if(this.traits.finalizeBlockHook)
			this.traits.finalizeBlockHook.call(this);
		if(this.lastAddedContent)
			this.lastAddedContent.next = null; // if we ignore some scheduled content because it's after the last checkpoint, we have to drop it from the linked list.
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
	B: Block<K>; //Traits["defaultBlockInstance"];
	isInterruption: boolean = false;
	startLine:  LogicalLineData | undefined;
	lastLine:   LogicalLineData | undefined; // the line most recently added to the block through acceptLine()
	lastAddedContent: LogicalLineData | undefined; // tail of the linked list in this.B.content
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



export class BlockParser_Container<K extends BlockType_Container = BlockType_Container>
    extends BlockParser_Standard<K, BlockTraits_Container<K>>
    implements BlockContainer
{
    constructor(MDP: MarkdownParser, type: K, traits: BlockTraits_Container<K>, useSoftContinuations: boolean = true) {
        super(MDP, type, traits, useSoftContinuations);
		this.B.isContainer = true;
		this.B.blocks      = [];
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
			if(!P) {
				if(this.MDP.diagnostics)    console.log(`      Softly continuing line of a <${this.type}> but there is no current content parser -> container ends too`);
				return "end";
			}
			

			// only paragraph content can softly continue a container block
			// if there's nested block containers the innermost content is the one that counts, so we delegate the decision to the inner container
			if(P.blockContainerType == "none" && P.type !== "paragraph") {
				if(this.MDP.diagnostics)    console.log(`  block container <${this.type}> softly continues at line ${LLD.logl_idx} with content <${P.type}>? No, it's not paragraph content`);
				return "end";
			}

			cont = P.continues(LLD_c, true);

			// The following behavior isn't fully clear from the CommonMark specification in my opinion, but we replicate what the CommonMark reference implementation does:
			if(cont === "reject")
				cont = "end";
			if(this.MDP.diagnostics)    console.log(`  block container <${this.type}> softly continues at line ${LLD.logl_idx} with content <${P.type}>? -> ${cont}`);
        }
        return cont;
    }

    addContentBlock<K extends BlockType>(B: BlockBase<K>) { this.B.blocks.push(B as AnyBlock); }

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

    constructor(MDP: MarkdownParser, type: "emptySpace", traits: BlockTraits<"emptySpace">, useSoftContinuations: boolean = true) {
        super(MDP, type, traits, useSoftContinuations);
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
