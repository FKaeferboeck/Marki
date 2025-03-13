import { Block, BlockBase, LogicalLineData } from "../markdown-types";


function renderBlockContent(B: Block, literal: boolean = false) {
    if("blocks" in B)
        return (B.blocks as Block[]).map(renderBlock).join('\n');
    const C = B.contents as LogicalLineData[];
    if(literal)
        return C.map(LLD => ' '.repeat(LLD.startIndent) + LLD.startPart).join('\n');
    else
        return C.map(LLD => LLD.startPart).join('\n');
}


function renderBlock(B: Block) {
    switch(B.type) {
    case "thematicBreak":
        return `<hr />`;
    case "emptySpace":
        return undefined;
    case "paragraph":
        return `<p>${renderBlockContent(B)}</p>`;
    case "indentedCodeBlock":
        return `<pre><code>${renderBlockContent(B, true)}\n</code></pre>`;
    case "blockQuote":
        return `<blockquote>\n${renderBlockContent(B)}\n</blockquote>`
    case "sectionHeader_setext":
        {
            const L = (B as BlockBase<"sectionHeader_setext">).level;
            return `<h${L}>${renderBlockContent(B)}</h${L}>`;
        }
    case "sectionHeader":
        {
            const L = (B as BlockBase<"sectionHeader">).level;
            return `<h${L}>${renderBlockContent(B)}</h${L}>`;
        }
    }
}



export function referenceRender(content: Block[]) {
    const S = content.map(renderBlock).filter(s => (typeof s !== "undefined"));
    S.push('\n');
    return S.join('\n');
}
