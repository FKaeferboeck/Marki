import { BlockParser_Standard } from "../block-parser";
import { LogicalLineData } from "../markdown-types";
import { BlockTraits } from "../traits";


export interface HorizontalRule {
	ruleType: "**" | "* " | "--" | "- ";
}


export const horizontalRule_traits: BlockTraits<"horizontalRule"> = {
    startsHere(data: LogicalLineData, B) {
        const rexres = /^ {0,3}(\*\*+|\*(?: \*)+|--+|-(?: -)+)\s*$/.exec(data.startPart);
        if(!rexres || data.parts.length !== 1)    return -1;
        B.ruleType = rexres[1].slice(0, 2) as HorizontalRule["ruleType"];
        return data.startPart.length;
    },
    allowSoftContinuations: false,
    allowCommentLines: false,
    continuationPrefix: null,
    continuesHere(s: string, this_block) { return false; }, // horizontal rules are single-line
    
    creator(MDP) { return new BlockParser_Standard<"horizontalRule">(MDP, this); },
    defaultBlockInstance: {
        type: "horizontalRule",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        ruleType: "**"
    }
};
