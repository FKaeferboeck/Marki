import { InlineParser_Standard } from "../inline-parser.js";
import { InlineElementTraits } from "../traits.js";
//import entityList from "./htmlEntities.json" with { type: "json" };
//const { default: entityList } = await import("../htmlEntities.json", { assert: { type: "json" } });


export const emphasis_traits: InlineElementTraits<"emphasis"> = {
    startChars: [ '*', '_' ],

    parse(It, pos0) {
        

        return false;
    },
    
    creator(MDP) { return new InlineParser_Standard<"emphasis">(MDP, this); },

    defaultElementInstance: {
        type:      "emphasis",
        delimiter: "*",
        strong:    false
    }
};
