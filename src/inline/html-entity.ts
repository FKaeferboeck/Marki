import { InlineParser_Standard } from "../inline-parser.js";
import { AnyInline, InlineElement } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";
//import entityList from "../htmlEntities.json" assert { type: "json" };
const { default: entityList } = await import("../htmlEntities.json", { with: { type: "json" } });


const rex = /^&(?:#\d{1,7};|#[xX][\dA-Fa-f]{1,6};|[A-Za-z][A-Za-z\d]{0,32};)/; // 32 is the length of the longest existing HTML entity

function processHTML_entity(entity: RegExpMatchArray, B: InlineElement<"htmlEntity">) {
    B.code = entity[0].slice(1, -1);
    if(!B.code.startsWith('#'))
        B.codePoint = (entityList as Record<string, number | number[]>)[B.code];
    else {
        const c = B.code.charAt(1);
        const n = (c === 'x' || c === 'X' ? Number.parseInt(B.code.slice(2), 16)
                                          : +B.code.slice(1));
        B.valid = !(n === 0 || n === 0x0D || (0x80 <= n && n <= 0x9F) || (0xD800 <= n && n <= 0xDFFF));
        B.codePoint = (B.valid ? n : 0xFFFD);
    }
}


export const htmlEntity_traits: InlineElementTraits<"htmlEntity"> = {
    startChars: [ '&' ],

    parse(It) {
        const entity = It.regexInPart(rex); // advances content iterator if positive match
        if(!entity)
            return false;
        processHTML_entity(entity as RegExpMatchArray, this.B);
        return this.B;
    },
    
    creator(MDP) { return new InlineParser_Standard<"htmlEntity">(MDP, this); },

    defaultElementInstance: {
        type:      "htmlEntity",
        code:      '',
        codePoint: undefined,
        valid:     false
    }
};



export function parseHTML_entities(s: string, buf: AnyInline[]) {
    let checkpoint = 0;
    for(let i = 0, iN = s.length;  i < iN;  ++i) {
        const c = s[i];
        if(c !== '&')
            continue;
        const entity = rex.exec(s.slice(i));
        if(!entity)
            continue;
        if(i !== checkpoint)
            buf.push(s.slice(checkpoint, i));
        const B = { ... htmlEntity_traits.defaultElementInstance };
        processHTML_entity(entity, B);
        buf.push(B);
        i += entity[0].length - 1;
        checkpoint = i + 1;
    }
    if(checkpoint !== s.length)
        buf.push(s.slice(checkpoint));
}
