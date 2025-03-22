import { collectLists } from "../blocks/listItem.js";
import { AnyBlock, BlockBase, BlockType, BlockBase_Container, LogicalLineData, Block, List, InlineElement, InlineElementType, AnyInline } from "../markdown-types.js";


function singleParagraphContent(B: AnyBlock[]) {
    //return (B.length === 0 || B.some((b, i) => b.type !== (i ? "emptySpace" : "paragraph")) ? undefined : B[0]);
    const para = B.find(b => b.type === "paragraph");
    return (para && !B.some(b => !(b === para || b.type === "emptySpace")) ? para : undefined);
}



function renderBlockContent(B: AnyBlock, buf: string[] | null, mode?: "literal" | "tightListItem" | "blockquote") {
    const add = (s: string) => {
        if(!buf)    return s;
        if(s)    buf.push(s);
        return s;
    };

    if("blocks" in B) {
        const blocks = (B.blocks as AnyBlock[]);
        if(mode === "tightListItem") {
            const buf1: string[] = [];
            let type0: BlockType | undefined, type1: BlockType | undefined;
            for(const b of blocks) {
                if(b.type === "emptySpace")
                    continue;
                type0 ||= b.type;
                type1 = b.type;
                if(b.type === "paragraph")
                    renderBlockContent(b, buf1);
                else
                    renderBlock(b, buf1);
            }
            return (!type0 || type0 === "paragraph" ? '' : '\n') + buf1.join('\n') + (!type1 || type1 === "paragraph" ? '' : '\n');
        }

        let s = referenceRender(blocks, false, false);
        if(mode === "blockquote")
            s = s.trim();
        return add(s);
        /*const B_P = singleParagraphContent(blocks);
        //console.log('list content', B1, B_P, B_P ? `Single[${renderBlockContent(B_P)}]` : 'nonSingle')
        if(B_P)
            return renderBlockContent(B_P, buf);
        return add('\n' + referenceRender(blocks, false, true));*/
        //return '\n' + B1.map(renderBlock).filter(S => S).join('\n') + '\n';
    }

    const C = B.contents as LogicalLineData[];
    let s = '';
    if(mode === "literal")
        s = C.map(LLD => ' '.repeat(LLD.startIndent) + LLD.startPart + '\n').join('');
    else
        s = C.map(LLD => LLD.startPart).join('\n');
    return add(s.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
}


function fencedOpener(B: Block<"fenced">) {
    const firstWord = /^\S+/.exec(B.info_string)?.[0];
    if (!firstWord)
        return `<code>`;
    return `<code class="language-${firstWord}">`;
}


function listType(marker: Block<"listItem">["marker"] | undefined) {
    return (marker === "." || marker === ")" ? "ol" : "ul");
}

function listMarker(B: Block<"listItem">) {
    return (B.type === "listItem" ? B.marker : undefined);
}


function posInList(B: Block<"listItem">) {
    if(!B.parentList || B.parentList.contents.length === 0)
        throw new Error('Missing list');
    const C = B.parentList.contents;
    return { isFirst: B === C[0],
             isLast:  B === C[C.length - 1] };
}


function renderBlock(B: AnyBlock, buf: string[]) {
    const add = (s: string) => { buf.push(s); };
    switch(B.type) {
    case "thematicBreak":
        return add(`<hr />`);
    case "paragraph":
        return add(`<p>${renderBlockContent(B, null).trim()}</p>`);
    case "indentedCodeBlock":
        return add(`<pre><code>${renderBlockContent(B, null, "literal")}</code></pre>`);
    case "fenced":
        return add(`<pre>${fencedOpener(B)}${renderBlockContent(B, null, "literal")}</code></pre>`);
    case "blockQuote":
        add(`<blockquote>`);
        renderBlockContent(B, buf, "blockquote");
        add(`</blockquote>`);
        return;
    case "sectionHeader_setext":
        return add(`<h${B.level}>${renderBlockContent(B, null)}</h${B.level}>`);
    case "sectionHeader":
        return add(`<h${B.level}>${renderBlockContent(B, null)}</h${B.level}>`);
    case "listItem":
        {
            const pos = posInList(B);
            const L = B.parentList!;

            // render start of list
            if(pos.isFirst) {
                const B0 = L.contents[0];
                let start = '';
                if(typeof B0.marker_number === "number" && B0.marker_number !== 1)
                    start = ` start="${B0.marker_number}"`;
                buf.push(`<${L.listType === "Ordered" ? 'ol' : 'ul'}${start}>`); // start new list (<ul> or <ol>)
            }

            // render <li> element
            if(B.blocks.length === 1 && B.blocks[0].type === "emptySpace")
                buf.push(`<li></li>`);
            else if(L.isLoose) {
                buf.push(`<li>`);
                for(const B1 of B.blocks)
                    renderBlock(B1, buf);
                buf.push(`</li>`);
            } else
                buf.push(`<li>${renderBlockContent(B, null, "tightListItem")}</li>`);

            // render end of list
            if(pos.isLast)
                buf.push(`</${L.listType === "Ordered" ? 'ol' : 'ul'}>`);
        }
        return;
    case "emptySpace":
        return;
    default:
        return add(`<??>`);
    }
}


export function referenceRender(content: AnyBlock[], verbose?: boolean, appendSpace: boolean = true) {
    const S: string[] = [];
    
    for(const B of content)
        renderBlock(B, S);

    if(verbose)
        console.log('rendered blocks:', S);
    const S_joined = S.join('\n');
    return (S_joined && appendSpace ? S_joined + '\n' : S_joined);
}



/**********************************************************************************************************************/

export function referenceRenderInline(data: (string | AnyInline)[]) {
    const buf: string[] = [];
    for(const elt of data) {
        if(typeof elt === "string") {
            buf.push(escapeXML(elt));
            continue;
        }
        switch(elt.type) {
        case "codeSpan":
            buf.push(`<code>${escapeXML(elt.content)}</code>`);
            break;
        case "html":
            buf.push(elt.stuff);
            break;
        }
    }
    return `<p>${buf.join('')}</p>\n`;
}


const replacements: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
};
const escapeXML = (s: string) => s.replaceAll(/[<>&"]/g, x => replacements[x]);
