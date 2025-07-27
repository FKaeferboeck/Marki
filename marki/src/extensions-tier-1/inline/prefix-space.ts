import { ExtensionInlineElementType, InlineElement } from "../../markdown-types.js";
import { InlineElementTraits } from "../../traits.js";

export const name_linePrefixSpace = "ext_tier1_prefix_space" as ExtensionInlineElementType;

export type LinePrefixSpace = {
    content: string;
}

export const ext_tier1_prefix_space_traits: InlineElementTraits<typeof name_linePrefixSpace, LinePrefixSpace & InlineElement<typeof name_linePrefixSpace>> = {
    startChars: [ '\n' ],

    parse(It, B) {
        const pfx = It.getPrefixSpace();
        if(!pfx)
            return false;
        It.pop();
        B.content = pfx;
        return true;
    },

    defaultElementInstance: {
        type:    name_linePrefixSpace,
        content: ''
    }
};
