import { InlineHandler } from "src/renderer/inline-renderer.js";
import { MarkdownParserTraits } from "../markdown-parser.js";
import { Inserter, MarkdownRendererInstance, MarkdownRendererTraits } from "../renderer/renderer.js";
import { Block_Leaf } from "src/markdown-types.js";
import { LogicalLine_with_cmt, shiftCol, lineContent } from "src/linify.js";
import { actualizeTab } from "src/renderer/util.js";


/* The treatment of this extension feature feels a bit careless, but it is careless in the specification as well. */

const filter = (s: string) => s.replace(/<(\/?\s*)(title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)\b/ig, '&lt;$1$2');

const renderRawHTML: InlineHandler<"rawHTML"> = (elt, I) => {
    I.add(filter(elt.tag)); 
}

function renderHTML_block(this: MarkdownRendererInstance, B: Block_Leaf<"htmlBlock">, I: Inserter) {
    const arr: string[] = [];
    for(let LL: LogicalLine_with_cmt | undefined = B.content;  LL;  LL = LL.next) {
        if(LL.type === "comment")
            continue;
        if(LL.prefix)
            arr.push(actualizeTab(LL.prefix, shiftCol(LL)));
        arr.push(lineContent(LL));
        if(LL.next)
            arr.push('\n');
    }
    return I.add(filter(arr.join('')));
}

export function register_gfm_html_filter(MDPT_: MarkdownParserTraits, MDRT?: MarkdownRendererTraits) {
    if(MDRT) {
        MDRT.elementHandlers.rawHTML = renderRawHTML;
        MDRT.blockHandler.htmlBlock = renderHTML_block;
    }
}
