import { parseBackslashEscapes } from "../inline-parser.js";
import { AnyBlock, AnyInline, Block, BlockType, InlineContent, inlineContentCategory, InlineElement, InlineElementType } from "../markdown-types.js";
import { InlineHandlerList, InlineRenderer, renderInline } from "./inline-renderer.js";
import { renderHTML_entity, escapeXML, escapeXML_all, urlEncode } from "./util.js";
import { getInlineRenderer_plain } from "./utility-renderers.js";

export interface Inserter {
    add(... S: string[]): void;
    join(sep: string): string;
}

export class EasyInserter implements Inserter {
    buf: string[] = [];
    add(... S: string[]) { this.buf.push(... S); }
    join(sep: string) { return this.buf.join(sep); }
}

export type BlockHandlerList = Partial<{
    [K in BlockType]: (B: Block<K>, ins: Inserter) => void;
}>;


function fencedOpener(this: Renderer, B: Block<"fenced">) {
    const info = this.inlineRenderer.render(B.info_string, new EasyInserter());
    const firstWord = /^\S+/.exec(info)?.[0];
    if (!firstWord)
        return `<code>`;
    return `<code class="language-${firstWord}">`;
}

function posInList(B: Block<"listItem">) {
    if(!B.parentList || B.parentList.contents.length === 0)
        throw new Error('Missing list');
    const C = B.parentList.contents;
    return { isFirst: B === C[0],
             isLast:  B === C[C.length - 1] };
}


function delimitedSection(data: InlineContent, i0: number) {
    const elt = data[i0];
    if(!elt || inlineContentCategory(elt) !== "anyI")
        return false;
    const closingDelim = (elt as InlineElement<InlineElementType>).followedDelimiter?.partnerDelim;
    if(!closingDelim)
        return false;
    let i1 = i0, iN = data.length;
    while(++i1 < iN && data[i1] !== closingDelim) ;
    return {
        contents:   data.slice(i0 + 1, i1),
        closingIdx: i1
    };
}


export class Renderer {
    inlineRenderer: InlineRenderer;

    constructor() {
        this.inlineRenderer = new InlineRenderer(this.inlineHandler);
    }

    referenceRender(content: AnyBlock[], verbose?: boolean, appendSpace: boolean = true) {
        const I = new EasyInserter();
        for(const B of content)
            this.renderBlock(B, I);
        if(verbose)
            console.log('rendered blocks:', I);
        const S_joined = I.join('\n');
        return (S_joined && appendSpace ? S_joined + '\n' : S_joined);
    }

    blockHandler: BlockHandlerList = {
        "thematicBreak" :       (B, I) => I.add(`<hr />`),
        "paragraph":            (B, I) => I.add(`<p>${this.renderBlockContent(B, null, "trimmed")}</p>`),
        "indentedCodeBlock":    (B, I) => I.add(`<pre><code>${this.renderBlockContent(B, null, "literal")}</code></pre>`),
        "fenced":               (B, I) => I.add(`<pre>${this.fencedOpener(B)}${this.renderBlockContent(B, null, "literal")}</code></pre>`),
        "blockQuote":           (B, I) => {
            I.add(`<blockquote>`);
            this.renderBlockContent(B, I, "blockquote");
            I.add(`</blockquote>`);
        },
        "sectionHeader_setext": (B, I) => I.add(`<h${B.level}>${this.renderBlockContent(B, null)}</h${B.level}>`),
        "sectionHeader":        (B, I) => I.add(`<h${B.level}>${this.renderBlockContent(B, null)}</h${B.level}>`),
        "listItem":             (B, I) => {
            const pos = posInList(B);
            const L = B.parentList!;

            // render start of list
            if(pos.isFirst) {
                const B0 = L.contents[0];
                let start = '';
                if(typeof B0.marker_number === "number" && B0.marker_number !== 1)
                    start = ` start="${B0.marker_number}"`;
                I.add(`<${L.listType === "Ordered" ? 'ol' : 'ul'}${start}>`); // start new list (<ul> or <ol>)
            }

            // render <li> element
            if(B.blocks.length === 1 && B.blocks[0].type === "emptySpace")
                I.add(`<li></li>`);
            else if(L.isLoose) {
                I.add(`<li>`);
                for(const B1 of B.blocks)
                    this.renderBlock(B1, I);
                I.add(`</li>`);
            } else
                I.add(`<li>${this.renderBlockContent(B, null, "tightListItem")}</li>`);

            // render end of list
            if(pos.isLast)
                I.add(`</${L.listType === "Ordered" ? 'ol' : 'ul'}>`);
        },
        "emptySpace":      (B, I) => { },
        "linkDef":         (B, I) => { }
    };

    inlineHandler: InlineHandlerList = {
        "escaped":    (elt, I) => I.add(escapeXML(elt.character)),
        "codeSpan":   (elt, I) => I.add(`<code>${escapeXML(elt.content)}</code>`),
        "html":       (elt, I) => I.add(elt.stuff),
        "link":       function(elt, I) {
            const dest  = elt.reference?.destination || elt.destination;
            const title = elt.reference?.linkTitle   || elt.linkTitle;
            const title_s = (title && title.length > 0 ? escapeXML_all(title) : undefined);
            I.add(`<a href="${urlEncode(dest)}"${title_s ? ` title="${title_s}"` : ''}>`);
            /*const buf2: AnyInline[] = [];
            parseBackslashEscapes(elt.linkLabel, buf2);
            I.add(... buf2.map(s => (typeof s === "string" ? s : s.type === "escaped" ? s.character : '??')));*/
            this.render(elt.linkLabelContents, I);
            //I.add(elt.linkLabel);
            I.add('</a>');
        },
        "hardBreak":  (elt, I) => I.add(elt.nSpaces === 1 ? '\n' : '<br />\n'),
        "htmlEntity": (elt, I) => I.add(escapeXML(renderHTML_entity(elt))),
        "image":      function(elt, I) {
            const dest  = elt.reference?.destination || elt.destination;
            const title = elt.reference?.linkTitle   || elt.linkTitle;
            I.add(`<img src="${dest.join('+')}"`);
            const inlineRenderer_plain = getInlineRenderer_plain();
            I.add(` alt="${renderInline(elt.linkLabelContents, inlineRenderer_plain)}"`);
            if(title?.length)
                I.add(` title="${renderInline(title, inlineRenderer_plain)}"`);
            I.add(' />');
        },
        "autolink": (elt, I) => {
            if(elt.email)
                I.add(`<a href="mailto:${elt.email}">${elt.email}</a>`);
            else {
                const URI = escapeXML(elt.URI);
                I.add(`<a href="${elt.scheme}:${urlEncode([URI])}">${elt.scheme}:${URI}</a>`);
            }
        },
        "rawHTML": (elt, I) => I.add(elt.tag)
    };

    renderBlock(B: AnyBlock, I: Inserter) {
        const H = this.blockHandler[B.type];
        if(H)
            (H as any)(B, I);
        else
            I.add('<??>');
    }

    fencedOpener = fencedOpener;
    renderBlockContent(B: AnyBlock, I: Inserter | null, mode?: "literal" | "tightListItem" | "blockquote" | "trimmed"): string {
        if("blocks" in B) {
            const blocks = (B.blocks as AnyBlock[]);
            if(mode === "tightListItem") {
                const I1 = new EasyInserter();
                let type0: BlockType | undefined, type1: BlockType | undefined;
                for(const b of blocks) {
                    if(b.type === "emptySpace")
                        continue;
                    type0 ||= b.type;
                    type1 = b.type;
                    if(b.type === "paragraph")
                        this.renderBlockContent(b, I1);
                    else
                        this.renderBlock(b, I1);
                }
                return (!type0 || type0 === "paragraph" ? '' : '\n') + I1.join('\n') + (!type1 || type1 === "paragraph" ? '' : '\n');
            }
    
            let s = this.referenceRender(blocks, false, false);
            if(mode === "blockquote")
                s = s.trim();
            if(s)
                I?.add(s);
            return s;
        }
    
        let s = '';
        const arr: string[] = [];
        if(mode === "literal") {
            for(let LLD = B.content || null;  LLD;  LLD = LLD.next) {
                LLD.parts.forEach(P => arr.push(P.content as string));
                arr.push('\n');
            }
            s = arr.join('');
        } else if(B.inlineContent) {
            const s1 = this.inlineRenderer.render(B.inlineContent, new EasyInserter(), mode === "trimmed");
            I?.add(s1);
            return s1;
        } else {
            for(let LLD = B.content || null;  LLD;  LLD = LLD.next)
                arr.push(LLD.startPart);
            s = arr.join('\n');
        }
        const s1 = escapeXML(s);
        I?.add(s);
        return s1;
    }
} // class Renderer

