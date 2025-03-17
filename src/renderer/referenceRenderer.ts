import { Block, BlockBase, ContainerBlockBase, LogicalLineData } from "../markdown-types.js";


function singleParagraphContent(B: Block[]) {
    //return (B.length === 0 || B.some((b, i) => b.type !== (i ? "emptySpace" : "paragraph")) ? undefined : B[0]);
    const para = B.find(b => b.type === "paragraph");
    return (para && !B.some(b => !(b === para || b.type === "emptySpace")) ? para : undefined);
}


function renderBlockContent(B: Block, mode?: "literal" | "inlist") {
    if("blocks" in B) {
        const B1 = (B.blocks as Block[]);
        if(mode !== "inlist")
            return referenceRender(B1, false, false);
            //return B1.map(renderBlock).filter(S => S).join('\n');
        const B_P = singleParagraphContent(B1);
        //console.log('list content', B1, B_P, B_P ? `Single[${renderBlockContent(B_P)}]` : 'nonSingle')
        if(B_P)
            return renderBlockContent(B_P);
        return '\n' + referenceRender(B1, false, true);
        //return '\n' + B1.map(renderBlock).filter(S => S).join('\n') + '\n';
    }
    const C = B.contents as LogicalLineData[];
    let s = '';
    if(mode === "literal")
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


function listType(marker: BlockBase<"listItem">["marker"] | undefined) {
    return (marker === "." || marker === ")" ? "ol" : "ul");
}

function listMarker(B: Block) {
    const B1 = B as BlockBase<"listItem">;
    return (B.type === "listItem" ? B1.marker : undefined);
}


function renderBlock(B: Block, buf: string[]) {
    const add = (s: string) => { buf.push(s); };
    switch(B.type) {
    case "thematicBreak":
        return add(`<hr />`);
    case "paragraph":
        return add(`<p>${renderBlockContent(B)}</p>`);
    case "indentedCodeBlock":
        return add(`<pre><code>${renderBlockContent(B, "literal")}</code></pre>`);
    case "fenced":
        return add(`<pre>${fencedOpener(B as BlockBase<"fenced">)}${renderBlockContent(B, "literal")}</code></pre>`);
    case "blockQuote":
        add(`<blockquote>`);
        add(renderBlockContent(B));
        add(`</blockquote>`);
        return;
    case "sectionHeader_setext":
        {
            const L = (B as BlockBase<"sectionHeader_setext">).level;
            return add(`<h${L}>${renderBlockContent(B)}</h${L}>`);
        }
    case "sectionHeader":
        {
            const L = (B as BlockBase<"sectionHeader">).level;
            return add(`<h${L}>${renderBlockContent(B)}</h${L}>`);
        }
    case "listItem":
        add(`<li>`);
        add(renderBlockContent(B));
        add(`</li>`);
    case "emptySpace":
        return;
    default:
        return add(`<??>`);
    }
}


interface List {
    marker: BlockBase<"listItem">["marker"];
    loose:  boolean;
    items:  ContainerBlockBase<"listItem">[];
}


function renderList(L: List, buf: string[]) {
    //console.log('Rendering list', L)
    const B0 = L.items[0];
    let start = '';
    if(typeof B0.marker_number === "number" && B0.marker_number !== 1)
        start = ` start="${B0.marker_number}"`;
    buf.push(`<${listType(L.marker)}${start}>`); // start new
    for(const B of L.items) {
        if(B.blocks.length === 1 && B.blocks[0].type === "emptySpace")
            buf.push(`<li></li>`);
        else if(L.loose)
            renderBlock(B, buf);
        else
            buf.push(`<li>${renderBlockContent(B, "inlist")}</li>`);
    }
    buf.push(`</${listType(L.marker)}>`);
}


function renderBlocks(Bs: Block[], buf: string[]) {
    for(let i = 0, iN = Bs.length;  i < iN;  ++i) {
        const B = Bs[i];
        if(B.type === "emptySpace")
            continue;

        const marker = listMarker(B);
        if(marker) {
            // it is a list block -> we need to find out if it is loose or tight before we can render it
            const L: List = { marker,  loose: false,  items: [ B as ContainerBlockBase<"listItem"> ] };
            let space = false;
            for(let i1 = i + 1;  i1 < iN;  ++i1) {
                const B1 = Bs[i1];
                if(B1.type === "emptySpace") {
                    space = true;
                } else if(listMarker(B1) === marker) {
                    L.loose ||= space || (B1 as ContainerBlockBase<"listItem">).isLooseItem;
                    space = false;
                    L.items.push(B1 as ContainerBlockBase<"listItem">);
                    i = i1;
                } else
                    break; // end of list
            }
            renderList(L, buf);
            continue;
        }

        renderBlock(B, buf);
    }
}


export function referenceRender(content: Block[], verbose?: boolean, appendSpace: boolean = true) {
    const S: string[] = [];
    renderBlocks(content, S);

    if(verbose)
        console.log('rendered blocks:', S);
    const S_joined = S.join('\n');
    return (S_joined && appendSpace ? S_joined + '\n' : S_joined);
}
