import { InlinePos, LogicalLineData } from "./markdown-types.js";
import { LinePart, LineStructure, LogicalLineType } from "./parser.js";



function measureIndent(s: string, i0: number = 0) {
    let n = 0;
    for (let i = i0, iN = s.length;  i < iN;  i++)
        switch(s[i]) {
        case ' ':     ++n;       break;
        case '\t':    n += 4;    break;
        default:      return n;
        }
    return n;
}


export function lineTypeLP(L: LinePart[]): LogicalLineType {
    if(L.length === 0)    return "empty";
    if(L.length === 1) {
        const P = L[0];
        if(P.type === "XML_Comment")    return "comment";
        if(P.content.length === 0)    return "empty";
        if(P.content.trimEnd().length === 0)    return "emptyish";
        return "single";
    }
    // now there are multiple parts, which means that at least some of them are comments -> can only be all comment or mixed content
    return (L.some(P => P.type !== "XML_Comment" && P.content.trimEnd().length !== 0) ? "text" : "comment");
}



export function sliceLLD(LLD: LogicalLineData, begin: number): LogicalLineData {
    const p0 = (' '.repeat(LLD.startIndent) + LLD.startPart).slice(begin);
    const parts = [ ... LLD.parts ];
    if(p0.length > 0)
        parts[0].content = p0;
    else
        parts.splice(0, 1);

    const LLD_c: LogicalLineData = {
        logl_idx:    LLD.logl_idx,
        parts:       parts,
        startPart:   p0.trimStart(),
        startIndent: measureIndent(p0),
        type:        lineTypeLP(parts),
        next:        null
    };
    LLD.contentSlice = LLD_c;
    if(LLD.isSoftContainerContinuation)
        LLD_c.isSoftContainerContinuation = true;
    return LLD_c;
}



function lineData(LS: LineStructure, logl_idx: number): LogicalLineData {
    const LL = LS.logical_lines[logl_idx];
    const P  = LS.all[LL.start];
    const p0 = (P.type === "TextPart" ? P.content : '');
    return {
        logl_idx:    logl_idx,
        parts:       LS.all.slice(LL.start, LL.start + LL.extent),
        startPart:   p0.trimStart(),
        startIndent: measureIndent(p0),
        type:        (LL.type === "text" ? "single" : LL.type),
        next:        null
    };
}

export function lineDataAll(LS: LineStructure, logl_idx_start: number): LogicalLineData {
    let lld = lineData(LS, logl_idx_start);
    const lld0 = lld;
    while(++logl_idx_start < LS.logical_lines.length)
        lld = (lld.next = lineData(LS, logl_idx_start));
    return lld0;
}



const standardBlockLineTypes: Partial<Record<LogicalLineType | "single", boolean>> = { single: true,  text: true };
export const standardBlockStart = (LLD: LogicalLineData) => (!!standardBlockLineTypes[LLD.type] && LLD.startIndent < 4);


export function LLDinfo(LLD: LogicalLineData | null | undefined) {
    if(!LLD)
        return '[EOF]';
    return `[${LLD.logl_idx}:${LLD.startIndent ? `(${LLD.startIndent})+` : ''}${LLD.startPart}${LLD.isSoftContainerContinuation ? '\\SCC' : ''}]`;
}



/**********************************************************************************************************************/

export const makeInlinePos = (LLD: LogicalLineData): InlinePos => ({
    LLD,
    part_idx: 0,
    char_idx: 0
});


export interface InlineParsingConfig {
    ignoreStartIndents: boolean;
    html_as_literal:    boolean;
    report_line_breaks: boolean;
}


export function contentSlice(p0: InlinePos, p1: InlinePos, includeComments: boolean, line_break_char = '\n') {
    const buf: string[] = [];
    let LLD = p0.LLD;

    if(p0.part_idx >= LLD.parts.length) { // starting at an end-of-line (or perhaps EOF) character
        if(!LLD.next)
            return ''; // p0 is EOF
        p0 = { LLD: LLD.next,  part_idx: 0,  char_idx: 0 };
        buf.push(line_break_char);
    }

    let R0 = p0.LLD.parts[p0.part_idx], R1 = p1.LLD.parts[p1.part_idx];
    if(R0 === R1) {
        buf.push(R0.content.slice(p0.char_idx, p1.char_idx));
        return buf.join('');
    }

    buf.push(R0.content.slice(p0.char_idx));
    
    const fct = (i: number, iE: number) => {
        for(;  i < iE;  ++i) {
            const R = LLD.parts[i];
            if(R.type !== "XML_Comment" || includeComments)
                buf.push(R.content);
        }
    };

    if(p0.LLD === p1.LLD) // everything contained in one line
        fct(p0.part_idx + 1, p1.part_idx);
    else { // content spanning multiple lines
        fct(p0.part_idx + 1, LLD.parts.length);
        buf.push(line_break_char);
        while((LLD = LLD.next!) !== p1.LLD) { // complete lines between start and end
            fct(0, LLD.parts.length);
            buf.push(line_break_char);
        }
        fct(0, p1.part_idx);
    }
    if(p1.char_idx > 0)
        buf.push(R1.content.slice(0, p1.char_idx));
    return buf.join('');
}


export interface BlockContentIterator {
    pos: InlinePos;
    checkpoint: InlinePos;
    line_break_char: string;

    peekChar(): string | false;
    peekItem(): string | LinePart | false;

    prevCharInPart(): false | string;
    nextChar(): false | string;
    nextItem(): false | string | LinePart;

    setPosition        (P:  InlinePos): void;
    stepBack           (P?: InlinePos): void;
    setCheckPoint      (P?: InlinePos): void;
    setCheckPointAtPrev(P?: InlinePos): void;
}


const LP_break = { type: "lineBreak" as const,  content: [ ' ' ] };
const LP_EOF   = { type: "EOF" as const,        content: [ false as const ] };

export function makeBlockContentIterator(LLD: LogicalLineData): BlockContentIterator {
    const pos        = makeInlinePos(LLD);
    let   checkpoint = makeInlinePos(LLD);
    let curLine = LLD;
    let curPart: LinePart | typeof LP_break | typeof LP_EOF = curLine.parts[0];
    let curPartLength = curPart.content.length;

    const nextPart = () => {
        const x = (++pos.part_idx - curLine.parts.length);
        if(x === 0 && curLine.next) { // insert line break character, except after the last line
            curPart = LP_break;
            pos.char_idx = 0;
            curPartLength = 0;
            return;
        }
        if(x >= 0) {
            if(!curLine.next) {
                curPart = LP_EOF;
                /*pos.part_idx = */pos.char_idx = 0;
                return;
            }
            if(curLine = curLine.next)
                pos.LLD = curLine;
            pos.part_idx = 0;
        }
        curPart = curLine.parts[pos.part_idx];
        curPartLength = curPart.content.length;
        pos.char_idx = 0;
    };

    const stepBack = (P?: InlinePos) => {
        P ||= pos;
        if(--P.char_idx >= 0)
            return;
        P.char_idx = (curPart = P.LLD.parts[--P.part_idx]).content.length - 1;
        curPartLength = curPart.content.length;
    };

    return {
        pos,
        checkpoint,
        line_break_char: ' ',

        peekChar: () => curPart.content[pos.char_idx],
        peekItem: () => {
            if((curPart.type === "XML_Comment" || curPart.type === "HTML_Tag") && pos.char_idx === 0)
                return curPart;
            return curPart.content[pos.char_idx];
        },

        prevCharInPart: () => (pos.char_idx > 0 && curPart.content[pos.char_idx - 1]),
        nextChar: () => {
            const s = curPart.content[pos.char_idx];
            if(s && ++pos.char_idx >= curPartLength)
                nextPart();
            return s;
        },

        nextItem: () => {
            if((curPart.type === "XML_Comment" || curPart.type === "HTML_Tag") && pos.char_idx === 0) {
                const s = curPart;
                nextPart();
                return s;
            }
            const s = curPart.content[pos.char_idx];
            if(s && ++pos.char_idx >= curPartLength)
                nextPart();
            return s;
        },

        setPosition: (P: InlinePos) => {
            Object.assign(pos, P);
            curPartLength = (curPart = (curLine = P.LLD).parts[P.part_idx]).content.length;
        },
        stepBack,

        setCheckPoint: (P?: InlinePos) => {
            Object.assign(P || checkpoint, pos);
        },
        setCheckPointAtPrev: (P?: InlinePos) => {
            Object.assign(P || checkpoint, pos);
            stepBack(P || checkpoint);
        }
    };
}




