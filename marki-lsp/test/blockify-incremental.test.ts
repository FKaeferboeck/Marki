import { describe, expect, test } from "vitest";
import { BlockType, IncrementalChange, IncrementalChange_LL, linify, LogicalLine_emptyish, LogicalLine_text, LogicalLine_with_cmt, MarkdownParser, MarkdownParserTraits, MarkdownRendererInstance, MarkiDocument } from "marki";
import { blockDiag, incrementalBlockChange, spliceIncrementalChange } from "../src/linify";

// comment lines are an extension feature, but there's no harm in running it through a few CommonMark tests as well to highlight the difference
const test_MDPT = new MarkdownParserTraits();
test_MDPT.makeCommentLines = true;

const parser                  = new MarkdownParser();
const parser_withCommentLines = new MarkdownParser(test_MDPT);

const renderer = new MarkdownRendererInstance(parser);

const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

interface BlockifyIncrementalResult {
    range:  [number, number];
    blocks: [BlockType, number][];
}

function B(start_line: number, end_line: number, ... args: (BlockType|number)[]) {
    const res: BlockifyIncrementalResult = { range: [start_line, end_line],  blocks: [] };
    for(let i = 0;  i < args.length;  ++i) {
        if (typeof args[i] !== "string")
            continue;
        const b = [args[i], 1] as [BlockType, number];
        if (i + 1 < args.length && typeof args[i + 1] === "number")
            b[1] = args[++i] as number;
        res.blocks.push(b);
    }
    return res;
}

function ch(line0: number, col0: number, line1: number, col1: number, insert_txt: string): IncrementalChange {
    return { range: { start: { line: line0,  character: col0 },  end: { line: line1,  character: col1 } },  text: insert_txt };
}

const X = (content: string): LogicalLine_text => ({ type: "text",  content,  prefix: '',  indent: 0,  lineIdx: -1 });
const E = (): LogicalLine_emptyish => ({ type: "empty",  indent: 0,  lineIdx: -1 });

const test_input = [`Para 1

> Quote 1
Quote 2

Para 2`,
// input[1]
`    Code 1
X
    Code 2
Para 1

Para 2`];


export function doTest(idx: number | string, input_idx: number, change: IncrementalChange, tgt: BlockifyIncrementalResult, info?: boolean) {
    test('' + idx, async () => {
        const doc: MarkiDocument = {
            URL: `Marki-UnitTest-${idx}.sdsmd`,
            title: undefined,
            input: test_input[input_idx],
            LLs: [],
            blocks: [],
            localCtx: { }
        }
        await parser.processDocument(doc);
        //console.log(doc.input);  blockDiag(doc.blocks)

        const IC_LL = spliceIncrementalChange(doc.LLs, change);
        const IC_B  = incrementalBlockChange(parser, doc, IC_LL);
        if (info) {
            console.log(doc.LLs)
            console.log(IC_B);
        }
        const res: BlockifyIncrementalResult = { range: IC_B.range,  blocks: [] };
        for(const B of IC_B.newBlocks) {
            res.blocks.push([B.type, B.logical_line_extent]);
        }
        expect(res).toEqual(tgt);
    });
}


describe("Standard line handling", () => {
    doTest( 1, 0, ch(3, 2, 3, 2, 'X'),    B(2, 3, "blockQuote", 2));
    doTest( 2, 0, ch(3, 3, 3, 3, '\n'),   B(2, 3, "blockQuote", 3));
    doTest( 3, 0, ch(4, 0, 4, 0, '>'),    B(2, 4, "blockQuote", 3));

    doTest( 4, 1, ch(1, 0, 1, 0, '    '), B(0, 2, "indentedCodeBlock", 3, "paragraph", 1));
    doTest( 5, 1, ch(0, 0, 0, 0, '```\n'), B(0, 4, "fenced", 7)); // open block closed by EOF
});
