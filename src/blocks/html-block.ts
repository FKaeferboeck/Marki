import { BlockTraits } from "../traits.js";
import { isSpaceLine, lineContent, standardBlockStart } from "../linify.js";


export interface HTML_block {
	htmlType:   "preEtAl" | "comment" | "processingInstruction" | "definition" | "CDATA" | "knownElement" | "anyTag";
    singleLine: boolean;
}

const case6elements: Record<string, boolean> = {
    address: true,  article:  true,  aside:    true,  true:     true,  base:       true,  basefont: true,  blockquote: true,  body:   true,
    caption: true,  center:   true,  col:      true,  colgroup: true,  dd:         true,  details:  true,  dialog:     true,  dir:    true,
    div:     true,  dl:       true,  dt:       true,  fieldset: true,  figcaption: true,  figure:   true,  footer:     true,  form:   true,
    frame:   true,  frameset: true,  h1:       true,  h2:       true,  h3:         true,  h4:       true,  h5:         true,  h6:     true,
    head:    true,  header:   true,  hr:       true,  html:     true,  iframe:     true,  legend:   true,  li:         true,  link:   true,
    main:    true,  menu:     true,  menuitem: true,  nav:      true,  noframes:   true,  ol:       true,  optgroup:   true,  option: true,
    p:       true,  param:    true,  search:   true,  section:  true,  summary:    true,  table:    true,  tbody:      true,  td:     true,
    tfoot:   true,  th:       true,  thead:    true,  title:    true,  tr:         true,  track:    true,  ul:         true
};

const singleLineOpeningTag = /^<([A-Za-z][A-Za-z\d\-]*)(?:[ \t]+[A-Za-z_:][A-Za-z\d_:\.\-]*[ \t]*=[ \t]*(?:"[^"]*"|'[^']*'))*[ \t]*\/?>[ \t]*$/;
const singleLineClosingTag = /^<\/([A-Za-z][A-Za-z\d\-]*)[ \t]*>[ \t]*$/;


export const htmlBlock_traits: BlockTraits<"htmlBlock"> = {
    startsHere(LL, B, interrupting) {
        if(!standardBlockStart(LL))
            return -1;

        // Start condition: line begins with the string <pre, <script, <style, or <textarea (case-insensitive), followed by a space, a tab, the string >, or the end of the line.
        if(/^<(pre|script|style|textarea)(?=[\s\t>]|$)/i.test(LL.content)) {
            B.htmlType   = "preEtAl";
            B.singleLine = (this.traits.continuesHere!.call(this, LL) === "last");
            return 0;
        }

        if(/^<!--/.test(LL.content)) {
            B.htmlType   = "comment";
            B.singleLine = (this.traits.continuesHere!.call(this, LL) === "last");
            return 0;
        }

        if(/^<\?/.test(LL.content)) {
            B.htmlType   = "processingInstruction";
            B.singleLine = (this.traits.continuesHere!.call(this, LL) === "last");
            return 0;
        }

        if(/^<![A-Za-z]/.test(LL.content)) {
            B.htmlType   = "definition";
            B.singleLine = (this.traits.continuesHere!.call(this, LL) === "last");
            return 0;
        }

        if(/^<!\[CDATA\[/.test(LL.content)) {
            B.htmlType   = "CDATA";
            B.singleLine = (this.traits.continuesHere!.call(this, LL) === "last");
            return 0;
        }

        let rexres: RegExpMatchArray | null = null;
        if((rexres = /<\/?([A-Za-z]+)(?=[ \t>]|\/>|$)/.exec(LL.content)) && case6elements[rexres[1].toLowerCase()]) {
            B.htmlType = "knownElement";
            return 0;
        }

        // Case 7 is a bit more complex
        if(interrupting)
            return -1;
        if(singleLineOpeningTag.test(LL.content) || singleLineClosingTag.test(LL.content)) {
            // Tag name cannot be pre, script, style, or textarea; but we need not check because if it is one of those we would have fallen into case (1) earlier.
            B.htmlType = "anyTag";
            return 0;
        }

        return -1;
    },

    continuesHere(LL) {
        if(this.B.singleLine)
            return "end";
        const content = lineContent(LL);

        switch(this.B.htmlType) {
        case "preEtAl":
            return (/<\/(?:pre|script|style|textarea)>/i.test(content) ? "last" : 0);
        case "comment":
            return (/-->/.test(content) ? "last" : 0);
        case "processingInstruction":
            return (/\?>/.test(content) ? "last" : 0);
        case "definition":
            return (/>/.test(content) ? "last" : 0);
        case "CDATA":
            return (/\]\]>/.test(content) ? "last" : 0);
        case "knownElement":
        case "anyTag":
            return (isSpaceLine(LL) ? "end" : 0);
        default:
            throw new Error(`Invalid value for HTML_block.htmlType: "${this.B.htmlType}"`);
        }
    },

    allowSoftContinuations: false,
    allowCommentLines: true,
    inlineProcessing: false,
    lastIsContent: true,

    defaultBlockInstance: {
        htmlType: "anyTag",
        singleLine: false
    }
};
