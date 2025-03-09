import { BlockQuote } from "./blocks/blockQuote";
import { ThematicBreak } from "./blocks/thematicBreak";
import { IndentedCodeBlock } from "./blocks/indentedCodeBlock";
import { Paragraph } from "./blocks/paragraph";
import { SectionHeader } from "./blocks/sectionHeader";
import { LinePart, LogicalLineType } from "./parser";

export type ExtensionNamespace = string;

export type ExtensionBlockType = `ext_${ExtensionNamespace}_${string}`;

export interface LogicalLineData {
	logl_idx:    number;
	parts:       LinePart[];
	startIndent: number;
	startPart:   string; // after the indent
	type:        LogicalLineType | "single";
	next:        LogicalLineData | null;
}


export interface EmptySpace { };

export interface ListItem { };

export interface List {
	listType: "Ordered" | "Bullet";
	contents: ListItem[];
}

export interface FencedBlock {
	fence_type:  "`" | "~";
	fence_length: number; // will be 3 most commonly
	indentation: number;
};

export interface Remark {
	header?: string;
}

export interface SDS_ConceptElement {
	fenced: boolean;
}


export interface BlockTypeMap {
	emptySpace:        EmptySpace;
	paragraph:         Paragraph;
	sectionHeader:     SectionHeader; // atx header
	listItem:          ListItem;
	list:              List;
	sdsConceptElement: SDS_ConceptElement;

	sectionHeader_setext: SectionHeader;
	blockQuote:           BlockQuote;
	indentedCodeBlock:    IndentedCodeBlock;
	thematicBreak:        ThematicBreak;
	fenced:               FencedBlock;
}

export type BlockType = keyof BlockTypeMap | ExtensionBlockType;

/*interface BlockBase<K extends BlockType>  {
	type: K;
	data: BlockTypeMap[K];
}*/
export type BlockBase<K extends BlockType> = (K extends keyof BlockTypeMap ? BlockTypeMap[K] : { }) & {
	type: K;
	logical_line_start:  number;
	logical_line_extent: number;
	contents: any[];
};


export type ContainerBlockBase<K extends BlockType> = BlockBase<K> & {
	isContainer: true;
	blocks:      Block[];
};


export type Block = BlockBase<BlockType>;
