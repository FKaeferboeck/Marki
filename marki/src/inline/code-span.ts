import { InlinePos, InlineElement } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";
import { contentSlice } from "../util.js";


export const codeSpan_traits: InlineElementTraits<"codeSpan"> = {
    startChars: [ '`' ],

    parse(It, B, pos0) {
        let marker_in_length = 0;
        let s: false | string = false;
        if(It.peekN(-1) === '`') // start char is part of a longer sequence of ````, but not the first one
            return false;
        while((s = It.pop()) === '`')
            ++marker_in_length;
        if(marker_in_length === 0) // just in case, it should already be guaranteed by the start char check
            return false;
        const space_in = (s === ' ' || s === '\n');
        let space_out = false, marker_out_length = 0, non_space = 0;
        while(true) {
            switch(s) {
            case ' ':
            case '\n':
                space_out = true;
                marker_out_length = 0;
                break;
            case '`':
                ++non_space;
                if(++marker_out_length === marker_in_length && It.peek() !== '`')
                    return extractCodeSpan(B, pos0, It.newPos(), marker_in_length,
                                           space_in && space_out && non_space != marker_in_length ? "spaced" : "normal");
                break;
            case false: // block ended in unclosed code span
                return false;
            default:
                ++non_space;
                space_out = false;
                marker_out_length = 0;
                break;
            }
            s = It.pop();
        }
    },

    defaultElementInstance: {
        type:    "codeSpan",
        content: ''
    }
};


function extractCodeSpan(B: InlineElement<"codeSpan">, p0: InlinePos, p1: InlinePos, marker_length: number, mode: "normal" | "spaced" | "unclosed") {
    let s: string = contentSlice(p0, p1, true, ' '); // turn line endings into space
    const m = marker_length + (mode === "spaced" ? 1 : 0);
    B.content = s.slice(m, mode === "unclosed" ? undefined : -m);
    return true;
}
