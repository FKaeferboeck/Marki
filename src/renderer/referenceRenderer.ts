import { Block, BlockBase, LogicalLineData } from "../markdown-types";


function renderBlockContent(B: Block) {
    const C = B.contents as LogicalLineData[];
    return C.map(LLD => LLD.startPart).join('\n');
    //return `[${B.logical_line_start},${B.logical_line_start + B.logical_line_extent})`;
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
        return `<pre><code>${renderBlockContent(B)}\n</code></pre>`
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
