import { PositionOps } from "../position-ops.js";
import { InlineParser_Standard } from "../inline-parser.js";
import { AnyInline, InlineElement } from "../markdown-types.js";
import { InlineElementTraits } from "../traits.js";

/* There seem to be infinite problems with JSON import, and with dual-mode compiles it's totally impossible. So we unfortunately must fall back to unchecked oldschool file import. */
//import entityList from "../htmlEntities.json" assert { type: "json" };
//const { default: entityList } = await import("../htmlEntities.json", { with: { type: "json" }, assert: { type: "json" } });
import * as fs from 'fs';
import * as path from "path";
const jsonFile = path.resolve(__dirname, '../htmlEntities.json');
const entityList = JSON.parse(fs.readFileSync(jsonFile, 'utf8')) as Record<string, number | number[]>;


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

    parse(It, B) {
        const entity = It.regexInLine(rex); // advances content iterator if positive match
        if(!entity)
            return false;
        processHTML_entity(entity as RegExpMatchArray, B);
        return true;
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
        const entity_length = entity[0].length;
        if(i !== checkpoint)
            buf.push(s.slice(checkpoint, i));
        const endPos = PositionOps.endPos(buf);
        endPos.character += entity_length;
        const B = { ... htmlEntity_traits.defaultElementInstance,  endPos };
        processHTML_entity(entity, B);
        buf.push(B);
        i += entity_length - 1;
        checkpoint = i + 1;
    }
    if(checkpoint !== s.length)
        buf.push(s.slice(checkpoint));
}
