import { Block, BlockBase, LogicalLineData } from "../markdown-types";


function renderBlockContent(B: Block, literal: boolean = false) {
    if("blocks" in B)
        return (B.blocks as Block[]).map(renderBlock).filter(S => S).join('\n');
    const C = B.contents as LogicalLineData[];
    let s = '';
    if(literal)
        s = C.map(LLD => ' '.repeat(LLD.startIndent) + LLD.startPart + '\n').join('');
    else
        s = C.map(LLD => LLD.startPart).join('\n');
    return s.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}


function fencedOpener(B: BlockBase<"fenced">) {
    const firstWord = /^\S+/.exec(B.info_string)?.[0];
    if (!firstWord)
        return `<code>`;
    return `<code class="language-${firstWord}">`;
}


function renderBlock(B: Block): string | undefined {
    switch(B.type) {
    case "thematicBreak":
        return `<hr />`;
    case "emptySpace":
        return undefined;
    case "paragraph":
        return `<p>${renderBlockContent(B)}</p>`;
    case "indentedCodeBlock":
        return `<pre><code>${renderBlockContent(B, true)}</code></pre>`;
    case "fenced":
        return `<pre>${fencedOpener(B as BlockBase<"fenced">)}${renderBlockContent(B, true)}</code></pre>`;
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
    default:
        return `<??>`;
    }
}



export function referenceRender(content: Block[], verbose?: boolean) {
    const S = content.map(renderBlock).filter(s => (typeof s !== "undefined"));
    //S.push('\n');
    if(verbose)
        console.log('rendered blocks:', S);
    return (S.length ? S.join('\n') + '\n' : '');
}
