import { BlockParser_Standard } from "../block-parser";
import { LogicalLineData } from "../markdown-types";
import { BlockTraits } from "../traits";


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
        return rexres[0].length;
    },
    continuesHere() { return "end"; }, // section headers are single-line

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
