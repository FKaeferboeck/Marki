import { BlockParser, BlockParser_Container } from "./block-parser.js";
import { InlineParser } from "./inline-parser.js";
import { LogicalLine, LogicalLine_with_cmt } from "./linify.js";
import { MarkdownParser } from "./markdown-parser.js";
import { BlockType, ExtensionBlockType, BlockType_Container, Block, InlineElementType, ExtensionInlineElementType, InlineElement, InlinePos, BlockIndividualData, Delimiter, Delimiter_nestable, Block_Extension, AnyBlock } from "./markdown-types.js";
import { BlockContentIterator } from "./util.js";


export type BlockContinuationType = number     // block definitely continues in this line (e.g. because of the prefix)
                                  | "soft"     // block potentially continues in this line unless another block wants to interrupt it
                                  | "end"      // block definitely does not continue in this line, the previous line is the last
                                  | "last"     // block ends after this line, this is the last line of the block
                                  | "reject";  // we've reached a line that's incompatible with the current block, so we reject the block and try a different block type


export interface BlockTraits<T extends BlockType = ExtensionBlockType, B extends BlockIndividualData<T> = BlockIndividualData<T>, Extra extends {} = {}> {
    blockType: T;

    /* This method should return -1 if a block of this type cannot begin in this line.
       If it can begin here it shoudl return a number describing the offset where the actual content of the block (after a prefix) starts,
       e.g. 2 for a blockquote starting after "> ".
       If the prefix contains additional data (e.g. the level of an atx header) the method can parse that data into the provided block object. */
    startsHere(this: BlockParser<T, BlockTraitsExtended<T, B, Extra>>, LL: LogicalLine, B: Block<T>, interrupting?: BlockType | undefined): number;

    /* returning undefined means the function doesn't make a decision whether to continue the block here,
     * and leaves it to the subsequent standard algorithm instead.
     */
    continuesHere?(this: BlockParser<T, BlockTraitsExtended<T, B, Extra>>, LL: LogicalLine, isSoftContainerContinuation?: boolean): BlockContinuationType | undefined;

    acceptLineHook?(this: BlockParser<T>, LL: LogicalLine, bct: BlockContinuationType | "start") : boolean;
    finalizeBlockHook?(this: BlockParser<T, BlockTraitsExtended<T, B, Extra>>): void;

    /* in case content lines need to be transformed in some way when adding them to the block content */
    postprocessContentLine?(this: BlockParser<T>, LL: LogicalLine, bct: BlockContinuationType | "start") : LogicalLine_with_cmt;

    continuationPrefix?: RegExp| ((LL: LogicalLine, B: Block<T>) => number);
    
    allowSoftContinuations: boolean;
    canBeSoftContinuation?: boolean; // default true
    allowCommentLines: boolean;
    isInterrupter?: boolean; // Can this block interrupt soft continuations? default false

    hasContent?: boolean; // default true; false means that this element stores all data it has in its individual block data and doesn't use the "content" property
    inlineProcessing?: boolean | ((this: MarkdownParser, block: AnyBlock) => void); // default true
    lastIsContent?: boolean; // if a line is continuation type "last" it will still be added to the block content - default false
    canSelfInterrupt?: boolean; // list items do that
    trimLeadingContentSpace?: boolean;
    creator?: (MDP: MarkdownParser, type: T) => BlockParser<T>;
    defaultBlockInstance: B;
}

export type BlockTraitsExtended<T     extends BlockType = ExtensionBlockType,
                                B     extends BlockIndividualData<T> = BlockIndividualData<T>,
                                Extra extends {} = {}>
    = BlockTraits<T, B, Extra> & Extra;


export type ExtensionBlockTraits<B extends BlockIndividualData = BlockIndividualData, Extra extends {} = {}>
    = BlockTraitsExtended<ExtensionBlockType, B, Extra>;

export function castExtensionBlock<B extends BlockIndividualData>
    (block: /*Block_Extension*/AnyBlock, traits: ExtensionBlockTraits<B>): block is Block_Extension & B
{
    if(block.type !== traits.blockType)
        throw new Error(`castBlock: expected block of type "${traits.blockType}", but encountered "${block.type}"`);
    return true;
}


export interface BlockTraits_Container<T extends BlockType_Container> extends BlockTraits<T> {
    isContainer: true;

    creator?: (MDP: MarkdownParser, type: T) => BlockParser_Container<T>;
    defaultBlockInstance: BlockIndividualData<T>;
}


export function makeBlockTraits<bt extends BlockType, T extends Omit<BlockTraits<bt>, "blockType">>(type: bt, traits_: T): BlockTraits<bt> {
    const traits = traits_ as unknown as BlockTraits<bt>;
    traits.blockType = type;
    return traits;
}
export function makeBlockContainerTraits<bt extends BlockType_Container, T extends Omit<BlockTraits_Container<bt>, "blockType">>(type: bt, traits_: T): BlockTraits_Container<bt> {
    const traits = traits_ as unknown as BlockTraits_Container<bt>;
    traits.blockType = type;
    return traits;
}

export type AnyBlockTraits = BlockType extends infer K ? K extends BlockType ? BlockTraits<K> : never : never;



/**********************************************************************************************************************/

export interface InlineElementTraits<T extends InlineElementType = ExtensionInlineElementType,
                                     B extends InlineElement<T> = InlineElement<T>>
{
    startChars: string[]; // characters where inline element can possibly start — doesn't have to be a sufficient condition
    mode?: "normal" | "delimited"; // default is "normal"

    // The implementation can modify startPos to e.g. an earlier position if the inline item wants to backtrack
    // Use this feature with caution! It cannot collide with an already parsed earlier inline item.
    parse(this: InlineParser<T>, It: BlockContentIterator, startPos: InlinePos): B | false;

    creator: (MDP: MarkdownParser) => InlineParser<T>;
    defaultElementInstance: B;
}


type DelimiterCategory = "emphLoose" | "emphStrict" | "paired";

export interface DelimiterTraits {
    name:       string;
    startChars: string[]; // characters with which this delimiter can possibly start — doesn't have to be a sufficient condition
    category:   DelimiterCategory;

    // Do not check for prefixes/suffixes yourself! It gets done automatically depending on the delimiter category
    parseDelimiter(It: BlockContentIterator, startPos: InlinePos): Delimiter | false;

    // Called when a nested delimiter of this type is open and encounters its end character.
    // This method is often not necessary – use it when the end delimiter is more than just one character.
    parseCloser?(It: BlockContentIterator, startPos: InlinePos): string | false;

    //creator: (MDP: MarkdownParser) => InlineParser<T>;
}

export interface DelimFollowerTraits<T extends InlineElementType = ExtensionInlineElementType,
                                     B extends InlineElement<T>  = InlineElement<T>> {
    startDelims: string[]; // list of delimiter names; a closing delimiter of this type serves as a start char for this type of inline element
    contentOwner: boolean; // does this delim follower manage the delimited content itself?

    // The implementation can modify startPos to e.g. an earlier position if the inline item wants to backtrack
    // Use this feature with caution! It cannot collide with an already parsed earlier inline item.
    parse(this: InlineParser<T>, B: B, endOfStartDelim: Delimiter_nestable,
          It: BlockContentIterator, startPos: InlinePos): B | false;

    creator: (MDP: MarkdownParser) => InlineParser<T>;
    defaultElementInstance: B;
}


export type InlineParserTraitsList = Partial<{
    [K in InlineElementType]:  (InlineElementTraits<K> | DelimFollowerTraits<K>);
}>;

export const isDelimFollowerTraits = <K extends InlineElementType>(t: InlineElementTraits<K> | DelimFollowerTraits<K>): t is DelimFollowerTraits<K> =>
    ("startDelims" in t);
