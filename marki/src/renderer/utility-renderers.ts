import { parseBackslashEscapes } from "../inline-parser.js";
import { AnyInline } from "../markdown-types.js";
import { InlineRenderer, InlineRenderHandler } from "./inline-renderer.js";
import { escapeXML, renderHTML_entity } from "./util.js";

export const inlineHandler_plain: InlineRenderHandler = {
    inlineRendererType: "plain",
    elementHandlers: {
        "escaped":    (elt, I) => { I.add(escapeXML(elt.character)); },
        "codeSpan":   (elt, I) => { I.add(`<code>${escapeXML(elt.content)}</code>`); },
        "link":       (elt, I) => {
            const buf2: AnyInline[] = [];
            parseBackslashEscapes(elt.linkLabel, buf2);
            for(const s of buf2)
                I.add(typeof s === "string" ? s : s.type === "escaped" ? s.character : '??');
        },
        "hardBreak":  (elt, I) => { I.add(elt.nSpaces === 1 ? '\n' : '<br />\n'); },
        "htmlEntity": (elt, I) => { I.add(escapeXML(renderHTML_entity(elt))); },
        "image":      function(elt, I) { this.render(elt.linkLabelContents, I); },
        "rawHTML":    (elt, I) => { I.add(elt.tag); },
        "lineBreak":  (elt, I) => { I.add('\n'); }
    },
    delimHandlers: { '*': () => {} }
};

export const getInlineRenderer_plain = (R: InlineRenderer) => R.parent.inlineRenderers.plain;
