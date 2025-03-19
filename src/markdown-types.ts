import { BlockQuote } from "./blocks/blockQuote.js";
import { ThematicBreak } from "./blocks/thematicBreak.js";
import { IndentedCodeBlock } from "./blocks/indentedCodeBlock.js";
import { Paragraph } from "./blocks/paragraph.js";
import { SectionHeader } from "./blocks/sectionHeader.js";
import { LinePart, LogicalLineType } from "./parser.js";

export type ExtensionNamespace = string;

export type ExtensionBlockType = `ext_${ExtensionNamespace}_${string}`;

export interface LogicalLineData {
	logl_idx:                      number;
	parts:                         LinePart[];
	startIndent:                   number;
	startPart:                     string; // after the indent
	type:                          LogicalLineType | "single";
	next:                          LogicalLineData | null;
	contentSlice?:                 LogicalLineData;
	isSoftContainerContinuation? : boolean;
}


export interface EmptySpace { };

export interface ListItem {
	marker:         "*" | "-" | "+" | "." | ")";
	marker_number?: number;
	indent:         number;
	isLooseItem:    boolean;
	parentList:     List | undefined;
}

export interface List {
	listType:  "Ordered" | "Bullet";
	contents:  Block<"listItem">[];
	startIdx?: number;
	isLoose:   boolean;
}

export interface FencedBlock {
	fence_type:   "`" | "~";
	fence_length: number; // will be 3 most commonly
	indentation:  number;
	info_string:  string;
}


export interface BlockTypeMap_Leaf {
	emptySpace:        EmptySpace;
	paragraph:         Paragraph;
	sectionHeader:     SectionHeader; // atx header

	sectionHeader_setext: SectionHeader;
	indentedCodeBlock:    IndentedCodeBlock;
	thematicBreak:        ThematicBreak;
	fenced:               FencedBlock;
}

export interface BlockTypeMap_Container {
	blockQuote: BlockQuote;
	listItem:   ListItem;
}

export type BlockType_Leaf      = keyof BlockTypeMap_Leaf;
export type BlockType_Container = keyof BlockTypeMap_Container;
export type BlockType = BlockType_Leaf | BlockType_Container | ExtensionBlockType;


export type BlockBase<K extends BlockType> = {
	type: K;
	logical_line_start:  number;
	logical_line_extent: number;
	contents:            any[];
};



export interface BlockBase_Container_additions {
	isContainer: true;
	blocks:      AnyBlock[];
}

export type BlockBase_Leaf     <K extends BlockType_Leaf>      = BlockBase<K> & BlockTypeMap_Leaf[K];
export type BlockBase_Container<K extends BlockType_Container> = BlockBase<K> & BlockTypeMap_Container[K] & BlockBase_Container_additions;

export type Block<K extends BlockType> = (K extends BlockType_Container ? BlockBase_Container<K> :
	                                      K extends BlockType_Leaf      ? BlockBase_Leaf<K> : BlockBase<K>);


export type AnyBlock = BlockType extends infer U ? (U extends BlockType_Leaf      ? BlockBase_Leaf<U> :
	                                                U extends BlockType_Container ? BlockBase_Container<U> : never) : never;

export type AnyContainerBlock = BlockType_Container extends infer U ? (U extends BlockType_Container ? BlockBase_Container<U> : never) : never;

export const isContainer = (B: AnyBlock): B is AnyContainerBlock => ("isContainer" in B);
