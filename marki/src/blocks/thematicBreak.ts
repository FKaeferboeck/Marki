import { makeBlockTraits } from "../traits.js";
import { standardBlockStart } from "../linify.js";


export interface ThematicBreak {
	ruleType: "*" | "-" | "_";
}


export const thematicBreak_traits = makeBlockTraits("thematicBreak", {
    startsHere(LL, B) {
        if(!standardBlockStart(LL) || !/^(?:\*(?:\s*\*){2,}|-(?:\s*-){2,}|_(?:\s*_){2,})\s*$/.test(LL.content))
            return -1;
        B.ruleType = LL.content[0] as ThematicBreak["ruleType"];
        return 0;
    },
    allowSoftContinuations: false,
    allowCommentLines: false,
    isInterrupter: true,
    continuesHere() { return "end"; }, // thematic breaks are single-line
    
    defaultBlockInstance: { ruleType: "*" }
});
