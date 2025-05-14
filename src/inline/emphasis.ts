import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";
//import entityList from "./htmlEntities.json" with { type: "json" };
//const { default: entityList } = await import("../htmlEntities.json", { assert: { type: "json" } });


export const emphasis_traits: InlineElementTraits<"emphasis"> = {
    startChars: [ '*', '_' ],

    parse(It, pos0) {
        const delim_char = It.nextChar();
        let delim_size = 1;
        while (It.peekChar() === delim_char) {
            ++delim_size;
            It.nextChar();
        }
        this.B.delimiter     = delim_char as "*" | "_";
        this.B.delimiterSize = delim_size;
        return this.B;
    },
    
    creator(MDP) { return new InlineParser_Standard<"emphasis">(MDP, this); },

    defaultElementInstance: {
        type:          "emphasis",
        delimiter:     "*",
        delimiterSize: 0,
        strong:        false
    }
};
