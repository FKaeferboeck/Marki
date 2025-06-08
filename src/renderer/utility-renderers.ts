import { parseBackslashEscapes } from "../inline-parser.js";
import { AnyInline, Delimiter } from "../markdown-types.js";
import { InlineHandlerList, InlineRenderer } from "./inline-renderer.js";
import { Inserter } from "./renderer.js";
import { escapeXML, escapeXML_all, urlEncode, renderHTML_entity } from "./util.js";



const inlineHandler_plain: InlineHandlerList = {
    "escaped":    (elt, I) => I.add(escapeXML(elt.character)),
    "codeSpan":   (elt, I) => I.add(`<code>${escapeXML(elt.content)}</code>`),
    "link":       (elt, I) => {
        const buf2: AnyInline[] = [];
        parseBackslashEscapes(elt.linkLabel, buf2);
        I.add(... buf2.map(s => (typeof s === "string" ? s : s.type === "escaped" ? s.character : '??')));
    },
    "hardBreak":  (elt, I) => I.add(elt.nSpaces === 1 ? '\n' : '<br />\n'),
    "htmlEntity": (elt, I) => I.add(escapeXML(renderHTML_entity(elt))),
    "image":      function(elt, I) { this.render(elt.linkLabelContents, I); },
    "rawHTML":    (elt, I) => I.add(elt.tag)
};


let inlineRenderer_plain: InlineRenderer | undefined;
export function getInlineRenderer_plain() {
    if (!inlineRenderer_plain) {
        inlineRenderer_plain = new InlineRenderer(inlineHandler_plain);
        inlineRenderer_plain.insertDelimiterTag = function(I: Inserter, type: string, weight: number, closing: boolean) { };
    }
    return inlineRenderer_plain;
};


const inlineHandler_reassemble: InlineHandlerList = {
    "escaped":    (elt, I) => I.add('\\' + elt.character),
    "codeSpan":   (elt, I) => I.add(`<code>${escapeXML(elt.content)}</code>`),
    "link":       (elt, I) => {
        const buf2: AnyInline[] = [];
        parseBackslashEscapes(elt.linkLabel, buf2);
        I.add(... buf2.map(s => (typeof s === "string" ? s : s.type === "escaped" ? s.character : '??')));
    },
    "hardBreak":  (elt, I) => I.add(typeof elt.nSpaces === "number" ? ' '.repeat(elt.nSpaces) + '\n' : '\\\n'),
    "htmlEntity": (elt, I) => I.add(escapeXML(renderHTML_entity(elt))),
    "image":      (elt, I) => { },
    "rawHTML":    (elt, I) => I.add(elt.tag)
};


let inlineRenderer_reassemble: InlineRenderer | undefined;
export function getInlineRenderer_reassemble() {
    if (!inlineRenderer_reassemble) {
        inlineRenderer_reassemble = new InlineRenderer(inlineHandler_reassemble);
        inlineRenderer_reassemble.renderDelimiter = (I: Inserter, delim: Delimiter) => I.add(delim.delim);;
    }
    return inlineRenderer_reassemble;
};
