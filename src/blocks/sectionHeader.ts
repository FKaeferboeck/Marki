import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { measureIndent } from "../util.js";


export interface SectionHeader {
	level: number;
	//customTag?: string;
}


export const sectionHeader_traits: BlockTraits<"sectionHeader"> = {
    startsHere(LLD: LogicalLineData, B) {
        if(!(LLD.type === "single" || LLD.type === "text") || LLD.startIndent >= 4)
            return -1;
        const rexres = /^(#{1,6})(\s+|$)/.exec(LLD.startPart);
        if(!rexres)
            return -1;
        B.level = rexres[1].length;
        const n0 = rexres[1].length + LLD.startIndent;
        return n0 + measureIndent(rexres[2], (LLD.preStartIndent || 0) + n0);
    },
    continuesHere() { return "end"; }, // section headers are single-line

    postprocessContentLine(LLD) {
        LLD.startPart = LLD.startPart.replace(/(?:\s+#+|^#+)?\s*$/, ''); // handle trailing space and closing sequences
        return LLD;
    },

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { level: -1 }
};
