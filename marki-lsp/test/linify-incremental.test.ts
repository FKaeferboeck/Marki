import { describe, it, expect, test } from "vitest";
import { IncrementalChange, linify, LogicalLine_emptyish, LogicalLine_text, LogicalLine_with_cmt } from "marki";
import { spliceIncrementalChange } from "../src/linify";

const test_input = [`Line 1
Line 2
Line 3`];


function ch(line0: number, col0: number, line1: number, col1: number, insert_txt: string): IncrementalChange {
    return { range: { start: { line: line0,  character: col0 },  end: { line: line1,  character: col1 } },  text: insert_txt };
}

const X = (content: string): LogicalLine_text => ({ type: "text",  content,  prefix: '',  indent: 0,  lineIdx: -1 });
const E = (): LogicalLine_emptyish => ({ type: "empty",  indent: 0,  lineIdx: -1 });

const doTest = (idx: number, input: number, change: IncrementalChange,
    chk_startIdx: number | [number, number], ... chk_LLs: LogicalLine_with_cmt[]) => {
    test(idx.toString(), () => {
        const input_idx = 0
        const LLs = linify(test_input[input_idx], true);
        const {range, newLines} = spliceIncrementalChange(LLs, change);
        //console.log(newLines)
        if(typeof chk_startIdx === "number")
            chk_startIdx = [ chk_startIdx, chk_startIdx + 1]
        expect(range).toEqual(chk_startIdx);
        chk_LLs.forEach((LL, i) => LL.lineIdx = (chk_startIdx as [number, number])[0] + i); // set line indexes for comparison
        expect(newLines).toEqual(chk_LLs);
    });
};


describe("Standard line handling", () => {
    doTest( 1, 0, ch(1, 2, 1, 2, 'X'), 1, X('LiXne 2'));
    doTest( 2, 0, ch(1, 0, 1, 0, 'X'), 1, X('XLine 2'));
    doTest( 3, 0, ch(1, 2, 1, 3, 'X'), 1, X('LiXe 2'));
    doTest( 4, 0, ch(1, 2, 1, 6, 'X'), 1, X('LiX'));
    doTest( 5, 0, ch(1, 0, 1, 6, 'X'), 1, X('X'));
    
    // Adding new line
    doTest( 6, 0, ch(0, 6, 0, 6, '\n'), 0, X('Line 1'), E()); // cursor on end of line
    doTest( 7, 0, ch(1, 0, 1, 0, '\n'), 1, E(), X('Line 2')); // cursor on start of line
    doTest( 8, 0, ch(2, 6, 2, 6, '\n'), 2, X('Line 3'), E()); // cursor at EOF

    // splitting line
    doTest( 9, 0, ch(1, 2, 1, 2, '\n'), 1, X('Li'), X('ne 2'));

    // deleting newline
    doTest(10, 0, ch(0, 6, 1, 0, ''), [0, 2], X('Line 1Line 2'));
});
