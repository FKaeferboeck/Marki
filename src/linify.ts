import { Position } from 'vscode-languageserver';


export interface LogicalLine_emptyish {
    type:    "empty" | "emptyish";
    start:   number;
    prefix?: string; // prefix can be omitted for empty lines
    indent:  number; // with emptyish lines nothing comes after the indent/prefix
}

export interface LogicalLine_comment {
    type:    "comment";
    start:   number;
    content: string[]; // excluding leading space in first line
}

export interface LogicalLine_text {
    type:    "text";
    start:   number;
    content: string;
    prefix:  string;
    indent:  number;
}

export type LogicalLine = LogicalLine_emptyish | LogicalLine_comment | LogicalLine_text;

export type LogicalLineType = LogicalLine["type"];


export type LogicalLineSlice = LogicalLine & {
    shiftCol: number;
    parent:   LogicalLine;
}


export function linify(text: string, makeCommentLines: boolean): LogicalLine[] {
    const A = linify_(text, makeCommentLines, { line: 0,  character: 0 }, false);
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


const leadingSpace = (LL: LogicalLine) => ("indent" in LL ? LL.indent : 0);


export function linify_(text: string, makeCommentLines: boolean, pos: Position, inCmt: false) {
    const buf: LogicalLine[] = [];
    let i0 = 0, n_commentLine = 0, start = 0;
    let lineIsOnlySpace = true, // is this physical line only ' ' and '\t'? (inside or outside an XML comment)
        commentLineEligible = true,
        isInComment = false; // can only be true if the line is still comment line eligible

    for(let i = 0, iN = text.length;  i <= iN;  ++i) {
        switch(text[i]) {
        case undefined:
        case '\r':
        case '\n':
            const content = text.slice(i0, i);
            if(makeCommentLines && !isInComment && commentLineEligible && !lineIsOnlySpace &&
               (n_commentLine > 0 ? leadingSpace(buf[buf.length - n_commentLine]) === 0 : !/^[ \t]/.test(content)))
            {   // a comment line ends here
                const cl = (buf.splice(buf.length - n_commentLine, n_commentLine) as (LogicalLine_emptyish | LogicalLine_text)[])
                    .map(L => (L.prefix || '') + ("content" in L ? L.content : ''));
                cl.push(content);
                buf.push({ type: "comment",  start: start - n_commentLine,  content: cl });
                n_commentLine = 0;
            }
            else if(i0 === i)
                buf.push({ type: "empty",  start,  indent: 0 });
            else if(lineIsOnlySpace)
                buf.push({ type: "emptyish",  start,  prefix: content,  indent: prefixSize(content).cols });
            else {
                let { chars, cols } = prefixSize(content);
                buf.push({ type: "text",  start,  prefix: content.slice(0, chars),  indent: cols,  content: content.slice(chars) }); // may be converted into part of a comment line later
            }
            ++start;
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
    return buf;
}


export function sliceLine(LL: LogicalLine | LogicalLineSlice, shiftCol: number): LogicalLineSlice {
    const shift0 = ("shiftCol" in LL ? LL.shiftCol : 0),
          indent = ("indent" in LL   ? LL.indent   : 0) + shift0;
    shiftCol += shift0;
    switch(LL.type) {
    case 'empty':
    case 'comment':
        return { ... LL,  shiftCol,  parent: LL };
    case "emptyish":
        if(indent <= shiftCol)
            return { type: "empty",  start: LL.start,  indent: 0,  shiftCol,  parent: LL };
        return {
            type: "emptyish",  start: LL.start,  indent: indent - shiftCol,
            prefix: tabbedSlice(LL.prefix || '', shiftCol, shift0),
            shiftCol,  parent: LL
        };
    case "text":
        if(indent >= shiftCol)
            return { ... LL,  indent: indent - shiftCol,  prefix: tabbedSlice(LL.prefix, shiftCol, shift0),  shiftCol,  parent: LL };
        else {
            const content_slice = tabbedSlice(LL.content, shiftCol, indent);
            if(!content_slice) // everything was sliced off
                return { type: "empty",  start: LL.start,  indent: 0,  shiftCol,  parent: LL };
            const pfx = prefixSize(content_slice, shiftCol);
            if(pfx.chars === 0) // no whitespace right after the slicing position
                return { type: "text",  start: LL.start,  indent: 0,  prefix: '',  content: content_slice,  shiftCol,  parent: LL };
            if(pfx.chars === content_slice.length) // all non-whitespace content was sliced off, only whitespace remains to the right of it
                return { type: "emptyish",  start: LL.start,  indent: pfx.cols,  prefix: content_slice,  shiftCol,  parent: LL };
            // most general case: slice hits a whitspace bit in the middle of the string
            return {
                type: "text",  start: LL.start,
                indent: pfx.cols,  prefix: content_slice.slice(0, pfx.chars),
                content: content_slice.slice(pfx.chars),
                shiftCol,  parent: LL
            };
        }
    }
}
