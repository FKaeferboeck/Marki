import { BlockParser_Standard } from "../block-parser.js";
import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";


export interface SectionHeader {
	level: number;
	//customTag?: string;
}


export const sectionHeader_traits: BlockTraits<"sectionHeader"> = {
    startsHere(LLD: LogicalLineData, B) {
        if(!(LLD.type === "single" || LLD.type === "text") || LLD.startIndent >= 4)
            return -1;
        const rexres = /^(#{1,6})(?:\s+|$)/.exec(LLD.startPart);
        if(!rexres)
            return -1;
        B.level = rexres[1].length;
        return rexres[0].length + LLD.startIndent;
    },
    continuesHere() { return "end"; }, // section headers are single-line

    postprocessContentLine(LLD) {
        LLD.startPart = LLD.startPart.replace(/(?:\s+#+|^#+)?\s*$/, ''); // handle trailing space and closing sequences
        return LLD;
    },

    allowSoftContinuations: false,
    allowCommentLines: false,
    creator(MDP) { return new BlockParser_Standard<"sectionHeader">(MDP, this); },
    defaultBlockInstance: {
        type: "sectionHeader",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        level: -1
    }
};
