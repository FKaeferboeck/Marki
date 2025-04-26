import { BlockParser } from "../../block-parser.js";
import { Block_Container, BlockBase, BlockBase_Container_additions, BlockType, BlockTypeMap_Container, LogicalLineData } from "../../markdown-types.js";
import { BlockTraits, BlockTraitsExtended } from "../../traits.js";
import { measureIndent } from "../../util.js";


export interface SourceInclude {
    target: string;
}


export interface SourceIncludeTraits_extra {
    command: string; // the include command; default is #include (as in C++)
}

export type Block_Container_Ext<K extends BlockType, BlockExtra = {}> = BlockBase<K> & BlockBase_Container_additions & BlockExtra;

export type Block_SourceInclude = Block_Container_Ext<"ext_standard_sourceInclude", SourceInclude>;


export const sourceInclude_traits: BlockTraitsExtended<"ext_standard_sourceInclude", SourceIncludeTraits_extra> = {
    startsHere(LLD: LogicalLineData, B: Block_SourceInclude) {
        if(!(LLD.type === "single" || LLD.type === "text") || LLD.startIndent >= 4)
            return -1;
        if(!LLD.startPart.startsWith(this.traits.command))
            return -1;
        const rexres = /^\s+/.exec(LLD.startPart.slice(this.traits.command.length));
        if(!rexres)
            return -1;
        const n = this.traits.command.length + rexres[0].length;
        B.target = LLD.startPart.slice(n);
        return n;
    },
    continuesHere() { return "end"; }, // single-line

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { target: '' } as SourceInclude,

    command: '#include'
};
