import { BlockParser } from "../../block-parser.js";
import { LogicalLineData } from "../../markdown-types.js";
import { BlockTraits, BlockTraitsExtended } from "../../traits.js";
import { measureIndent } from "../../util.js";


export interface SourceInclude {
    target: string;
}


export interface SourceIncludeTraits_extra {
    command: string; // the include command; default is #include (as in C++)
}

export const sourceInclude_traits: BlockTraitsExtended<"ext_standard_sourceInclude", SourceIncludeTraits_extra> = {
    startsHere(LLD: LogicalLineData, B) {
        if(!(LLD.type === "single" || LLD.type === "text") || LLD.startIndent >= 4)
            return -1;
        if(!LLD.startPart.startsWith(this.traits.command))
            return -1;
        const rexres = /^\s+/.exec(LLD.startPart.slice(this.traits.command.length));
        if(!rexres)
            return -1;
        return this.traits.command.length + rexres[0].length;
    },
    continuesHere() { return "end"; }, // single-line

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { target: '' },

    command: '#include'
};
