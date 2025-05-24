import { parseBackslashEscapes } from "../inline-parser.js";
import { AnyBlock, AnyInline, Block, BlockType, Delimiter, InlineContent, inlineContentCategory, InlineElement, InlineElementType } from "../markdown-types.js";
import { renderHTML_entity, escapeXML, escapeXML_all, urlEncode } from "./util.js";

interface Inserter {
    add(... S: string[]): void;
    join(sep: string): string;
}

class EasyInserter implements Inserter {
    buf: string[] = [];
    add(... S: string[]) { this.buf.push(... S); }
    join(sep: string) { return this.buf.join(sep); }
}

export type BlockHandlerList = Partial<{
    [K in BlockType]: (B: Block<K>, ins: Inserter) => void;
}>;

export type InlineHandlerList = Partial<{
    [K in InlineElementType]: (B: InlineElement<K>, ins: Inserter) => void;
}>;


function fencedOpener(this: Renderer, B: Block<"fenced">) {
    const info = this.renderInline(B.info_string, null)
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



export class Renderer {

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
        "link":       (elt, I) => {
            //console.log(elt.reference)
            const dst   = elt.reference?.destination || elt.destination;
            const title = elt.reference?.linkTitle   || elt.linkTitle;
            const title_s = (title && title.length > 0 ? escapeXML_all(title) : undefined);
            I.add(`<a href="${urlEncode(dst)}"${title_s ? ` title="${title_s}"` : ''}>`);
            //referenceRenderInline(elt.linkLabel, buf);
            //console.log(`{${elt.linkLabel}}`);
            const buf2: AnyInline[] = [];
            parseBackslashEscapes(elt.linkLabel, buf2);
            I.add(... buf2.map(s => (typeof s === "string" ? s : s.type === "escaped" ? s.character : '??')));
            //I.add(elt.linkLabel);
            I.add('</a>');
        },
        "hardBreak":  (elt, I) => I.add('<br />\n'),
        "htmlEntity": (elt, I) => I.add(escapeXML(renderHTML_entity(elt)))
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
            const s1 = this.renderInline(B.inlineContent, null, mode === "trimmed");
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

    renderInline(data: InlineContent, I: Inserter | null, trimmed?: boolean) {
        if(!I)
            I = new EasyInserter();
        let i = -1, iE = data.length - 1;
        for(const elt of data) {
            ++i;
            switch(inlineContentCategory(elt))
            {
            case "text":
                let s = escapeXML(elt as string);
                if(trimmed && i === 0)
                    s = s.replace(/^[ \t]+/, '');
                if(trimmed && i === iE)
                    s = s.replace(/[ \t]+$/, '');
                I.add(s);
                continue;
            case "delim":
                this.renderDelimiter(I, elt as Delimiter)
                break;
            case "anyI":
                const H = this.inlineHandler[(elt as InlineElement<InlineElementType>).type];
                if(H)
                    (H as any)(elt, I);
                break;
            }
        }
        return I.join('');
    }

    renderDelimiter(I: Inserter, delim: Delimiter) {
        if("endDelim" in delim)
            return; // TODO!!
        if(delim.closing?.actualized)
            delim.closing.actualized.forEach(x => this.insertDelimiterTag(I, delim.type, x, true));
        if(delim.remaining > 0)
            I.add(delim.delim.slice(0, delim.remaining));
        if(delim.opening?.actualized)
            delim.opening.actualized.forEach(x => this.insertDelimiterTag(I, delim.type, x, false));
    }

    insertDelimiterTag(I: Inserter, type: string, weight: number, closing: boolean) {
        const tags = ['?', 'em', 'strong'];
        I.add(`<${closing ? '/' : ''}${tags[weight]}>`);
    }
}

