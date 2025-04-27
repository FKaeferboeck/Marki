import { AnyInline, LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { makeBlockContentIterator, sliceLLD, standardBlockStart } from "../util.js";


export interface FencedBlock {
	fence_type:   "`" | "~";
	fence_length: number; // will be 3 most commonly
	indentation:  number;
	info_string:  AnyInline[];
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

        // process info string — it's not just verbatim text
        const LLD_info = sliceLLD(LLD, LLD.startIndent + B.fence_length);
        if(LLD_info.parts.length > 0)
            LLD_info.parts = [LLD_info.parts[0]];
        if(!(LLD_info.type === "empty" || LLD_info.type === "emptyish")) {
            //console.log(LLD_info);
            const It_info = makeBlockContentIterator(LLD_info);
            It_info.skipNobrSpace();
            this.MDP.inlineParser_minimal.inlineParseLoop(It_info, B.info_string);
            //B.info_string  = LLD.startPart.slice(B.fence_length).trim();
            //console.log(B.info_string)
        }

        B.indentation  = LLD.startIndent; // space before the fence -> will be trimmed from content lines too

        if(B.fence_type === "`" && B.info_string.some(P => typeof P === "string" && P.includes('`'))) {
            this.resetBlock();
            return -1;
        }
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
        info_string:  []
    }
};
