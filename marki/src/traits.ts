import { BlockParser, BlockParser_Container, ParsingContext } from "./block-parser.js";
import { InlineParser } from "./inline-parser.js";
import { InlineParserProvider, InlineParsingContext } from "./inline-parsing-context.js";
import { LogicalLine, LogicalLine_with_cmt } from "./linify.js";
import { BlockParserProvider, MarkdownParserTraits } from "./markdown-parser.js";
import { BlockType, ExtensionBlockType, BlockType_Container, Block, InlineElementType, ExtensionInlineElementType, InlineElement, InlinePos, BlockIndividualData, Delimiter, Delimiter_nestable, Block_Extension, AnyBlock, InlineElementBase, Block_Container_Extension, MarkiDocument } from "./markdown-types.js";
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
    startsHere(this: BlockParser<T, BlockTraitsExtended<T, B, Extra>>, LL: LogicalLine, B: Block<T> & B, interrupting?: BlockType | undefined): number;

    /* returning undefined means the function doesn't make a decision whether to continue the block here,
     * and leaves it to the subsequent standard algorithm instead.
     */
    continuesHere?(this: BlockParser<T, BlockTraitsExtended<T, B, Extra>>, LL: LogicalLine, isSoftContainerContinuation?: boolean): BlockContinuationType | undefined;

    acceptLineHook?(this: BlockParser<T>, LL: LogicalLine, bct: BlockContinuationType | "start") : boolean;
    finalizeBlockHook?(this: BlockParser<T, BlockTraitsExtended<T, B, Extra>>): void;

    /* in case content lines need to be transformed in some way when adding them to the block content */
    postprocessContentLine?(this: BlockParser<T>, LL: LogicalLine, bct: BlockContinuationType | "start") : LogicalLine_with_cmt;

    // Optionally a processing step that is performed after block parsing but before inline parsing.
    // It is meant for running DB queries and similar for data stored into the ParsingContext object during parsing.
    // It's called a single time and should hande all instances of this block type together.
    // CommonMark doesn't use this feature, it's for extensions.
    processingStep?(this: ParsingContext, doc: MarkiDocument): Promise<void>;
    processingStepMode?: "structural" // step adds material to the document and must therefore be performed before singleton gathering
                       | "separate" // step makes changes / produces data that other steps depend on -> must be performed before them
                       | "parallel" // the processing step can be performed simultaneously with other processing steps == DEFAULT

    continuationPrefix?: RegExp| ((LL: LogicalLine, B: Block<T>) => number);
    
    allowSoftContinuations: boolean;
    canBeSoftContinuation?: boolean; // default true
    allowCommentLines: boolean;
    isInterrupter?: boolean; // Can this block interrupt soft continuations? default false
    customContentParser?: InlineParserProvider; // some block types may want to do their own thing
    isSingleton?: "first" | "last" | false; // default false

    hasContent?: boolean; // default true; false means that this element stores all data it has in its individual block data and doesn't use the "content" property
    inlineProcessing?: boolean | ((this: ParsingContext, block: AnyBlock) => void); // default true
    lastIsContent?: boolean; // if a line is continuation type "last" it will still be added to the block content - default false
    canSelfInterrupt?: boolean; // list items do that
    creator?: (PP: BlockParserProvider, type: T) => BlockParser<T>;
    defaultBlockInstance: B;
}

export type BlockTraitsExtended<T     extends BlockType = ExtensionBlockType,
                                B     extends BlockIndividualData<T> = BlockIndividualData<T>,
                                Extra extends {} = {}>
    = BlockTraits<T, B, Extra> & Extra;


export type ExtensionBlockTraits<B extends BlockIndividualData = BlockIndividualData, Extra extends {} = {}>
    = BlockTraitsExtended<ExtensionBlockType, B, Extra>;

export function castExtensionBlock<B extends BlockIndividualData>
    (block: AnyBlock | undefined, traits: ExtensionBlockTraits<B>): block is Block_Extension & B
{
    return (block?.type === traits.blockType)
}

export interface BlockTraits_Container<T extends BlockType_Container | ExtensionBlockType,
                                       B     extends BlockIndividualData<T> = BlockIndividualData<T>,
                                       Extra extends {} = {}> extends BlockTraits<T, B, Extra>
{
    containerMode: "Container" | "Wrapper";
    contentParserTryOrder?: string | undefined;
    customChildParser?: (block: Block_Container_Extension<T> & B, i: number, ctx: ParsingContext) => InlineParserProvider | undefined;
    creator?: (PP: BlockParserProvider, type: T) => (T extends BlockType_Container ? BlockParser_Container<T> : never);
    defaultBlockInstance: B;
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

export type BlockContainerTraitsExtended<T     extends BlockType_Container | ExtensionBlockType = ExtensionBlockType,
                                         B     extends BlockIndividualData<T> = BlockIndividualData<T>,
                                         Extra extends {} = {}>
    = BlockTraits_Container<T, B, Extra> & Extra;

export type ExtensionBlockContainerTraits<B extends BlockIndividualData = BlockIndividualData, Extra extends {} = {}>
    = BlockContainerTraitsExtended<ExtensionBlockType, B, Extra>;

export function castExtensionBlockContainer<B extends BlockIndividualData>
    (block: AnyBlock, traits: ExtensionBlockContainerTraits<B>): block is Block_Container_Extension<ExtensionBlockType> & B
{ return (block.type === traits.blockType); }



export type AnyBlockTraits = BlockType extends infer K ? K extends BlockType ? BlockTraits<K> : never : never;



/**********************************************************************************************************************/

type InlineElementCustomData<T extends InlineElementType, B extends InlineElement<T>> = Omit<B, Exclude<keyof InlineElementBase<T>, "type">>;


export interface InlineElementTraits<T extends InlineElementType = ExtensionInlineElementType,
                                     B extends InlineElement<T> = InlineElement<T>>
{
    startChars: string[] | ((this: MarkdownParserTraits) => string[]); // characters where inline element can possibly start — doesn't have to be a sufficient condition
                                                                       // They can be dynamically defined (callback)
    mode?: "normal" | "delimited"; // default is "normal"

    // The implementation can modify startPos to e.g. an earlier position if the inline item wants to backtrack
    // Use this feature with caution! It cannot collide with an already parsed earlier inline item.
    parse(this: InlineParser<T, B>, It: BlockContentIterator, B: B, startPos: InlinePos): boolean;

    // Optionally a processing step that is performed after inline parsing but before rendering.
    // It is meant for running DB queries and similar for data stored into the ParsingContext object during parsing.
    // It's called a single time and should hande all instances of this inline element type together.
    // CommonMark doesn't use this feature, it's for extensions.
    processingStep?(this: ParsingContext): Promise<void>;

    creator?: (ctx: ParsingContext) => InlineParser<T>;
    defaultElementInstance: InlineElementCustomData<T, B>;
}


type DelimiterCategory = "emphLoose" | "emphStrict" | "paired";

export interface DelimiterTraits {
    name:       string;
    startChars: string[] | ((this: MarkdownParserTraits) => string[]); // characters with which this delimiter can possibly start — doesn't have to be a sufficient condition
    category:   DelimiterCategory;

    // Do not check for prefixes/suffixes yourself! It gets done automatically depending on the delimiter category
    parseDelimiter(this: InlineParsingContext, It: BlockContentIterator, startPos: InlinePos): Delimiter | false;

    // Called when a nested delimiter of this type is open and encounters its end character.
    // This method is often not necessary – use it when the end delimiter is more than just one character.
    parseCloser?(It: BlockContentIterator, startPos: InlinePos): string | false;
}

export interface DelimFollowerTraits<T extends InlineElementType = ExtensionInlineElementType,
                                     B extends InlineElement<T>  = InlineElement<T>> {
    startDelims: string[]; // list of delimiter names; a closing delimiter of this type serves as a start char for this type of inline element
    contentOwner: boolean; // does this delim follower manage the delimited content itself?

    // The implementation can modify startPos to e.g. an earlier position if the inline item wants to backtrack
    // Use this feature with caution! It cannot collide with an already parsed earlier inline item.
    parse(this: InlineParser<T>, B: B, endOfStartDelim: Delimiter_nestable,
          It: BlockContentIterator, startPos: InlinePos): boolean;

    processingStep?(this: ParsingContext): Promise<void>;

    creator?: (ctx: ParsingContext) => InlineParser<T>;
    defaultElementInstance: InlineElementCustomData<T, B>;
}


export type InlineParserTraitsList = Partial<{
    [K in InlineElementType]:  (InlineElementTraits<K> | DelimFollowerTraits<K>);
}>;

export const isDelimFollowerTraits = <K extends InlineElementType>(t: InlineElementTraits<K> | DelimFollowerTraits<K>): t is DelimFollowerTraits<K> =>
    ("startDelims" in t);
