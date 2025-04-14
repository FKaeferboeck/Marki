import { BlockParser } from "./block-parser.js";
import { BlockParser_Container } from "./blocks/blockQuote.js";
import { InlineParser } from "./inline-parser.js";
import { MarkdownParser } from "./markdown-parser.js";
import { BlockType, ExtensionBlockType, BlockBase, Block_Container, LogicalLineData, BlockType_Container, Block, InlineElementType, ExtensionInlineElementType, InlineElement, InlinePos, BlockIndividualData } from "./markdown-types.js";
import { BlockContentIterator } from "./util.js";


export type BlockContinuationType = number     // block definitely continues in this line (e.g. because of the prefix)
                                  | "soft"     // block potentially continues in this line unless another block wants to interrupt it
                                  | "end"      // block definitely does not continue in this line, the previous line is the last
                                  | "last"     // block ends after this line, this is the last line of the block
                                  | "reject";  // we've reached a line that's incompatible with the current block, so we reject the block and try a different block type


export interface BlockTraits<T extends BlockType = ExtensionBlockType> {
    /* This method should return -1 if a block of this type cannot begin in this line.
       If it can begin here it shoudl return a number describing the offset where the actual content of the block (after a prefix) starts,
       e.g. 2 for a blockquote starting after "> ".
       If the prefix contains additional data (e.g. the level of an atx header) the method can parse that data into the provided block object. */
    startsHere(this: BlockParser<T>, data: LogicalLineData, B: Block<T>, interrupting?: BlockType | undefined): number;

    /* returning undefined means the function doesn't make a decision whether to continue the block here,
     * and leaves it to the subsequent standard algorithm instead.
     */
    continuesHere?(this: BlockParser<T>, data: LogicalLineData, isSoftContainerContinuation?: boolean): BlockContinuationType | undefined;

    acceptLineHook?(this: BlockParser<T>, LLD: LogicalLineData, bct: BlockContinuationType | "start") : boolean;
    finalizeBlockHook?(this: BlockParser<T>): void;

    /* in case content lines need to be transformed in some way when adding them to the block content */
    postprocessContentLine?(this: BlockParser<T>, LLD: LogicalLineData, bct: BlockContinuationType | "start") : LogicalLineData;

    continuationPrefix?: RegExp| ((LLD: LogicalLineData, B: Block<T>) => number);
    
    allowSoftContinuations: boolean;
    canBeSoftContinuation?: boolean; // default true
    allowCommentLines: boolean;
    hasContent?: boolean; // default true; false means that this element stores all data it has in its individual block data and doesn't use the "content" property
    lastIsContent?: boolean; // if a line is continuation type "last" it will still be added to the block content - default false
    canSelfInterrupt?: boolean; // list items do that
    creator?: (MDP: MarkdownParser, type: T) => BlockParser<T>;
    defaultBlockInstance: BlockIndividualData<T>;
}



export interface BlockTraits_Container<T extends BlockType_Container> extends BlockTraits<T> {
    isContainer: true;

    creator?: (MDP: MarkdownParser, type: T) => BlockParser_Container<T>;
    defaultBlockInstance: BlockIndividualData<T>;
}



export type BlockParserTraitsList = Partial<{
    [K in BlockType]: (K extends BlockType_Container ? BlockTraits_Container<K> : BlockTraits<K>);
}>;



/**********************************************************************************************************************/

export interface InlineElementTraits<T extends InlineElementType = ExtensionInlineElementType> {
    startChars: string[]; // characters where inline element can possibly start — doesn't have to be a sufficient condition

    parse(this: InlineParser<T>, It: BlockContentIterator, startPos: InlinePos): InlineElement<T> | false;

    creator: (MDP: MarkdownParser) => InlineParser<T>;
    defaultElementInstance: InlineElement<T>;
}


export type InlineParserTraitsList = Partial<{
    [K in InlineElementType]:  InlineElementTraits<K>;
}>;
