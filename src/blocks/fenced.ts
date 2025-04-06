import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { standardBlockStart } from "../util.js";


export interface FencedBlock {
	fence_type:   "`" | "~";
	fence_length: number; // will be 3 most commonly
	indentation:  number;
	info_string:  string;
}


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
        B.indentation  = LLD.startIndent; // space before the fence -> will be trimmed from content lines too

        if(B.fence_type === "`" && B.info_string.includes('`'))
            return -1;

        return 0;
    },

    continuesHere(LLD) {
        if(LLD.type == "single" && LLD.startIndent < 4) {
            const rex = new RegExp(`^${this.B.fence_type}{${this.B.fence_length},}\s*$`);
            if(rex.test(LLD.startPart))
                return "last";
        }
        return Math.min(LLD.startIndent, this.B.indentation);
    },

    acceptLineHook(_LLD: LogicalLineData, bct) {
        return (bct !== "start");
    },

    allowSoftContinuations: false,
    allowCommentLines: true,

    defaultBlockInstance: {
        fence_type:   "`",
        fence_length: 3,
        indentation:  0,
        info_string:  ''
    }
};
