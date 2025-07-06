import { InlineElementTraits } from "../traits.js";

export const backslashEscapeds: Record<string, boolean> = {
    '!': true,  '"': true,  '#': true,  '$': true,  '%': true,  '&': true,  '\'': true,  '(' : true,
    ')': true,  '*': true,  '+': true,  ',': true,  '-': true,  '.': true,  '/' : true,  ':' : true,
    ';': true,  '<': true,  '=': true,  '>': true,  '?': true,  '@': true,  '[' : true,  '\\': true,
    ']': true,  '^': true,  '_': true,  '`': true,  '{': true,  '|': true,  '}' : true,  '~' : true
};


export const escaped_traits: InlineElementTraits<"escaped"> = {
    startChars: [ '\\' ],

    parse(It, B) {
        if(It.pop() !== '\\')
            return false;
        const c = It.pop();
        if(!c || !backslashEscapeds[c])
            return false;
        B.character = c;
        return true;
    },

    defaultElementInstance: {
        type:      "escaped",
        character: ''
    }
};
