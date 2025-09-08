import { lineReassemble, linify_, LogicalLine_with_cmt } from 'marki/util';
import { Position } from 'vscode-languageserver';
import { IncrementalChange } from './change-managment';


export interface IncrementalChange_LL {
	range: [number, number];
	newLines: LogicalLine_with_cmt[];
}


export const lineIdxAfter = (LL: LogicalLine_with_cmt) => LL.lineIdx + (LL.type === "comment" ? LL.content.length : 1);

export function LL_beforeAfter(LL: LogicalLine_with_cmt, pos: Position, side: "before" | "after") {
    let s = '',  charPos = pos.character;
    switch(LL.type) {
    case "empty":
    case "emptyish":
        s = LL.prefix || '';
        break;
    case "text":
        s = LL.prefix + LL.content;
        break;
    case "comment":
        s = LL.content.join('\n');
        for(let i = 0, di = pos.line - LL.lineIdx;  i < di;  ++i)
            charPos += LL.content[i].length + 1;
        break;
    }
    return (side === "before" ? s.slice(0, charPos) : s.slice(charPos));
}


function closesCommentLine(LLs: LogicalLine_with_cmt[], i0: number) {
    // A logical line closes a comment line if it
    //  - is a comment line itself (in which case its first comment opener <!-- will come to lie inside the open comment we come in with)
    //  - it contains --> and only space behind it
    //  - Additionally a non-comment line which doesn't contain "-->" passes on the decision to the next line because it is possible as comment content.
    //  - If we reach the end of input while the comment line is still unclosed, it is not a comment line according to the current rules.
    for(let i = i0, iN = LLs.length;  i < iN;  ++i) {
        const LL = LLs[i];
        if(LL.type === "comment")    return i;
        if(LL.type !== "text")
            continue;
        const pos = LL.content.search('-->');
        if(pos < 0)
            continue;
        const LL_ = linify_(LL.content.slice(pos + 3).replace(/^[ \t]+/, ''), true, 0);
        if(LL_.inCmtLine)
            continue;
        return (LL_.LLs[0].type === "empty" ? i : false);
    }
    return false;
}


export function spliceIncrementalChange(LLs: LogicalLine_with_cmt[], change: IncrementalChange): IncrementalChange_LL {
    const { start, end } = change.range;
    const iN = LLs.length;
    const lineIdxN = lineIdxAfter(LLs[iN - 1]); // off-end physical line number

    if(start.line >= lineIdxN) // start new line at end
        return { range: [iN, iN + 1],  newLines: linify_(change.text, true, iN).LLs };

    let i0 = Math.min(start.line, iN - 1);
    while(i0 > 0 && LLs[i0].lineIdx > start.line)
        --i0;
    let txtNew = LL_beforeAfter(LLs[i0], start, "before");

    txtNew += change.text;

    let i1 = Math.min(end.line, iN - 1), i2: number|false = false;
    if(i1 < lineIdxN) { // not end-of-file, i.e. a real position
        while(i1 > 0 && LLs[i1].lineIdx > end.line)
            --i1;
        txtNew += LL_beforeAfter(LLs[i1], end, "after");
    }
    ++i1;

    const result = linify_(txtNew, true, i0);
    
    // special case: The last modified line ends in what is possibly an open comment line
    //               -> We need to check with the subsequent lines if that potential comment line gets properly closed, and adjust the line structure accordingly.
    if(result.inCmtLine && typeof (i2 = closesCommentLine(LLs, i1)) === "number") {
        ++i2;
        const expanded_txt = [... result.LLs, ... LLs.slice(i1, i2)].map(lineReassemble).join('\n');
        const result2 = linify_(expanded_txt, true, i0);
        if(result2.inCmtLine)
            throw new Error('Closing comment line discrepancy');
        return { range: [i0, i2],  newLines: result2.LLs };
    }

    return { range: [i0, i1],  newLines: result.LLs };
}
