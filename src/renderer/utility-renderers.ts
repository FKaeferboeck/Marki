import { parseBackslashEscapes } from "../inline-parser.js";
import { AnyInline } from "../markdown-types.js";
import { InlineHandlerList, InlineRenderer } from "./inline-renderer.js";
import { Inserter } from "./renderer.js";
import { escapeXML, escapeXML_all, urlEncode, renderHTML_entity } from "./util.js";



const inlineHandler_plain: InlineHandlerList = {
    "escaped":    (elt, I) => I.add(escapeXML(elt.character)),
    "codeSpan":   (elt, I) => I.add(`<code>${escapeXML(elt.content)}</code>`),
    "html":       (elt, I) => I.add(elt.stuff),
    "link":       (elt, I) => {
        const buf2: AnyInline[] = [];
        parseBackslashEscapes(elt.linkLabel, buf2);
        I.add(... buf2.map(s => (typeof s === "string" ? s : s.type === "escaped" ? s.character : '??')));
    },
    "hardBreak":  (elt, I) => I.add(elt.nSpaces === 1 ? '\n' : '<br />\n'),
    "htmlEntity": (elt, I) => I.add(escapeXML(renderHTML_entity(elt))),
    "image":      () => {}
};


export const inlineRenderer_plain = new InlineRenderer(inlineHandler_plain);
inlineRenderer_plain.insertDelimiterTag = function(I: Inserter, type: string, weight: number, closing: boolean) { };
