import { Position, Range, uinteger } from 'vscode-languageserver';

export interface IncrementalChange {
	range: Range;
	rangeLength?: uinteger;
	text: string;
}


export type LogicalLineType = "empty" | "emptyish" | "comment" | "text";

export interface LogicalLine_base<T extends LogicalLineType> {
    type:    T;
    lineIdx: number;
    next?:   LogicalLine_with_cmt;
    isSoftContainerContinuation? : boolean; // this is dirty — this property has no business being here, but it's easier this way
}
function LL_inherit<T extends LogicalLineType>(B: LogicalLine_base<LogicalLineType>, type: T, shiftCol = 0) {
    const B1: LL_SliceBase<T> = { type,  lineIdx: B.lineIdx,  parent: B as LogicalLine_with_cmt,  shiftCol };
    if(typeof B.isSoftContainerContinuation === "boolean")
        B1.isSoftContainerContinuation = B.isSoftContainerContinuation;
    return B1;
}

export interface LogicalLine_emptyish extends LogicalLine_base<"empty"|"emptyish"> {
    prefix?: string; // prefix can be omitted for empty lines
    indent:  number; // with emptyish lines nothing comes after the indent/prefix
}

export interface LogicalLine_comment extends LogicalLine_base<"comment"> {
    content: string[]; // excluding leading space in first line
}

export interface LogicalLine_text extends LogicalLine_base<"text"> {
    content: string;
    prefix:  string;
    indent:  number;
}

export type LogicalLine          = LogicalLine_emptyish | LogicalLine_text;
export type LogicalLine_with_cmt = LogicalLine_emptyish | LogicalLine_text | LogicalLine_comment;

export interface LineStructure {
	//all: LinePart[]; // the physical structure
	logical_lines: LogicalLine_with_cmt[];
}



export interface LL_Slice_additions {
    shiftCol: number;
    parent:   LogicalLine_with_cmt;
}
export type Slice<T extends LogicalLine_with_cmt> = T & LL_Slice_additions;
export type LL_SliceBase<T extends LogicalLineType> = LogicalLine_base<T> & LL_Slice_additions;
export const isLineSlice = <T extends LogicalLine_with_cmt>(LL: T): LL is Slice<T> => ("shiftCol" in LL && typeof LL.shiftCol === "number");


export const shiftCol = (LL: LogicalLine_with_cmt) => ("shiftCol" in LL && typeof LL.shiftCol === "number" ? LL.shiftCol : 0);

export const standardBlockStart = (LL: LogicalLine): LL is LogicalLine_text => (LL.type === "text" && LL.indent < 4);

export const isSpaceLineType: Record<LogicalLineType, boolean> = { empty: true,  emptyish: true,  text: false,  comment: false };
export const isSpaceLine = (LL: LogicalLine_with_cmt): LL is LogicalLine_emptyish => isSpaceLineType[LL.type];

export const lineContent    = (LL: LogicalLine_with_cmt | undefined) => (LL?.type === "text" ? LL.content : '');
export const lineReassemble = (LL: LogicalLine_with_cmt | undefined) => {
    switch(LL?.type) {
    case "comment":  return LL.content.join('\n');
    case "text":     return LL.prefix + LL.content;
    default:         return LL?.prefix || '';
    }
};


export function linify(text: string, makeCommentLines: boolean, link_together = true): LogicalLine_with_cmt[] {
    const A = linify_(text, makeCommentLines, 0).LLs;
    if(link_together)
        for(let i = 1, iN = A.length;  i < iN;  ++i) {
            A[i - 1].next = A[i];
        }
    return A;
}


/* Counts the length of leading nonbreaking whitespace (' ' and \t) of a string.
 * Returns the length as number or characters and column width (with \t being 4 columns wide)
 * startCol is a column index where the string is assumed to start. The result is measured from the beginning of the string,
 * but startCol affects how many columns each \t skips.
 */
function prefixSize(pfx: string, startCol: number = 0) {
    let cols = startCol, chars = 0;
    for(const s of pfx) {
        if(s === '\t') {
            cols += 4;
            cols -= cols % 4;
        } else if(s === ' ')
            ++cols;
        else
            break;
        ++chars;
    }
    return { chars, cols: cols - startCol };
}

/* Similar to String.slice, but takes a column offset instead of a character idx.
 * If a \t straddles the slice position (colFrom) the resulting slice will contain that \t.
 */
function tabbedSlice(text: string, colFrom: number, startCol: number = 0): string {
    let col = startCol, i = 0;
    for(const s of text) {
        if(s === '\t') {
            col += 4;
            col -= col % 4;
        } else
            ++col;
        if(col > colFrom)
            return text.slice(i);
        ++i;
    }
    return '';
}


/* Measures the column position up to the character with index `char_offset` within the LogicalLine's content.
 * The line's leading indent (LogicalLine.indent) is not included in the count, it only measures from the start of the nontrivial content.
 * The column number by which the whole line is shifted (LogicalLine.shiftCol if present) is taken into account to determine
 * the correct tab stops for \t characters.
 */
export function measureColOffset(LL: LogicalLine, char_offset: number) {
    if(LL.type !== "text")
        return 0;
    const indent = shiftCol(LL) + LL.indent;
    let col = indent, iN = Math.min(LL.content.length, char_offset);
    for(let i = 0;  i < iN;  ++i) {
        const c = LL.content[i];
        if(c === '\t') {
            col += 4;
            col -= col % 4;
        } else
            ++col;
    }
    return col - indent;
}


const leadingSpace = (LL: LogicalLine_with_cmt) => ("indent" in LL ? LL.indent : 0);


export function linify_(text: string, makeCommentLines: boolean, start_line: number) {
    const buf: LogicalLine_with_cmt[] = [];
    let i0 = 0, n_commentLine = 0;
    let lineIsOnlySpace = true, // is this physical line only ' ' and '\t'? (inside or outside an XML comment)
        commentLineEligible = true,
        isInComment = false, // can only be true if the line is still comment line eligible
        endInOpenCmtLine = false;

    for(let i = 0, iN = text.length;  i <= iN;  ++i) {
        switch(text[i]) {
        case undefined:
        case '\r':
        case '\n':
            const content = text.slice(i0, i);
            endInOpenCmtLine = (makeCommentLines && commentLineEligible &&
                                (n_commentLine > 0 ? leadingSpace(buf[buf.length - n_commentLine]) === 0 : !/^[ \t]/.test(content)));
            if(endInOpenCmtLine && !isInComment && !lineIsOnlySpace)
            {   // a comment line ends here
                const cl = (buf.splice(buf.length - n_commentLine, n_commentLine) as (LogicalLine_emptyish | LogicalLine_text)[])
                    .map(L => (L.prefix || '') + ("content" in L ? L.content : ''));
                cl.push(content);
                buf.push({ type: "comment",  lineIdx: start_line - n_commentLine,  content: cl });
                n_commentLine = 0;
            }
            else if(i0 === i)
                buf.push({ type: "empty",  lineIdx: start_line,  indent: 0 });
            else if(lineIsOnlySpace)
                buf.push({ type: "emptyish",  lineIdx: start_line,  prefix: content,  indent: prefixSize(content).cols });
            else {
                let { chars, cols } = prefixSize(content);
                buf.push({ type: "text",  lineIdx: start_line,  prefix: content.slice(0, chars),  indent: cols,  content: content.slice(chars) }); // may be converted into part of a comment line later
            }
            ++start_line;
            if(isInComment)
                ++n_commentLine;
            if(text[i] === '\r' && i + 1 < iN && text[i + 1] === '\n')    ++i; // handle \r\n line break
            i0 = i + 1;
            lineIsOnlySpace = commentLineEligible = true;
            break;
        case '<':
            lineIsOnlySpace = false;
            if(isInComment)
                break;
            if(commentLineEligible && text.startsWith('<!--', i)) {
                isInComment = true;
                i += 3;
                break;
            }
            commentLineEligible = false;
            break;
        case ' ':
        case '\t':
            break;
        case '-':
            lineIsOnlySpace = false;
            if(isInComment && text.startsWith('-->', i)) {
                i += 2;
                isInComment = false;
                break;
            }
        default:
            lineIsOnlySpace = false;
            if(!isInComment)
                commentLineEligible = false;
            break;
        }
    }
    return { LLs: buf,  inCmtLine: endInOpenCmtLine && isInComment };
}


export function sliceLine(LL: LogicalLine,          colFrom: number): Slice<LogicalLine>;
export function sliceLine(LL: LogicalLine_with_cmt, colFrom: number): Slice<LogicalLine_with_cmt> {
    const shift0 = shiftCol(LL),  indent = ("indent" in LL ? LL.indent : 0) + shift0;
    colFrom += shift0;
    switch(LL.type) {
    case 'empty':
        return { ... LL_inherit(LL, "empty", colFrom),  indent: 0 };
    case 'comment':
        return { ... LL_inherit(LL, "comment", colFrom),  content: [ ... LL.content ] };
    case "emptyish":
        if(indent <= colFrom)
            return { ... LL_inherit(LL, "empty", colFrom),  indent: 0 };
        return { ... LL_inherit(LL, "emptyish", colFrom),  indent: indent - colFrom,
                 prefix: tabbedSlice(LL.prefix || '', colFrom, shift0) };
    case "text":
        if(indent >= colFrom)
            return { ... LL_inherit(LL, "text", colFrom),  content: LL.content,
                     indent: indent - colFrom,  prefix: tabbedSlice(LL.prefix, colFrom, shift0) };
        else {
            const content_slice = tabbedSlice(LL.content, colFrom, indent);
            if(!content_slice) // everything was sliced off
                return { ... LL_inherit(LL, "empty", colFrom),  indent: 0 };
            const pfx = prefixSize(content_slice, colFrom);
            if(pfx.chars === 0) // no whitespace right after the slicing position
                return { ... LL_inherit(LL, "text", colFrom),  indent: 0,  prefix: '',  content: content_slice };
            if(pfx.chars === content_slice.length) // all non-whitespace content was sliced off, only whitespace remains to the right of it
                return { ... LL_inherit(LL, "emptyish", colFrom),  indent: pfx.cols,  prefix: content_slice };
            // most general case: slice hits a whitspace bit in the middle of the string
            return {
                ... LL_inherit(LL, "text", colFrom),
                indent: pfx.cols,  prefix: content_slice.slice(0, pfx.chars),
                content: content_slice.slice(pfx.chars)
            };
        }
    }
}


export function sliceLine_to(LL: LogicalLine_with_cmt, charEnd: number): Slice<LogicalLine_with_cmt> {
    if(LL.type !== "text")
        return { ... LL,  shiftCol: shiftCol(LL),  parent: LL };

    if(charEnd <= 0)
        return (LL.indent > 0 ? { ... LL_inherit(LL, "emptyish", shiftCol(LL)),  indent: LL.indent,  prefix: LL.prefix }
                              : { ... LL_inherit(LL, "empty",    shiftCol(LL)),  indent: 0 });
        
    return {
        ... LL,
        content: LL.content.slice(0, charEnd),
        shiftCol: shiftCol(LL),  parent: LL
    };
}
