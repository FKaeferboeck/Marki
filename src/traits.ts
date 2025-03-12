import { BlockParser, MarkdownParser } from "./block-parser";
import { BlockParser_Container } from "./blocks/blockQuote";
import { BlockType, ExtensionBlockType, BlockBase, ContainerBlockBase, LogicalLineData } from "./markdown-types";


export type BlockContinuationType = number    // block definitely continues in this line (e.g. because of the prefix)
                                  | "soft"    // block potentially continues in this line unless another block wants to interrupt it
                                  | "end"     // block definitely does not continue in this line, the previous line is the last
                                  | "last"    // block ends after this line, this is the last line of the block
                                  | "reject"; // we've reached a line that's incompatible with the current block, so we reject the block and try a different block type



export interface BlockTraits<T extends BlockType = ExtensionBlockType> {
    /* This method should return -1 if a block of this type cannot begin in this line.
       If it can begin here it shoudl return a number describing the offset where the actual content of the block (after a prefix) starts,
       e.g. 2 for a blockquote starting after "> ".
       If the prefix contains additional data (e.g. the level of an atx header) the method can parse that data into the provided block object. */
    startsHere(this: BlockParser<BlockBase<T>>, data: LogicalLineData, B: BlockBase<T>): number;

    /* returning undefined means the function doesn't make a decision whether to continue the block here,
     * and leaves it to the subsequent standard algorithm instead.
     */
    continuesHere?(this: BlockParser<BlockBase<T>>, data: LogicalLineData, B: BlockBase<T>): BlockContinuationType | undefined;

    acceptLineHook?(this: BlockParser<BlockBase<T>>, LLD: LogicalLineData, bct: BlockContinuationType | "start") : boolean;

    /* in case content lines need to be transformed in some way when adding them to the block content */
    postprocessContentLine?(this: BlockParser<BlockBase<T>>, LLD: LogicalLineData, bct: BlockContinuationType | "start") : LogicalLineData;

    continuationPrefix?: RegExp| ((LLD: LogicalLineData, B: BlockBase<T>) => number);
    
    allowSoftContinuations: boolean;
    canBeSoftContinuation?: boolean; // default true
    allowCommentLines: boolean;
    lastIsContent?: boolean; // if a line is continuation type "last" it will still be added to the block content - default false
    creator: (MDP: MarkdownParser) => BlockParser<BlockBase<T>>; //BlockParserClass<T>;
    defaultBlockInstance: BlockBase<T>;
}



export interface ContainerBlockTraits<T extends BlockType> extends BlockTraits<T> {
    isContainer: true;

    startsHere(this: BlockParser_Container<T>, data: LogicalLineData, B: ContainerBlockBase<T>): number;

    creator: (MDP: MarkdownParser) => BlockParser_Container<T>; //BlockParser<ContainerBlockBase<T>>; //BlockParserClass<T>;
    defaultBlockInstance: ContainerBlockBase<T>;
}



export type BlockParserTraitsList = Partial<{
    [K in BlockType]: BlockTraits<K> | ContainerBlockTraits<K>;
}>;


/*type BlockParserClass<K extends BlockType> = {
	new (traits: BlockParserTraits<K>, LS: LineStructure): BlockParser<BlockBase<K>>;
	prototype: BlockParser<BlockBase<K>>;
}*/
