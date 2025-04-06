import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { standardBlockStart } from "../util.js";


export interface ThematicBreak {
	ruleType: "*" | "-" | "_";
}


export const thematicBreak_traits: BlockTraits<"thematicBreak"> = {
    startsHere(LLD: LogicalLineData, B) {
        if(!standardBlockStart(LLD) || !/^(?:\*(?:\s*\*){2,}|-(?:\s*-){2,}|_(?:\s*_){2,})\s*$/.test(LLD.startPart))
            return -1;
        B.ruleType = LLD.startPart.charAt(0) as ThematicBreak["ruleType"];
        return 0;
    },
    allowSoftContinuations: false,
    allowCommentLines: false,
    continuesHere() { return "end"; }, // thematic breaks are single-line
    
    defaultBlockInstance: { ruleType: "*" }
};
