import { BlockParser_Standard } from "../block-parser";
import { LogicalLineData } from "../markdown-types";
import { BlockTraits } from "../traits";

export interface IndentedCodeBlock {
    indention: string;
};


export const fenced_traits: BlockTraits<"fenced"> = {
    startsHere(LLD: LogicalLineData, B) {
        const rexres = /^(`{3,}|~{3,})(\s|$)/.exec(LLD.startPart);
        if(!rexres)
            return -1;
        
        if(rexres[0].length > 3) {
            // TODO!! Handle the info string
        }
        B.fence_type   = rexres[1].charAt(0) as "`" | "~";
        B.fence_length = rexres[1].length;
        return 0;
    },
    continuesHere(LLD, B) {
        const rex = new RegExp(`^${B.fence_type}{${B.fence_length},}\s*$`);
        if(LLD.startIndent < 4 && rex.test(LLD.startPart))
            return "last";
        return 0;
    },

    allowSoftContinuations: false,
    allowCommentLines: true,

    creator(MDP) { return new BlockParser_Standard<"fenced">(MDP, this); },
    defaultBlockInstance: {
        type: "fenced",
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        fence_type:   "`",
        fence_length: 3,
        indentation:  0
    }
};
