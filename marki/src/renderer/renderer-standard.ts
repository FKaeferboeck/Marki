import { Block } from "../markdown-types.js";
import { renderInline } from "./inline-renderer.js";
import { Inserter, MarkdownRendererTraits } from "./renderer.js";
import { escapeXML, escapeXML_all, urlEncode, renderHTML_entity } from "./util.js";
import { getInlineRenderer_plain } from "./utility-renderers.js";


function posInList(B: Block<"listItem">) {
    if(!B.parentList || B.parentList.contents.length === 0)
        throw new Error('Missing list');
    const C = B.parentList.contents;
    return { isFirst: B === C[0],
             isLast:  B === C[C.length - 1] };
}


const emph_renderer = (I: Inserter, direction: "open" | "close", _type: string, weight: number) => {
    const tags = ['?', 'em', 'strong'];
    I.add(`<${direction === "close" ? '/' : ''}${tags[weight]}>`);
}


export const markdownRendererTraits_standard: MarkdownRendererTraits = {
    blockHandler: {
        "thematicBreak" :       (_, I) => I.add(`<hr />`),
        "paragraph":            function (B, I) { I.add(`<p>${this.renderBlockContent(B, null, "trimmed")}</p>`); },
        "indentedCodeBlock":    function (B, I) { I.add(`<pre><code>${this.renderBlockContent(B, null, "literal")}</code></pre>`); },
        "fenced":               function (B, I) {
            if(B.language && this.customLanguageRenderer[B.language])
                this.customLanguageRenderer[B.language].render(B, I);
            else
                I.add(`<pre>${this.fencedOpener(B)}${this.renderBlockContent(B, null, "literal")}</code></pre>`);
        },
        "blockQuote":           function (B, I) {
            I.add(`<blockquote>`);
            this.renderBlockContent(B, I, "blockquote");
            I.add(`</blockquote>`);
        },
        "sectionHeader_setext": function (B, I) { I.add(`<h${B.level}>${this.renderBlockContent(B, null)}</h${B.level}>`); },
        "sectionHeader":        function (B, I) { I.add(`<h${B.level}>${this.renderBlockContent(B, null)}</h${B.level}>`); },
        "listItem":             function (B, I) {
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
        "emptySpace": (B, I) => { },
        "linkDef":    (B, I) => { },
        "htmlBlock":  function (B, I) { this.renderBlockContent(B, I, "literal"); }
    },

    elementHandlers: {
        "escaped":    (elt, I) => I.add(escapeXML(elt.character)),
        "codeSpan":   (elt, I) => I.add(`<code>${escapeXML(elt.content)}</code>`),
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
            const inlineRenderer_plain = getInlineRenderer_plain(this.ctx);
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
    },

    delimHandlers: {
        emph_asterisk:   emph_renderer,
        emph_underscore: emph_renderer
    },

    customLanguageRenderer: { }
};
