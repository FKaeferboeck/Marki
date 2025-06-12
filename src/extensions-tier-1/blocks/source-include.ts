import { LogicalLine, standardBlockStart } from "../../linify.js";
import { BlockBase, BlockBase_Container_additions, BlockType } from "../../markdown-types.js";
import { BlockTraitsExtended } from "../../traits.js";


/*export interface SourceInclude {
    target: string;
}


export interface SourceIncludeTraits_extra {
    command: string; // the include command; default is #include (as in C++)
}

export type Block_Container_Ext<K extends BlockType, BlockExtra = {}> = BlockBase<K> & BlockBase_Container_additions & BlockExtra;

export type Block_SourceInclude = Block_Container_Ext<"ext_standard_sourceInclude", SourceInclude>;


export const sourceInclude_traits: BlockTraitsExtended<"ext_standard_sourceInclude", SourceIncludeTraits_extra> = {
    startsHere(LL: LogicalLine, B: Block_SourceInclude) {
        if(!standardBlockStart(LL))
            return -1;
        if(!LL.content.startsWith(this.traits.command))
            return -1;
        const rexres = /^\s+/.exec(LL.content.slice(this.traits.command.length));
        if(!rexres)
            return -1;
        const n = this.traits.command.length + rexres[0].length;
        B.target = LL.content.slice(n);
        return n;
    },
    continuesHere() { return "end"; }, // single-line

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { target: '' } as SourceInclude,

    command: '#include'
};*/
