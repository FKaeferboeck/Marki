import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";
//import entityList from "./htmlEntities.json" with { type: "json" };
const { default: entityList } = await import("../htmlEntities.json", { assert: { type: "json" } });


export const htmlEntity_traits: InlineElementTraits<"htmlEntity"> = {
    startChars: [ '&' ],

    parse(It, pos0) {
        const entity = It.regexInPart(/^&(?:#\d{1,7};|#[xX][\dA-Fa-f]{1,6};|[A-Za-z][A-Za-z\d]{0,32};)/); // 32 is the length of the longest existing HTML entity
        if(!entity)
            return false;
        this.B.code = entity[0].slice(1, -1);
        if(!this.B.code.startsWith('#'))
            this.B.codePoint = (entityList as Record<string, number | number[]>)[this.B.code];
        else {
            const c = this.B.code.charAt(1);
            const n = (c === 'x' || c === 'X' ? Number.parseInt(this.B.code.slice(2), 16)
                                              : +this.B.code.slice(1));
            this.B.valid = !(n === 0 || n === 0x0D || (0x80 <= n && n <= 0x9F) || (0xD800 <= n && n <= 0xDFFF));
            this.B.codePoint = (this.B.valid ? n : 0xFFFD);
        }
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
