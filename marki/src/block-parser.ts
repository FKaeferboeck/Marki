import { blockQuote_traits } from './blocks/blockQuote.js';
import { emptySpace_traits } from './blocks/emptySpace.js';
import { fenced_traits } from './blocks/fenced.js';
import { thematicBreak_traits } from './blocks/thematicBreak.js';
import { indentedCodeBlock_traits } from './blocks/indentedCodeBlock.js';
import { paragraph_traits } from './blocks/paragraph.js';
import { sectionHeader_traits } from './blocks/sectionHeader.js';
import { sectionHeader_setext_traits } from './blocks/sectionHeader_setext.js';
import { AnyBlock, Block, Block_Leaf, BlockBase, BlockType, BlockType_Container, BlockType_Leaf, MarkdownParserContext } from './markdown-types.js';
import { LogicalLineType } from './parser.js';
import { BlockContinuationType, BlockTraits, BlockTraits_Container } from './traits.js';
import { LLinfo } from './util.js';
import { listItem_traits } from './blocks/listItem.js';
import { BlockParserProvider, MarkdownParser, ParseState } from './markdown-parser.js';
import { linkDef_traits } from './blocks/linkDef.js';
import { htmlBlock_traits } from './blocks/html-block.js';
import { isSpaceLine, LogicalLine, LogicalLine_text, LogicalLine_with_cmt, sliceLine } from './linify.js';


export const standardBlockTryOrder = [
	emptySpace_traits,
	indentedCodeBlock_traits,
	thematicBreak_traits,
	sectionHeader_traits,
	fenced_traits,
	blockQuote_traits,
	listItem_traits,
	linkDef_traits,
	htmlBlock_traits,
	paragraph_traits,
	sectionHeader_setext_traits // this only get used if a paragraph is rejected due to encountering "=======" (SETEXT header suffix)
];


export interface BlockContainer {
	addContentBlock<K extends BlockType>(B: BlockBase<K>): void;
	blockContainerType: "containerBlock" | "MarkdownParser";
}

export type MarkdownLocalContext = MarkdownParserContext & {
	URL:      string | undefined;
	linkDefs: Record<string, Block_Leaf<"linkDef">>;
}


export interface ParsingContext {
	MDP:       MarkdownParser;
	globalCtx: MarkdownParserContext; // for caching not restricted to a particular document
	localCtx:  MarkdownLocalContext; // for data local to a single document
}


export interface BlockParserBase {
	type: BlockType;
}

export interface BlockParser<K      extends BlockType = BlockType,
                             Traits extends BlockTraits<K> = BlockTraits<K>>
	extends BlockParserBase, ParsingContext
{
	// Does a block of this type begin in that logical line, and can it interrupt the given currently open block?
	beginsHere(LL: LogicalLine_with_cmt, interrupting?: BlockType | undefined): number;

	// assuming this line doesn't contain a block start that interrupts the block parsed herein, does that block continue in this logical line?
	continues(LL: LogicalLine_with_cmt, isSoftContainerContinuation?: boolean): BlockContinuationType;

	acceptLine(LL: LogicalLine_with_cmt, bct: BlockContinuationType | "start", prefix_length: number): void;

	finish(): LogicalLine; // store the finished block with its surrounding container, return the last line that was accepted

	setCheckpoint(LL: LogicalLine): void;
	getCheckpoint(): LogicalLine | null;
	resetBlock(): Block<K>;
	parent: BlockContainer | undefined;
	traits: Traits;//BlockTraits<K>;
	B: Block<K> & Traits["defaultBlockInstance"];
	isInterruption: boolean;
	startLine: LogicalLine | undefined;
	blockContainerType: BlockContainer["blockContainerType"] | "none";
}


export class BlockParser_Standard<K extends BlockType = BlockType_Leaf, Traits extends BlockTraits<K> = BlockTraits<K>> implements BlockParser<K, Traits> {
	type: K;

	constructor(/*ctx: ParsingContext*/PP: BlockParserProvider, type: K, traits: Traits, useSoftContinuations: boolean = true) {
		this.PP = PP;
		const ctx = PP.ctx;
		this.MDP       = ctx.MDP;
		this.globalCtx = ctx.globalCtx;
		this.localCtx  = ctx.localCtx;
		this.type      = type;
		this.traits    = traits;
		if(ctx.MDP.diagnostics)
			console.log(`Making new parser [${type}]`)
		this.B         = this.resetBlock();
		this.useSoftContinuations = useSoftContinuations;
	}

	resetBlock() {
		this.B = structuredClone(this.traits.defaultBlockInstance) as Block<K>; // make a deep copy because the individual block data can contain arrays
		this.B.type     = this.type;
		this.B.lineIdx  = -1;
		this.B.logical_line_extent = 0;
		return this.B;
	}

	static textLines: Partial<Record<LogicalLineType, boolean>> = { text: true,  single: true };

	beginsHere(LL: LogicalLine_with_cmt, interrupting?: BlockType | undefined): number {
		if(LL.type !== "text")
			return -1;
		// TODO!! Handle comment lines here!

		const starts = this.traits.startsHere.call(this, LL, this.B, interrupting);
		if(starts < 0)    return -1;
		
		this.B.lineIdx  = LL.lineIdx;
		this.B.logical_line_extent = 1;
		if(this.MDP.diagnostics)
			console.log(`Releasing [${this.type}]`);
		
		this.PP.release(this);
		//this.MDP.getBlockParserProvider(this.traits.)
		//this.MDP.blockParserProvider.release(this);
		return starts;
	}

	continues(LL: LogicalLine_with_cmt, isSoftContainerContinuation?: boolean): BlockContinuationType {
		const ret = (t: BlockContinuationType) => {
			if(t === "soft" && isSoftContainerContinuation)
				LL.isSoftContainerContinuation = true;
			return t;
		};

		if(LL.type === "comment")
			return "end"; // TODO!!!

		if (this.traits.continuesHere) {
			const x = this.traits.continuesHere.call(this, LL, isSoftContainerContinuation);
			if(typeof x !== "undefined")
				return ret(x);
		}

		if(isSpaceLine(LL))
			return ret("end");
		/*if(LL.type === "comment")
			return ret(this.traits.allowCommentLines ? "soft" : "end");*/

		const cpfx = this.traits.continuationPrefix;
		if(cpfx) {
			if(typeof cpfx === "function")
				return ret(cpfx(LL, this.B));
			const rexres = cpfx.exec(LL.content);
			if(rexres)
				return ret(rexres[0].length);
		}
		return ret(this.traits.allowSoftContinuations ? "soft" : "end");
	}

	acceptLine(LL: LogicalLine, bct: BlockContinuationType | "start", prefix_length: number) {
		if(this.traits.acceptLineHook && !this.traits.acceptLineHook.call(this, LL, bct))
			return;
		if(bct === "start")
			this.startLine = LL;
		//if(this.MDP.diagnostics)    console.log('acceptLine into', this.type, LLD, prefix_length, sliceLLD(LLD, prefix_length))

		// We prepare the content part of the line for acceptance, even if we don't accept it right away due to checkpoint (and perhaps never will)
		// This way when the next checkpoint arrives we have the pending content lines in the linked list.
		// continuing lines inside block containers are already enqueued during continues().
		if((this.blockContainerType !== "containerBlock") && !(bct === "last" && !this.traits.lastIsContent))
			this.enqueueContentSlice(LL, prefix_length, bct);

		if(this.checkpoint && LL.lineIdx > this.checkpoint.lineIdx)
			return;
		this.lastLine = LL;
		this.B.logical_line_extent = LL.lineIdx - this.B.lineIdx + 1;
		if(bct !== "last" || this.traits.lastIsContent) {
			// flush pending content lines to the block contents array
			let LL_content = (this.lastAddedContent ? this.lastAddedContent.next : this.lastEnqueuedContent!);
			if(!this.B.content && LL_content && this.traits.hasContent !== false) {
				if(LL_content.type === "comment")
					throw new Error('Block content cannot start with a comment line');
				this.B.content = LL_content;
			}
			for(;  LL_content;  LL_content = LL_content.next) {
				this.lastAddedContent = LL_content;
				if(this.MDP.diagnostics)    console.log(`      Adding content ${LLinfo(LL_content)} to "${this.type}"`);
			}
		}
	}

	finish(): LogicalLine {
		if(this.traits.finalizeBlockHook)
			this.traits.finalizeBlockHook.call(this);
		if(this.lastAddedContent)
			this.lastAddedContent.next = undefined; // if we ignore some scheduled content because it's after the last checkpoint, we have to drop it from the linked list.
		if(this.parent)
			this.parent.addContentBlock(this.B);
		//container.addContentBlock(this.B);
		if(this.MDP.diagnostics)    console.log(`  Finish [${this.type}], to continue in line ${(this.lastLine?.lineIdx || 0) + 1}`)
		return this.lastLine!;
	}

	setCheckpoint(LL: LogicalLine) { this.checkpoint = LL; }
	getCheckpoint(): LogicalLine | null { return this.checkpoint || null; }
	PP: BlockParserProvider;
	MDP: MarkdownParser;
	globalCtx: MarkdownParserContext;
	localCtx:  MarkdownLocalContext;
	parent: BlockContainer | undefined;
	traits: Traits;
	B: Block<K>; //Traits["defaultBlockInstance"];
	isInterruption: boolean = false;
	startLine:           LogicalLine | undefined;
	lastLine:            LogicalLine | undefined; // the line most recently added to the block through acceptLine()
	lastAddedContent:    LogicalLine_with_cmt | undefined; // tail of the linked list in this.B.content
	checkpoint:          LogicalLine | undefined;
	lastEnqueuedContent: LogicalLine | undefined;
	blockContainerType: BlockContainer["blockContainerType"] | "none" = "none";
	readonly useSoftContinuations: boolean;

	protected enqueueContentSlice(LL: LogicalLine, slice_col: number, bct?: BlockContinuationType | "start") {
		// because a block container might try to double enqueue a line
		if((this.lastEnqueuedContent?.lineIdx || -1) >= LL.lineIdx)
			//return this.lastEnqueuedContent.contentSlice!;
			throw new Error(`Trying to double enqueue cline ${LLinfo(LL)}`);

		let LLD_C: LogicalLine = sliceLine(LL, slice_col);
		if(typeof bct !== "undefined" && this.traits.postprocessContentLine)
			LLD_C = this.traits.postprocessContentLine.call(this, LLD_C, bct) as LogicalLine;

		if(this.lastEnqueuedContent)
			this.lastEnqueuedContent.next = LLD_C;
		this.lastEnqueuedContent = LLD_C;
		if(this.MDP.diagnostics)    console.log(`      Enqueuing ${LLinfo(LL)}>${LLinfo(LLD_C)} in <${this.type}>`)
		return LLD_C;
	}
}



export class BlockParser_Container<K extends BlockType_Container = BlockType_Container>
    extends BlockParser_Standard<K, BlockTraits_Container<K>>
    implements BlockContainer
{
    constructor(PP: BlockParserProvider, type: K, traits: BlockTraits_Container<K>, useSoftContinuations: boolean = true) {
        super(PP, type, traits, useSoftContinuations);
		this.B.containerMode = "Container";
		this.B.blocks        = [];
		this.contentParserTryOrder = traits.contentParserTryOrder;
        this.curContentParser = { tryOrderName: this.contentParserTryOrder,  container: this,  curParser: null,  generator: null };
    }

    beginsHere(LL: LogicalLine, interrupting?: BlockType | undefined): number {
        const n0 = super.beginsHere(LL, interrupting);
		if(n0 < 0)
			return n0;
		if(this.traits.acceptLineHook?.call(this, LL, "start") === false)
			return n0;
		const LLD_c = this.enqueueContentSlice(LL, n0);
        this.curContentParser = this.MDP.processLine({ tryOrderName: this.contentParserTryOrder,  container: this,  curParser: null,  generator: null }, LLD_c);
        if(!this.curContentParser.curParser)
            throw new Error(`Content of container ${this.type} not recognized as any block type!`);
		return n0;
	}

    continues(LL: LogicalLine): BlockContinuationType {
        let cont = super.continues(LL);
		if(this.MDP.diagnostics && cont !== "soft")    console.log(`  block container <${this.type}> continues at line ${LL.lineIdx}? ${cont}`);
		if(cont === "end")
			return cont;
			
		/* The following line will sometimes cause a line to be enqueued that in the end isn't used because the block ends,
		 * but that doesn't hurt. It keept the code simpler. */
		const LL_c = this.enqueueContentSlice(LL, typeof cont === "number" ? cont : 0);

		if(typeof cont === "number") {
			let curLL: LogicalLine = LL_c;
			while(true) {
				if(this.MDP.diagnostics)    console.log(`      = Parsing content slice ${LLinfo(curLL)} inside ${this.type}`);
				this.curContentParser = this.MDP.processLine(this.curContentParser, curLL);
				if(this.curContentParser.retry) {
					curLL = this.curContentParser.retry;
					if(this.MDP.diagnostics)    console.log(`      = Retry in line ${LLinfo(curLL)}`);
				} else if(curLL.lineIdx < LL_c.lineIdx) { // this can only happen during backtracking due to a rejected content block
					if(this.MDP.diagnostics)    console.log(`      = Proceed ${curLL.lineIdx}->${LLinfo(curLL.next)}  (because we haven't reached ${LLinfo(LL_c)})`);
					curLL = curLL.next as LogicalLine;
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
				if(this.MDP.diagnostics)    console.log(`  block container <${this.type}> softly continues at line ${LL.lineIdx} with content <${P.type}>? No, it's not paragraph content`);
				return "end";
			}

			cont = P.continues(LL_c, true);

			// The following behavior isn't fully clear from the CommonMark specification in my opinion, but we replicate what the CommonMark reference implementation does:
			if(cont === "reject")
				cont = "end";
			if(this.MDP.diagnostics)    console.log(`  block container <${this.type}> softly continues at line ${LL.lineIdx} with content <${P.type}>? -> ${cont}`);
        }
        return cont;
    }

    addContentBlock<K extends BlockType>(B: BlockBase<K>) { this.B.blocks.push(B as AnyBlock); }

    acceptLine(LL: LogicalLine, bct: BlockContinuationType | "start") {
		if(this.traits.acceptLineHook?.call(this, LL, bct) === false)
			return;
		// an accepted soft continuation of a container block means an unprefixed soft continuation of the same line as content (which is a paragraph)
		// contents of hard continuations have already been accepted during continues()
		if(bct === "soft")
			this.curContentParser.curParser?.acceptLine(this.lastEnqueuedContent!, "soft", 0);
        super.acceptLine(LL, bct, typeof bct === "number" ? bct : 0);
    }

    finish(): LogicalLine {
        this.curContentParser.curParser?.finish();
        return super.finish();
	}

	curContentType() {
		return this.curContentParser.curParser?.type;
	}

    private curContentParser: ParseState;
	private contentParserTryOrder: string | undefined;
	blockContainerType = "containerBlock" as const;
}


export class BlockParser_EmptySpace extends BlockParser_Standard<"emptySpace"> {
    constructor(PP: BlockParserProvider, type: "emptySpace", traits: BlockTraits<"emptySpace">, useSoftContinuations: boolean = true) {
        super(PP, type, traits, useSoftContinuations);
	}

    beginsHere(LL: LogicalLine): number {
        if(LL.type === "text")
            return -1;
        this.B.lineIdx  = LL.lineIdx;
        this.B.logical_line_extent = 1;
		this.B.content = LL;
		//this.MDP.blockParserProvider.release(this);
		this.PP.release(this);
        return 0;
    }

    continues(LL: LogicalLine): BlockContinuationType {
        return (LL.type !== "text" ? 0 : "end");
    }

    isInterruption: boolean = false;
}
