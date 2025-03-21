import { T } from "vitest/dist/chunks/environment.d8YfPkTm.js";
import { InlineParser_Standard } from "../inline-parser.js";
import { LogicalLineData, InlinePos, InlineElement } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";
import { BlockContentIterator, contentSlice, makeInlinePos } from "../util.js";
import { LinePart } from "../parser.js";


export const codeSpan_traits: InlineElementTraits<"codeSpan"> = {
    startChars: [ '`' ],

    parse(It: BlockContentIterator): InlineElement<"codeSpan"> | false {
        It.setCheckPointAtPrev();
        let marker_in_length = 1;
        let s: false | string | LinePart = false;
        while((s = It.nextChar()) === '`')
            ++marker_in_length;
        const space_in = (s === ' ');
        let space_out = false, marker_out_length = 0;
        while(true) {
            switch(s = It.nextItem()) {
            case ' ':
                space_out = true;
                marker_out_length = 0;
                break;
            case '`':
                if(++marker_out_length === marker_in_length)
                    return extractCodeSpan(It.checkpoint, It.pos, marker_in_length, space_in && space_out ? "spaced" : "normal");
                break;
            case false: // block ended in unclosed code span
                return extractCodeSpan(It.checkpoint, It.pos, marker_in_length, "unclosed");
            default:
                space_out = false;
                marker_out_length = 0;
                break;
            }
        }
    },
    
    creator(MDP) { return new InlineParser_Standard<"codeSpan">(MDP, this); },

    defaultElementInstance: {
        type:    "codeSpan",
        content: ''
    }
};




function extractCodeSpan(p0: InlinePos, p1: InlinePos, marker_length: number, mode: "normal" | "spaced" | "unclosed") : InlineElement<"codeSpan"> {
    let s: string = contentSlice(p0, p1, true);
    const m = marker_length + (mode === "spaced" ? 1 : 0);
    return {
        type:    "codeSpan",
        content: s.slice(m, mode === "unclosed" ? undefined : -m)
    }
}
