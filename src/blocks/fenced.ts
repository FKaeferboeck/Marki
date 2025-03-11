import { BlockParser_Standard } from "../block-parser";
import { FencedBlock, LogicalLineData } from "../markdown-types";
import { BlockTraits } from "../traits";
import { standardBlockStart } from "../util";


export const fenced_traits: BlockTraits<"fenced"> = {
    startsHere(LLD, B) {
        if(!standardBlockStart(LLD))
            return -1;
        const rexres = /^(?:`{3,}|~{3,})/.exec(LLD.startPart);
        if(!rexres)
            return -1;

        B.fence_type   = LLD.startPart.charAt(0) as FencedBlock["fence_type"];
        B.fence_length = rexres[0].length;
        B.info_string  = LLD.startPart.slice(B.fence_length).trim();
        return 0;
    },

    continuesHere(LLD, B) {
        if(LLD.type == "single" && LLD.startIndent < 4) {
            const rex = new RegExp(`^${B.fence_type}{${B.fence_length},}\s*$`);
            if(rex.test(LLD.startPart))
                return "last";
        }
        return B.indentation;
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
        indentation:  0,
        info_string:  ''
    }
};
