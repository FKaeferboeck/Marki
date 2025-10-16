import { findBlock, lineReassemble, linify_, LogicalLine_with_cmt } from 'marki/util';
import { Position } from 'vscode-languageserver';
import { IncrementalChange } from './change-managment';
import { AnyBlock, BlockStopper, MarkiDocument, ParsingContext, reprocessContent } from 'marki';


export interface IncrementalChange_LL {
	range: [number, number];
	newLines: LogicalLine_with_cmt[];
}

export interface IncrementalChange_Blocks {
	range: [number, number]; // block indices
	newBlocks: AnyBlock[];
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


export const blockInfo = (B: AnyBlock, line_delta?: number) => `[${B.lineIdx}, ${B.lineIdx + B.logical_line_extent}${line_delta ? '+' + line_delta : ''}, ${B.type}]`;
export const blockDiag = (Bs: AnyBlock[]) => console.log('<<' + Bs.map(B => blockInfo(B)).join('\n  ') + '>>');

type BlockStopper_matchingEndline = BlockStopper & {
    lastBlock: number;
};
function makeBlockStopper_matchingEndline(Bs: AnyBlock[], b1: number, line_delta: number): BlockStopper_matchingEndline {
    const fct = (B_in: AnyBlock) => {
        while(fct.lastBlock < Bs.length) {
            const B = Bs[fct.lastBlock];
            const end_line = B.lineIdx + B.logical_line_extent + line_delta;
            const line_idx = B_in.lineIdx + B_in.logical_line_extent;
            if(line_idx > end_line) {
                ++fct.lastBlock;
                continue;
            }
            fct.continues_ = (line_idx !== end_line);
            //console.log(`New block ${blockInfo(B_in)} ends at ${blockInfo(B, line_delta)}?}`, !fct.continues_);
            return;
        }
    };
    //console.log('Start Abgelich at block', b1)
    fct.lastBlock = b1;
    fct.continues_ = true;
    fct.continues = () => fct.continues_ || false;
	return fct;
}



export function incrementalBlockChange(ctx: ParsingContext, doc: MarkiDocument, delta: IncrementalChange_LL): IncrementalChange_Blocks {
    const LLs = doc.LLs;
    const [line0, line1] = delta.range;
    //console.log('Line range', delta.range)
    let   b0 = findBlock(doc.blocks, line0) - 1; // unfortunately there are multiple scenarios where a change can affect the previous block, so lets keep it easy and ALWAYS reparse it
    const b1 = findBlock(doc.blocks, line1 - 1);
    let   B0 = doc.blocks[Math.max(b0, 0)];
    let line_delta = 0; // difference in indices of lines behind the change
    //console.log('Deliverd:');  blockDiag(doc.blocks)
    
    if(line1 - line0 === 1 && delta.newLines.length === 1) { // most common case: change within a single line
        (LLs[line0] = delta.newLines[0]).next = LLs[line1];
        if(line0 > 0)
            LLs[line0 - 1].next = LLs[line0];
    }
    else {
        line_delta = delta.newLines.length - (line1 - line0);
        LLs.splice(line0, line1 - line0, ... delta.newLines);
        for(let i = Math.max(line0 - 1, 0), ie = LLs.length, l_idx = LLs[i]?.lineIdx;  i < ie;  ++i)
        {
            LLs[i].next    = LLs[i + 1]; // will be undefined for the last element
            LLs[i].lineIdx = l_idx++;
        }
        //for(let b - b1)
    }
    //console.log('End line', line0, line1, line_delta, b1)

    const stopper = makeBlockStopper_matchingEndline(doc.blocks, b1, line_delta);
    const Bs = reprocessContent(ctx, LLs[B0.lineIdx], stopper);
    //console.log('New blocks until', line1, '+', line_delta, stopper);  blockDiag(Bs);
    if(b0 >= 0) {
        // If the previous block ends at the same line as it did previously and has the same type it must be unchanged, since it only consists of unchanged lines
        const B0_new = Bs[0];
        if (B0.type === B0_new.type && B0.lineIdx === B0_new.lineIdx && B0.logical_line_extent == B0_new.logical_line_extent) {
            Bs.shift(); // ... nothing to do with this block
            B0 = doc.blocks[++b0];
        }
    }

    return {
        range: [Math.max(b0, 0), Math.min(stopper.lastBlock + 1, doc.blocks.length)],
        newBlocks: Bs
    };
}


export function integrateBlockDelta(ctx: ParsingContext, doc: MarkiDocument, delta: IncrementalChange_Blocks) {
    const b0 = delta.range[0],  b1 = delta.range[1],  Bs = doc.blocks;
    const d_i = delta.newBlocks.length - (b1 - b0);
    let i_LL = Bs[b0].lineIdx;
    doc.blocks.splice(b0, b1 - b0, ... delta.newBlocks);
    for(let b = b0, b_e = Bs.length;  b < b_e;  ++b) {
        Bs[b].lineIdx = i_LL;
        i_LL += Bs[b].logical_line_extent;
    }
}
