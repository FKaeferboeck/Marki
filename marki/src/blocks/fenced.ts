import { reassembleContent } from "../delimiter-processing.js";
import { makeInlineContext_minimal } from "../inline-parsing-context.js";
import { isSpaceLine, sliceLine, standardBlockStart } from "../linify.js";
import { AnyInline } from "../markdown-types.js";
import { makeBlockTraits } from "../traits.js";
import { makeBlockContentIterator } from "../util.js";


export interface FencedBlock {
	fence_type:   "`" | "~";
	fence_length: number; // will be 3 most commonly
	indentation:  number;
	info_string:  AnyInline[];
    language:     string | undefined;
}


export const fenced_traits = makeBlockTraits("fenced", {
    startsHere(LL, B) {
        if(!standardBlockStart(LL))
            return -1;
        const rexres = /^(?:`{3,}|~{3,})/.exec(LL.content);
        if(!rexres)
            return -1;

        B.fence_type   = LL.content[0] as FencedBlock["fence_type"];
        B.fence_length = rexres[0].length;

        // process info string — it's not just verbatim text
        const LL_info = sliceLine(LL, LL.indent + B.fence_length);
        if(!isSpaceLine(LL_info)) {
            const It_info = makeBlockContentIterator(LL_info);
            It_info.skipNobrSpace();

            const context = makeInlineContext_minimal(this);
            context.inlineParseLoop(It_info, B.info_string);

            const info = reassembleContent(B.info_string, this);
            B.language = /^\S+/.exec(info)?.[0] || undefined;
        }

        B.indentation  = LL.indent; // space before the fence -> will be trimmed from content lines too

        if(B.fence_type === "`" && B.info_string.some(P => typeof P === "string" && P.includes('`'))) {
            this.resetBlock();
            return -1;
        }
        return 0;
    },

    continuesHere(LL) {
        if(standardBlockStart(LL)) {
            const rex = new RegExp(`^${this.B.fence_type}{${this.B.fence_length},}\s*$`);
            if(rex.test(LL.content))
                return "last";
        }
        return Math.min(LL.indent, this.B.indentation);
    },

    acceptLineHook(_LL, bct) {
        return (bct !== "start");
    },

    allowSoftContinuations: false,
    allowCommentLines: true,
    isInterrupter: true,
    inlineProcessing: false,

    defaultBlockInstance: {
        fence_type:   "`",
        fence_length: 3,
        indentation:  0,
        info_string:  [],
        language:     undefined
    }
});
