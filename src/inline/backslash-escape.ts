import { InlineParser_Standard } from "../inline-parser.js";
import { InlinePos, InlineElement } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";
import { contentSlice } from "../util.js";


export const backslashEscapeds: Record<string, boolean> = {
    '!': true,  '"': true,  '#': true,  '$': true,  '%': true,  '&': true,  '\'': true,  '(' : true,
    ')': true,  '*': true,  '+': true,  ',': true,  '-': true,  '.': true,  '/' : true,  ':' : true,
    ';': true,  '<': true,  '=': true,  '>': true,  '?': true,  '@': true,  '[' : true,  '\\': true,
    ']': true,  '^': true,  '_': true,  '`': true,  '{': true,  '|': true,  '}' : true,  '~' : true
};


export const escaped_traits: InlineElementTraits<"escaped"> = {
    startChars: [ '\\' ],

    parse(It) {
        if(It.pop() !== '\\')
            return false;
        const c = It.pop();
        if(!c || !backslashEscapeds[c])
            return false;
        this.B.character = c;
        return this.B;
    },
    
    creator(MDP) { return new InlineParser_Standard<"escaped">(MDP, this); },

    defaultElementInstance: {
        type:      "escaped",
        character: ''
    }
};




function extractCodeSpan(p0: InlinePos, p1: InlinePos, marker_length: number, mode: "normal" | "spaced" | "unclosed") : InlineElement<"codeSpan"> {
    let s: string = contentSlice(p0, p1, true, ' '); // turn line endings into space
    const m = marker_length + (mode === "spaced" ? 1 : 0);
    return {
        type:    "codeSpan",
        content: s.slice(m, mode === "unclosed" ? undefined : -m)
    }
}
