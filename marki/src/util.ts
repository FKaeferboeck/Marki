import { lineContent, LogicalLine, LogicalLine_comment, LogicalLine_text, LogicalLine_with_cmt, LogicalLineType, shiftCol, Slice, sliceLine_to } from "./linify.js";
import { AnyInline, InlinePos, Pos } from "./markdown-types.js";
import { PositionOps } from "./position-ops.js";

const spaces: Record<string, boolean> = { ' ': true,  '\t': true,  '\n': true };


export function sliceLL_to(LL: LogicalLine_with_cmt, end: InlinePos): LogicalLine_with_cmt {
    if(LL === end.LL)
        return sliceLine_to(LL, end.char_idx) as LogicalLine_with_cmt;

    const LL_return = { ... LL };
    let LL_w = LL_return;
    while(LL.next) {
        LL = LL.next;
        if(LL === end.LL) {
            LL_w.next = sliceLine_to(LL, end.char_idx);
            return LL_return;
        }
        LL_w = (LL_w.next = { ... LL,  shiftCol: shiftCol(LL),  parent: LL } as Slice<LogicalLine_with_cmt>);
        // ^ The cloned object has the wrong "next" property, but it gets corrected in the next loop iteration
    }
    throw new Error('End line of slicing position not found');
}


export function LLinfo(LL: LogicalLine_with_cmt | null | undefined) {
    if(!LL)
        return '[EOF]';
    if(LL.type === "comment")
        return '[Comment line]';
    return `[${LL.lineIdx}:${LL.indent ? `(${LL.indent})+` : ''}${lineContent(LL)}${LL.isSoftContainerContinuation ? '\\SCC' : ''}]`;
}

export const isLineStart = (pos: InlinePos) => (pos.char_idx === 0);


/**********************************************************************************************************************/

export interface InlineParsingConfig {
    ignoreStartIndents: boolean;
    html_as_literal:    boolean;
    report_line_breaks: boolean;
}


export function charLength(from: InlinePos, to: InlinePos) {
    if(from.LL === to.LL) // slice of a single line (most common case)
        return (to.char_idx - from.char_idx);

    let len = Math.max(lineContent(from.LL).length - from.char_idx, 0); // remainder of start line

    // add whole lines between start and end
    let LL = from.LL;
    while(LL.next && LL.next !== to.LL) {
        LL = LL.next as LogicalLine; // TODO!! comment lines
        len += 1 /* line break char */ + lineContent(LL).length;
    }
    if(!LL.next)
        throw new Error('');

    len += 1 /* line break char */ + to.char_idx;
    return len;
}


export function contentSlice(p0: InlinePos, p1: InlinePos, includeComments: boolean, line_break_char = '\n') {
    let C = lineContent(p0.LL);
    if(p0.LL === p1.LL) // slice of a single line
        return C.slice(p0.char_idx, p1.char_idx);

    const buf: string[] = [];
    if(p0.char_idx < C.length)
        buf.push(C.slice(p0.char_idx)); // remainder of start line

    // add whole lines between start and end
    let LL = p0.LL;
    while(LL.next && LL.next !== p1.LL) {
        LL = LL.next as LogicalLine; // TODO!! comment lines
        buf.push(line_break_char, lineContent(LL));
    }
    if(!LL.next)
        throw new Error('');

    buf.push(line_break_char);
    if(p1.char_idx > 0) {
        C = lineContent(p1.LL);
        buf.push(C.slice(0, p1.char_idx));
    }
    return buf.join('');
}


export interface BCI_TakeDelimited_IO {
    delim:  string | undefined; // initial call: should be emtpy;  trailing call: the delimiter the text started with
    isOpen: boolean; // in: do we accept an open end?  out: did we end open?
}

type BlockContentChar = string | false;

export interface BlockContentIterator {
    //line_break_char: string;

    newPos(): InlinePos;
    relativePos(): Pos;

    peek():           BlockContentChar;
    peekN(n: number): BlockContentChar;

    pop():   BlockContentChar; // basically *It++
    unpop(): BlockContentChar; // basically *--It

    skip(chars: Record<string, boolean>) : number;
    skipNobrSpace(): number;
    skipXMLspace(): boolean; // returns if anything was skipped

    regexInLine(rexes: RegExp): false | RegExpMatchArray;
    regexInLine(...rexes: (RegExp | boolean)[]): false | (RegExpMatchArray | boolean)[];

    takeDelimited(allowedDelimiters: Record<string, string>, delim_io?: BCI_TakeDelimited_IO): BlockContentChar;

    setPosition        (P:  InlinePos): void;
    setCheckPoint      (P?: InlinePos): void;
    goToEnd(): void;
    getPosition(P: InlinePos, n?: number): boolean; // extract current position, optionally with an offset

    stateInfo(): void;
}


function spreadLL(LL: LogicalLine_with_cmt) {
    const LLs = [ LL ];
    while(LL.next)
        LLs.push(LL = LL.next);
    return LLs;
}


const nSubrows = (LL: LogicalLine_with_cmt | undefined) => (LL?.type === "comment" ? LL.content.length : 1);


// comment lines are represented by a number == index into their sub-rows
type CurLineType = LogicalLineType | "EOL" | "EOF" | "BEB" /* before begin */;
interface LineHandle {
    idx:        number; // if type is EOL/EOF, this will point to the line/subrow whose end it is
    cmt_subrow: number; //
    type:       CurLineType;
}

function getPart(LLs: LogicalLine_with_cmt[], H: LineHandle, line_break_char: string) {
    switch(H.type) {
        case "EOL":      return line_break_char;
        case "BEB":
        case "EOF":      return [false] as const;
        case "comment":  return (LLs[H.idx] as LogicalLine_comment).content[H.cmt_subrow];
        case "text":     return (LLs[H.idx] as LogicalLine_text).content;
        default:
            throw new Error('getPart: Cannot return part of empty line');
    }
}

function nextLineIdx(LLs: LogicalLine_with_cmt[], lineIdx: number, skip_cmt_lines: boolean) {
    do ++lineIdx;
    while(lineIdx < LLs.length && skip_cmt_lines && LLs[lineIdx].type === "comment");
    return lineIdx;
}

function nextLine(LLs: LogicalLine_with_cmt[], H: LineHandle, skip_cmt_lines: boolean) {
    const LL = LLs[H.idx];
    if(H.type === "EOF")
        return; // do not advance beyond the end
    if(!(H.type === "EOL" || H.type === "BEB")) {
        H.type = (H.cmt_subrow < nSubrows(LL) - 1 || // comment line, standing at what is not the last subrow
                  nextLineIdx(LLs, H.idx, skip_cmt_lines) < LLs.length ? "EOL" : "EOF");
        return;
    }
    // EOL or BEB -> next line
    if(H.cmt_subrow < nSubrows(LL) - 1) // next subrow of the same comment line
        ++H.cmt_subrow;
    else {
        H.idx = nextLineIdx(LLs, H.idx, skip_cmt_lines);
        if(H.idx >= LLs.length)
            throw new Error('Unexpectedly EOL not followed by another line – should be EOF instead!');
        H.cmt_subrow = 0;
    }
    H.type = LLs[H.idx].type;
    if(H.type === "empty" || H.type === "emptyish")
        nextLine(LLs, H, skip_cmt_lines);
}

function prevLine(LLs: LogicalLine_with_cmt[], H: LineHandle, skip_cmt_lines: boolean) {
    if(H.type === "BEB")
        return;

    if(H.type.startsWith('EO')) {
        H.type = LLs[H.idx].type;
        if(H.type === "empty" || H.type === "emptyish")
            prevLine(LLs, H, skip_cmt_lines);
        return;
    }

    // going from a real part to a pseudo-part
    if(H.type === "comment" && H.cmt_subrow > 0)
        --H.cmt_subrow; // H.idx stays unchanged
    else {
        do --H.idx;
        while(H.idx >= 0 && skip_cmt_lines && LLs[H.idx].type === "comment");
        if(H.idx < 0) {
            H.type = "BEB";
            H.cmt_subrow = 0;
            return;
        }
        H.cmt_subrow = nSubrows(LLs[H.idx]) - 1;
    }
    H.type = "EOL";
}



export function makeBlockContentIterator(LL: LogicalLine, singleLine: boolean = false): BlockContentIterator {
    const skip_cmt_lines = true, line_break_char = '\n';
    const LLs = (singleLine ? [ LL ] : spreadLL(LL));
    const H: LineHandle = { idx: -1,  cmt_subrow: 0,  type: "BEB" };
    let char_idx = 0;
    let curPart: string | readonly [false] = [false];
    let curPartLength = 0;

    const nextPart = () => {
        nextLine(LLs, H, skip_cmt_lines);
        curPartLength = (curPart = getPart(LLs, H, line_break_char)).length;
        char_idx = 0;
    };
    const prevPart = () => {
        prevLine(LLs, H, skip_cmt_lines);
        curPartLength = (curPart = getPart(LLs, H, line_break_char)).length;
        char_idx = curPartLength - 1;
    };

    nextPart(); // set to first eligible part

    function shiftIntoView(H: LineHandle, offset: number) {
        if(offset > 0)
            do {
                nextLine(LLs, H, skip_cmt_lines);
                const part = getPart(LLs, H, line_break_char);
                if(offset < part.length)
                    return offset;
                offset -= part.length;
            } while(H.type !== "EOF");
        else
            do {
                prevLine(LLs, H, skip_cmt_lines);
                const part = getPart(LLs, H, line_break_char);
                offset += part.length;
                if(offset >= 0)
                    return offset;
            } while(H.type !== "BEB");
        return 0;
    }

    const It = {
        newPos: (): InlinePos => {
            const LL = LLs[H.idx];
            return { LL,  char_idx: (H.type.startsWith('EO') ? lineContent(LL).length : char_idx) };
        },
        relativePos: () => {
            const LL = LLs[H.idx];
            return { line: LL.lineIdx - LLs[0].lineIdx,
                     character: (H.type.startsWith('EO') ? lineContent(LL).length : char_idx) };
        },

        peek: () => curPart[char_idx],
        peekN: (offset: number) => {
            offset += char_idx;
            if(0 <= offset && offset < curPartLength) // the most common case
                return curPart[offset];
            const H1 = { ... H };
            offset = shiftIntoView(H1, offset);
            return getPart(LLs, H1, line_break_char)[offset];
        },

        pop: () => {
            const s = curPart[char_idx];
            if(s && ++char_idx >= curPartLength)
                nextPart();
            return s;
        },
        unpop: () => {
            if(--char_idx < 0)    prevPart();
            return curPart[char_idx];
        },

        skip: (chars: Record<string, boolean>) => {
            let skipped = 0;
            for(let c: string | false = false;  (c = It.peek()) && chars[c];  It.pop())
                ++skipped;
            return skipped;
        },

        skipXMLspace: () => {
            let found = false;
            while(spaces[curPart[char_idx] || '']) {
                found = true;
                if(++char_idx >= curPartLength)
                    nextPart();
            }
            return found;
        },

        skipNobrSpace: () => {
            let i = char_idx, c: string|false = '';
            while(i < curPartLength && ((c = curPart[i]) === ' ' || c === '\t'))    ++i;
            const d = i - char_idx;
            char_idx = i;
            if(char_idx === curPartLength)
                nextPart();
            return d;
        },

        regexInLine: (...rexes: (RegExp | boolean)[]): any => {
            const res: (RegExpExecArray | boolean)[] = [];
            const P1 = It.newPos();
            const abort = () => { It.setPosition(P1);    return false; };
            for(const rex of rexes) {
                if(typeof rex === "boolean") {
                    const skipped = It.skipXMLspace();
                    if(rex && !skipped)
                        return abort();
                    res.push(skipped);
                    continue;
                }
                if(H.type === "EOF" || H.type === "EOL")
                    return abort();
                //rex.lastIndex = char;
                const rexres = rex.exec((curPart as string).slice(char_idx));
                if(!rexres)
                    return abort();
                if((char_idx += rexres[0].length) >= curPartLength)
                    nextPart();
                res.push(rexres);
            }
            return (res.length === 1 && typeof res[0] !== "boolean" ? res[0] : res);
        },

        takeDelimited: (allowedDelimiters: Record<string, string>, delim_io?: BCI_TakeDelimited_IO) => {
            let c = It.peek();
            let escaped = false;
            let delim = delim_io?.delim || c;
            const endDelim = delim && allowedDelimiters[delim];
            if(!endDelim)
                return false;
            const chkp = It.newPos();
            if(!delim_io?.delim) // if we started a new delimiting expression the first character is the delimiter and will be skipped here
                It.pop(); 
            if(delim_io && !delim_io.delim)
                delim_io.delim = c as string;
            
            while(c = It.pop()) {
                if((c === delim || c === endDelim) && !escaped) {
                    if(delim_io)
                        delim_io.isOpen = false;
                    return contentSlice(chkp, It.newPos(), true);
                }
                escaped = (c === '\\' && !escaped);
            }
            if(delim_io?.isOpen)
                return contentSlice(chkp, It.newPos(), true);
            It.setPosition(chkp);
            return false;
        },

        setPosition: (P: InlinePos) => {
            const idx = LLs.indexOf(P.LL);
            if(idx < 0)
                throw new Error('setPosition: Position does not point into this block content');
            H.idx = idx;
            H.cmt_subrow = 0; // TODO!!
            H.type = P.LL.type;
            char_idx = P.char_idx;
            curPartLength = (curPart = lineContent(P.LL)).length;
            if(char_idx >= curPartLength)
                nextPart();
        },
        setCheckPoint: (P: InlinePos) => {
            P.LL = LLs[H.idx];
            P.char_idx = (H.type.startsWith('EO') ? lineContent(P.LL).length : char_idx);
        },
        goToEnd: () => {
            H.idx = LLs.length - 1;
            const LL = LLs[H.idx];
            H.cmt_subrow = nSubrows(LL) - 1;
            H.type       = "EOF";
            if(LL.type === "comment" && skip_cmt_lines) { // bit of a fudge but it works
                H.cmt_subrow = 0;
                H.type = "comment";
                prevPart();
                H.type = "EOF";
            }
        },
        getPosition: (P: InlinePos, offset?: number) => {
            offset = (offset || 0) + char_idx;
            if(0 <= offset && offset < curPartLength) {
                P.LL = LLs[H.idx];
                P.char_idx = offset;
                return true;
            }
            const H1 = { ... H };
            P.char_idx = shiftIntoView(H1, offset);
            P.LL = LLs[H.idx];
            return true;
        },

        stateInfo() {
            console.log(`[Line ${H.idx} "${H.type}" ${H.type === "comment" ? `(${H.cmt_subrow}) ` : ''}char ${char_idx}]`)
        }
    };
    return It;
}


const delims: Record<string, RegExp> = { '"': /\\(?=")/g,  '\'': /\\(?=')/g,
                                         '(': /\\(?=[()])/g,  '<': /\\(?=[<>])/g,  '[': /\\(?=[\[\]])/g,  '{': /\\(?=[{}])/g };
export function removeDelimiter(s: string) {
    const rex = delims[s.charAt(0)];
    return (rex ? s.slice(1, -1)/*.replaceAll(rex, '')*/ : s);
}


export function trimEndSpace(LL: LogicalLine_with_cmt) {
    let LL1 = LL;
    while(LL1.next)    LL1 = LL1.next;
    if(LL1.type !== "text")
        return LL;
    LL1.content = LL1.content.trimEnd();
    return LL;
}
