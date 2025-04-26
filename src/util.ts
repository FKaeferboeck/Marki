import { Position } from "vscode-languageserver";
import { InlinePos, LinePart_ext, LogicalLineData, LP_break, LP_break_HTML, LP_EOF } from "./markdown-types.js";
import { HTML_Markup, LinePart, LineStructure, LogicalLineType } from "./parser.js";

const breakable: Partial<Record<LinePart_ext["type"], boolean>> = { "HTML_Tag": true,  "XML_Comment": true };
const isHTML_Markup = (P: LinePart_ext): P is HTML_Markup => breakable[P.type] || false;



export function measureIndent(s: string, preStartIndent: number = 0) {
    let n = 0;
    for (let i = 0, iN = s.length;  i < iN;  i++)
        switch(s[i]) {
        case ' ':     ++n;       break;
        case '\t':
            n += 4 + preStartIndent;
            n -= (n % 4) + preStartIndent;
            break;
        default:      return n;
        }
    return n;
}


export function lineTypeLP(L: LinePart_ext[]): LogicalLineType {
    if(L.length === 0)    return "empty";
    if(L.length === 1) {
        const P = L[0];
        if(P.type === "XML_Comment")    return "comment";
        if(P.content.length === 0)    return "empty";
        if((P.content as string).trimEnd().length === 0)    return "emptyish";
        return "single";
    }
    // now there are multiple parts, which means that at least some of them are comments -> can only be all comment or mixed content
    return (L.some(P => P.type !== "XML_Comment" && (P.content as string).trimEnd().length !== 0) ? "text" : "comment");
}


function trimStart_tabbed(s: string, n: number, preStartIndent: number) {
    if(n <= 0)    return s;
    for(let i = 0, iN = s.length, colPos = 0;  i < iN;  ++i) {
        if(s[i] === '\t') {
            colPos += 4 + preStartIndent;
            colPos -= (colPos % 4) + preStartIndent;
            if(colPos >= n)
                return ' '.repeat(colPos - n) + s.slice(i + 1);
        }
        else if(++colPos >= n)
            return s.slice(i + 1);
    }
    return '';
}

export function sliceLLD(LLD: LogicalLineData, begin: number): LogicalLineData {
    const p0 = (LLD.parts.length > 0 ? trimStart_tabbed(LLD.parts[0].content as string, begin, LLD.preStartIndent || 0) : '');
    //const p0 = (' '.repeat(LLD.startIndent) + LLD.startPart).slice(begin);
    const parts = [ ... LLD.parts ];
    if(p0.length > 0)
        parts[0].content = p0;
    else
        parts.splice(0, 1);

    const pre = begin + (LLD.preStartIndent || 0);
    const LLD_c: LogicalLineData = {
        logl_idx:    LLD.logl_idx,
        parts:       parts,
        startPart:   p0.trimStart(),
        startIndent: measureIndent(p0, pre),
        type:        lineTypeLP(parts),
        next:        null
    };
    if(pre > 0)
        LLD_c.preStartIndent = pre;
    LLD.contentSlice = LLD_c;
    if(LLD.isSoftContainerContinuation)
        LLD_c.isSoftContainerContinuation = true;
    return LLD_c;
}


const cloneLLD = (LLD: LogicalLineData): LogicalLineData => ({ ... LLD,  parts: [ ... LLD.parts ],  next: null });

export function sliceLLD_to(LLD: LogicalLineData, end: InlinePos): LogicalLineData {
    const LLD_return = cloneLLD(LLD);
    let LLD1 = LLD_return;
    while(LLD != end.LLD) {
        if(!LLD.next)
            throw new Error('End not found');
        LLD1 = (LLD1.next = cloneLLD(LLD = LLD.next));
    }
    const P1: LinePart_ext | undefined = LLD1.parts[end.part_idx];
    LLD1.parts = LLD1.parts.slice(0, end.part_idx);
    if(P1)
        LLD1.parts.push({ content: P1.content.slice(0, end.char_idx),  type: P1.type } as LinePart_ext);
    return LLD_return;
}



export function lineData(LS: LineStructure, logl_idx: number): LogicalLineData {
    const LL = LS.logical_lines[logl_idx];
    let P  = LS.all[LL.start];
    const p0 = (P.type === "TextPart" ? P.content : '');
    const parts: LinePart_ext[] = [];
    for(let i = LL.start, iE = i + LL.extent;  i < iE;  ++i) {
        parts.push(P = LS.all[i]);
        if(isHTML_Markup(P) && P.continues)
            parts.push(LP_break_HTML);
    }
    //parts.push(LP_break);

    return {
        logl_idx,  parts,
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

export const isLineStart = (pos: InlinePos) => (pos.part_idx === 0 && pos.char_idx === 0);


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
        buf.push(R0.content.slice(p0.char_idx, p1.char_idx) as string);
        return buf.join('');
    }

    buf.push(R0.content.slice(p0.char_idx) as string);
    
    const fct = (i: number, iE: number) => {
        for(;  i < iE;  ++i) {
            const R = LLD.parts[i];
            if(R.type !== "XML_Comment" || includeComments)
                buf.push(R.content as string);
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
        buf.push(R1.content.slice(0, p1.char_idx) as string);
    return buf.join('');
}


export interface BCI_TakeDelimited_IO {
    delim:  string | undefined; // initial call: should be emtpy;  trailing call: the delimiter the text started with
    isOpen: boolean; // in: do we accept an open end?  out: did we end open?
}

export interface BlockContentIterator {
    pos: InlinePos;
    checkpoint: InlinePos;
    line_break_char: string;

    newCheckpoint(): InlinePos;

    peekChar(): string | false;
    peekItem(): string | LinePart | false;

    peekBack(n: number): string | false;

    prevCharInPart(): false | string;
    nextChar(): false | string;
    nextItem(): false | string | LinePart;

    skip(chars: Record<string, boolean>) : number;
    skipNobrSpace(): number;

    regexInPart(rex: RegExp): RegExpMatchArray | false; // advances iterator by the given regex if it matches, but only within the current line part
    takeDelimited(allowedDelimiters: Record<string, string>, delim_io?: BCI_TakeDelimited_IO): string | false;

    setPosition        (P:  InlinePos): void;
    setCheckPoint      (P?: InlinePos): void;
    goToEnd(): void;
    //setCheckPointAtPrev(P?: InlinePos): void;
    getPosition(P: InlinePos, n?: number): boolean; // extract current position, optionally with an offset
}





export function makeBlockContentIterator(LLD: LogicalLineData, singleLine: boolean = false): BlockContentIterator {
    const pos        = makeInlinePos(LLD);
    let   checkpoint = makeInlinePos(LLD);
    let curLine = LLD;
    let curPart: LinePart_ext = curLine.parts[0];
    let curPartLength = curPart.content.length;

    const nextPart = () => {
        const x = (++pos.part_idx - curLine.parts.length);
        if(x === 0 && curLine.next && !singleLine) { // insert line break character, except after the last line
            curPart = LP_break;
            pos.char_idx = 0;
            curPartLength = 0;
            return;
        }
        if(x >= 0) {
            if(!curLine.next || singleLine) {
                curPart = LP_EOF;
                /*pos.part_idx = */pos.char_idx = 0;
                return;
            }
            if(curLine = curLine.next)
                pos.LLD = curLine;
            pos.part_idx = 0;
        }
        curPartLength = (curPart = curLine.parts[pos.part_idx]).content.length;
        curPart.content.length
        pos.char_idx = 0;
    };

    const It = {
        pos,
        checkpoint,
        line_break_char: ' ',

        newCheckpoint: () => ({ ... pos }),

        peekChar: () => curPart.content[pos.char_idx],
        peekItem: () => {
            if(isHTML_Markup(curPart) && pos.char_idx === 0)
                return curPart;
            return It.peekChar();
        },

        peekBack: (n: number) => {
            if(pos.char_idx >= n)    return curPart.content[pos.char_idx - n];
            n -= pos.char_idx;
            if(pos.part_idx > 0) {
                const C = curLine.parts[pos.part_idx - 1].content;
                if(C.length >= n)
                    return C[C.length - n];
            }
            return false;
        },

        prevCharInPart: () => (pos.char_idx > 0 && curPart.content[pos.char_idx - 1]),
        nextChar: () => {
            const s = curPart.content[pos.char_idx];
            if(s && ++pos.char_idx >= curPartLength)
                nextPart();
            return s;
        },

        nextItem: () => {
            if(isHTML_Markup(curPart) && pos.char_idx === 0) {
                const s = curPart;
                nextPart();
                return s;
            }
            const s = curPart.content[pos.char_idx];
            if(s && ++pos.char_idx >= curPartLength)
                nextPart();
            return s;
        },

        skip: (chars: Record<string, boolean>) => {
            let skipped = 0;
            for(let c: string | false = false;  (c = It.peekChar()) && chars[c];  It.nextChar())
                ++skipped;
            return skipped;
        },

        skipNobrSpace: () => {
            let i = pos.char_idx, c: string|false = '';
            while(i < curPartLength && ((c = curPart.content[i]) === ' ' || c === '\t'))    ++i;
            const d = i - pos.char_idx;
            pos.char_idx = i;
            if(pos.char_idx === curPartLength)
                nextPart();
            return d;
        },

        regexInPart: (rex: RegExp) => {
            if(curPart.type === "EOF" || curPart.type === "lineBreak")
                return false;
            //rex.lastIndex = pos.char_idx;
            const rexres = rex.exec(curPart.content.slice(pos.char_idx));
            if(!rexres)
                return false;
            if((pos.char_idx += rexres[0].length) >= curPartLength)
                nextPart();
            return rexres;
        },

        takeDelimited: (allowedDelimiters: Record<string, string>, delim_io?: BCI_TakeDelimited_IO) => {
            let c = It.peekChar(), c0 = c;
            let delim = delim_io?.delim || c;
            const endDelim = delim && allowedDelimiters[delim];
            if(!endDelim)
                return false;
            const chkp = It.newCheckpoint();
            if(!delim_io?.delim) // if we started a new delimiting expression the first character is the delimiter and will be skipped here
                It.nextChar(); 
            if(delim_io && !delim_io.delim)
                delim_io.delim = c as string;
            
            while(c = It.nextChar()) {
                if((c === delim || c === endDelim) && c0 !== '\\') {
                    if(delim_io)
                        delim_io.isOpen = false;
                    return contentSlice(chkp, It.pos, true);
                }
                c0 = c;
            }
            if(delim_io?.isOpen)
                return contentSlice(chkp, It.pos, true);
            It.setPosition(chkp);
            return false;
        },

        setPosition: (P: InlinePos) => {
            Object.assign(pos, P);
            const pa = (curLine = P.LLD).parts;
            curPart = (P.part_idx < pa.length ? pa[P.part_idx] : LP_break);
            curPartLength = curPart.content.length;
        },
        setCheckPoint: (P?: InlinePos) => {
            Object.assign(P || checkpoint, pos);
        },
        goToEnd: () => {
            while(curLine.next)
                curLine = curLine.next;
            pos.LLD = curLine;
            pos.part_idx = curLine.parts.length; // off-end
            pos.char_idx = 0;
            curPart = LP_EOF;
            curPartLength = 1;
        },
        getPosition: (P: InlinePos, n?: number) => {
            Object.assign(P, pos);
            // TODO!! Wo can only use negative offsets currently
            if(n) {
                if(P.char_idx >= -n)
                    P.char_idx += n;
                else {
                    n += P.char_idx;
                    if(P.part_idx === 0)
                        return false;
                    const C = P.LLD.parts[--P.part_idx].content;
                    P.char_idx = C.length + n;
                }
            }
            return true;
        }
    };
    return It;
}



const delims: Record<string, RegExp> = { '"': /\\(?=")/g,  '\'': /\\(?=')/g,
                                         '(': /\\(?=[()])/g,  '<': /\\(?=[<>])/g,  '[': /\\(?=[\[\]])/g,  '{': /\\(?=[{}])/g };
export function removeDelimiter(s: string) {
    const rex = delims[s.charAt(0)];
    return (rex ? s.slice(1, -1).replaceAll(rex, '') : s);
}
