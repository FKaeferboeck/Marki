import { BlockQuote } from "./blocks/blockQuote.js";
import { ThematicBreak } from "./blocks/thematicBreak.js";
import { IndentedCodeBlock } from "./blocks/indentedCodeBlock.js";
import { Paragraph } from "./blocks/paragraph.js";
import { SectionHeader } from "./blocks/sectionHeader.js";
import { HTML_Markup, LinePart, LogicalLineType } from "./parser.js";
import { LinkDef } from "./blocks/linkDef.js";
import { FencedBlock } from "./blocks/fenced.js";
import { EmptySpace } from "./blocks/emptySpace.js";
import { ListItem } from "./blocks/listItem.js";

export type ExtensionNamespace = string;

export type ExtensionBlockType = `ext_${ExtensionNamespace}_${string}`;


export const LP_break      = { type: "lineBreak"     as const,  content: '\n' };
export const LP_break_HTML = { type: "lineBreakHTML" as const,  content: '\n' };
export const LP_EOF        = { type: "EOF"           as const,  content: [ false ] as const };

export type LinePart_ext = LinePart | typeof LP_break | typeof LP_break_HTML | typeof LP_EOF;

export interface LogicalLineData {
	logl_idx:                      number;
	parts:                         LinePart_ext[];
	startIndent:                   number;
	startPart:                     string; // after the indent
	type:                          LogicalLineType | "single";
	next:                          LogicalLineData | null;
	contentSlice?:                 LogicalLineData;
	isSoftContainerContinuation? : boolean;
}


export interface InlinePos {
	LLD:      LogicalLineData;
    //line_idx: number;
    part_idx: number;
    char_idx: number;
}


export interface BlockTypeMap_Leaf {
	emptySpace:           EmptySpace;
	paragraph:            Paragraph;
	sectionHeader:        SectionHeader; // atx header
	sectionHeader_setext: SectionHeader;
	indentedCodeBlock:    IndentedCodeBlock;
	thematicBreak:        ThematicBreak;
	fenced:               FencedBlock;
	linkDef:              LinkDef;
}

export interface BlockTypeMap_Container {
	blockQuote: BlockQuote;
	listItem:   ListItem;
}

export type BlockType_Leaf      = keyof BlockTypeMap_Leaf;
export type BlockType_Container = keyof BlockTypeMap_Container;
export type BlockType = BlockType_Leaf | BlockType_Container | ExtensionBlockType;


export type BlockBase<K extends BlockType> = {
	type:                K;
	logical_line_start:  number;
	logical_line_extent: number;
	content?:            LogicalLineData;
	inlineContent?:      AnyInline[]; // same as "content", but inline parsed
};

export interface BlockBase_Container_additions {
	isContainer: true;
	blocks:      AnyBlock[];
}

export type BlockIndividualData<K extends BlockType> = (K extends BlockType_Container ? BlockTypeMap_Container[K] :
	                                                    K extends BlockType_Leaf      ? BlockTypeMap_Leaf[K] : { });

export type Block_Leaf     <K extends BlockType_Leaf>      = BlockBase<K> & BlockTypeMap_Leaf[K];
export type Block_Container<K extends BlockType_Container> = BlockBase<K> & BlockTypeMap_Container[K] & BlockBase_Container_additions;

export type Block<K extends BlockType> = (K extends BlockType_Container ? Block_Container<K> :
	                                      K extends BlockType_Leaf      ? Block_Leaf<K> : BlockBase<K>);


export type AnyBlock = BlockType extends infer U ? (U extends BlockType_Leaf      ? Block_Leaf<U> :
	                                                U extends BlockType_Container ? Block_Container<U> : never) : never;

export type AnyContainerBlock = BlockType_Container extends infer U ? (U extends BlockType_Container ? Block_Container<U> : never) : never;

export const isContainer = (B: AnyBlock): B is AnyContainerBlock => ("isContainer" in B);



/**********************************************************************************************************************/

export interface InlineElementMap {
	escaped:    { character: string; };
	htmlEntity: { code: string;  codePoint: number | undefined; /* undefined describes an illegal entity code */ }
	html:       { stuff: string;  continues?: boolean; };
	codeSpan:   { content: string; };
	link:       { linkType:    "inline" | "reference" | "collapsed" | "shortcut";
	              linkLabel:   string; //InlineContent;
	              destination: AnyInline[];
	              linkTitle?:  AnyInline[];
				  reference?:  Block<"linkDef">; };
	hardBreak:  { };
}

export type ExtensionInlineElementType = `ext_${ExtensionNamespace}_${string}`;
export type InlineElementType = keyof InlineElementMap | ExtensionInlineElementType;


export interface InlineElementBase<K extends InlineElementType> {
	type: K;
}

export type InlineElement<K extends InlineElementType> = (K extends keyof InlineElementMap ? InlineElementMap[K] & InlineElementBase<K> : never);

export type AnyInline = string | (InlineElementType extends infer U ? (U extends keyof InlineElementMap ? InlineElement<U> : never) : never);

export type InlineContent = (string | AnyInline)[];
