import { lineContent } from "../linify.js";
import { AnyBlock, Block } from "../markdown-types.js";
import { renderInline } from "./inline-renderer.js";
import { EasyInserter, Inserter, MarkdownRendererInstance, MarkdownRendererTraits } from "./renderer.js";
import { escapeXML, escapeXML_all, urlEncode, renderHTML_entity, actualizeLinkURL } from "./util.js";
import { getInlineRenderer_plain } from "./utility-renderers.js";
import { startSnippet } from "../util.js";


export function posInList(B: Block<"listItem">) {
    if(!B.parentList || B.parentList.contents.length === 0)
        throw new Error(`List item in line ${B.lineIdx} ("${startSnippet(lineContent(B.content))}"): not assigned to a parent list`);
    const C = B.parentList.contents;
    return { isFirst: B === C[0],
             isLast:  B === C[C.length - 1] };
}


export function emphasisTag(direction: "open" | "close", weight: number) {
    const tags = ['?', 'em', 'strong'];
    return `<${direction === "close" ? '/' : ''}${tags[weight]}>`;
}

const emph_renderer = (I: Inserter, direction: "open" | "close", _type: string, weight: number) => I.add(emphasisTag(direction, weight));


function quickRow(R: MarkdownRendererInstance, I: Inserter, prefix: string, B: AnyBlock, mode: "literal" | "tightListItem" | "blockquote" | "trimmed" | undefined, suffix: string) {
    const I1 = new EasyInserter();
    return I.appendInserter(R.renderBlockContent(B, I1.add(prefix), mode).add(suffix));
}


export const markdownRendererTraits_standard: MarkdownRendererTraits = {
    blockHandler: {
        "thematicBreak" :       (_, I) => I.add(`<hr />`),
        "paragraph":            function (B, I) { quickRow(this, I, `<p>`, B, "trimmed", `</p>`); },
        "indentedCodeBlock":    function (B, I) { quickRow(this, I, `<pre><code>`, B, "literal", `</code></pre>`); },
        "fenced":               function (B, I) {
            if(B.language && this.customLanguageRenderer[B.language]) {
                const LR = this.customLanguageRenderer[B.language];
                if(LR.useCustomEnvironment)
                    LR.render(B, I);
                else {
                    I.add(`<pre>${this.fencedOpener(B)}`);
                    I.suppressNextSep();
                    LR.render(B, I);
                    I.suppressNextSep();
                    I.add(`</code></pre>`);
                }
            }
            else
                quickRow(this, I, `<pre>${this.fencedOpener(B)}`, B, "literal", `</code></pre>`);
        },
        "blockQuote":           function (B, I) {
            I.add(`<blockquote>`);
            this.renderBlockContent(B, I, "blockquote");
            I.add(`</blockquote>`);
        },
        "sectionHeader_setext": function (B, I) { quickRow(this, I, `<h${B.level}>`, B, undefined, `</h${B.level}>`); },
        "sectionHeader":        function (B, I) { quickRow(this, I, `<h${B.level}>`, B, undefined, `</h${B.level}>`); },
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
                quickRow(this, I, `<li>`, B, "tightListItem", `</li>`);

            // render end of list
            if(pos.isLast)
                I.add(`</${L.listType === "Ordered" ? 'ol' : 'ul'}>`);
        },
        "emptySpace": () => { },
        "linkDef":    () => { },
        "htmlBlock":  function (B, I) { this.renderBlockContent(B, I, "literal"); }
    },

    elementHandlers: {
        "escaped":    (elt, I) => { I.add(escapeXML(elt.character)); },
        "codeSpan":   (elt, I) => { I.add(`<code>${escapeXML(elt.content)}</code>`); },
        "link":       function(elt, I) {
            const elt1 = (elt.reference || elt);
            const title = elt1.linkTitle;
            const title_s = (title && title.length > 0 ? escapeXML_all(title) : undefined);
            const url = actualizeLinkURL(urlEncode(elt1.destination), elt1);
            this.render(elt.linkLabelContents, I.add(`<a href="${url}"${title_s ? ` title="${title_s}"` : ''}>`)).add('</a>');
        },
        "hardBreak":  (elt, I) => { I.add(elt.nSpaces === 1 ? '\n' : '<br />\n'); },
        "htmlEntity": (elt, I) => { I.add(escapeXML(renderHTML_entity(elt))); },
        "image":      function(elt, I) {
            const elt1 = (elt.reference || elt);
            const dest  = elt.reference?.destination || elt.destination;
            const title = elt.reference?.linkTitle   || elt.linkTitle;
            I.add(`<img src="${actualizeLinkURL(dest.join('+'), elt1)}"`);
            const inlineRenderer_plain = getInlineRenderer_plain(this.ctx);
            I.add(` alt="${renderInline(elt.linkLabelContents, inlineRenderer_plain).join()}"`);
            if(title?.length)
                I.add(` title="${renderInline(title, inlineRenderer_plain).join()}"`);
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
        "rawHTML":   (elt, I) => { I.add(elt.tag); },
        "lineBreak": (elt, I) => { I.add('\n'); }
    },

    delimHandlers: {
        emph_asterisk:   emph_renderer,
        emph_underscore: emph_renderer
    },

    customLanguageRenderer: { }
};
