import { describe, it, expect } from "vitest";
import { linify, LogicalLine, LogicalLine_comment, sliceLine } from "../src/linify";

const text0 = `Hallooo!

Text1 <!-- Cmt -->Text2<!--

Cmt2-->Text3
Text4
 \t  
<!-- Cmt3 -->

Ende
<!-- Arg

in Cmt
--> <!--
-->  
<!-- cmt5 -->
<!-- -->Q<!--
-->
   <!-- indented cmt -->
   <!-- indented
cmt -->`;


describe('Full linify()', () => {
    it('Without XML comments', () => {
        const LS = linify(text0, false);
        const expected: LogicalLine[] = [
            { type: "text",     start:  0, indent: 0, prefix: '', content: 'Hallooo!' },
            { type: "empty",    start:  1, indent: 0 },
            { type: "text",     start:  2, indent: 0, prefix: '', content: 'Text1 <!-- Cmt -->Text2<!--' },
            { type: "empty",    start:  3, indent: 0 },
            { type: "text",     start:  4, indent: 0, prefix: '', content: 'Cmt2-->Text3' },
            { type: "text",     start:  5, indent: 0, prefix: '', content: 'Text4' },
            { type: "emptyish", start:  6, indent: 6, prefix: ' \t  ' },
            { type: "text",     start:  7, indent: 0, prefix: '', content: '<!-- Cmt3 -->' },
            { type: "empty",    start:  8, indent: 0 },
            { type: "text",     start:  9, indent: 0, prefix: '', content: 'Ende' },
            { type: "text",     start: 10, indent: 0, prefix: '', content: '<!-- Arg' },
            { type: "empty",    start: 11, indent: 0 },
            { type: "text",     start: 12, indent: 0, prefix: '', content: 'in Cmt' },
            { type: "text",     start: 13, indent: 0, prefix: '', content: '--> <!--' },
            { type: "text",     start: 14, indent: 0, prefix: '', content: '-->  ' },
            { type: "text",     start: 15, indent: 0, prefix: '', content: '<!-- cmt5 -->' },
            { type: "text",     start: 16, indent: 0, prefix: '', content: '<!-- -->Q<!--' },
            { type: "text",     start: 17, indent: 0, prefix: '', content: '-->' },
            { type: "text",     start: 18, indent: 3, prefix: '   ', content: '<!-- indented cmt -->' },
            { type: "text",     start: 19, indent: 3, prefix: '   ', content: '<!-- indented' },
            { type: "text",     start: 20, indent: 0, prefix: '', content: 'cmt -->' }
        ];
        expect(LS).toStrictEqual(expected);
    });

    it('With XML comments', () => {
        const LS = linify(text0, true);
        const expected: LogicalLine[] = [
            { type: "text",     start:  0, indent: 0, prefix: '', content: 'Hallooo!' },
            { type: "empty",    start:  1, indent: 0 },
            { type: "text",     start:  2, indent: 0, prefix: '', content: 'Text1 <!-- Cmt -->Text2<!--' },
            { type: "empty",    start:  3, indent: 0 },
            { type: "text",     start:  4, indent: 0, prefix: '', content: 'Cmt2-->Text3' },
            { type: "text",     start:  5, indent: 0, prefix: '', content: 'Text4' },
            { type: "emptyish", start:  6, indent: 6, prefix: ' \t  ' },
            { type: "comment",  start:  7, content: [ '<!-- Cmt3 -->' ] },
            { type: "empty",    start:  8, indent: 0 },
            { type: "text",     start:  9, indent: 0, prefix: '', content: 'Ende' },
            { type: "comment",  start: 10, content: [ '<!-- Arg', '', 'in Cmt', '--> <!--', '-->  ' ] },
            { type: "comment",  start: 15, content: [ '<!-- cmt5 -->' ] },
            { type: "text",     start: 16, indent: 0, prefix: '', content: '<!-- -->Q<!--' },
            { type: "text",     start: 17, indent: 0, prefix: '', content: '-->' },
            { type: "text",     start: 18, indent: 3, prefix: '   ', content: '<!-- indented cmt -->' }, // not a comment because indented
            { type: "text",     start: 19, indent: 3, prefix: '   ', content: '<!-- indented' }, // not a comment because first line indented
            { type: "text",     start: 20, indent: 0, prefix: '', content: 'cmt -->' }
        ];
        expect(LS).toStrictEqual(expected);
    });

    it('Slice logical lines: empty', () => {
        const LL: LogicalLine = { type: "empty", start: 101, indent: 0 };
        expect(sliceLine(LL, 5)).toStrictEqual({ type: "empty", start: 101, indent: 0, shiftCol: 5, parent: LL });
    });

    it('Slice logical lines: emptyish', () => {
        const LL: LogicalLine = { type: "emptyish", start: 101, indent: 6,  prefix: '  \t  ' };
        expect(sliceLine(LL, 0)).toStrictEqual({ type: "emptyish", start: 101, indent: 6,  prefix: '  \t  ', shiftCol: 0, parent: LL });
        expect(sliceLine(LL, 1)).toStrictEqual({ type: "emptyish", start: 101, indent: 5,  prefix:  ' \t  ', shiftCol: 1, parent: LL });
        expect(sliceLine(LL, 3)).toStrictEqual({ type: "emptyish", start: 101, indent: 3,  prefix:   '\t  ', shiftCol: 3, parent: LL });
        expect(sliceLine(LL, 4)).toStrictEqual({ type: "emptyish", start: 101, indent: 2,  prefix:     '  ', shiftCol: 4, parent: LL });
        expect(sliceLine(LL, 6)).toStrictEqual({ type: "empty",    start: 101, indent: 0,                    shiftCol: 6, parent: LL });
    });

    it('Slice logical lines: text', () => {
        const LL: LogicalLine = { type: "text", start: 101, indent: 6,  prefix: '  \t  ',  content: 'ABC \t  DEF \t' };
        expect(sliceLine(LL,  0)).toStrictEqual({ type: "text",     start: 101, indent: 6, prefix: '  \t  ',  content: 'ABC \t  DEF \t', shiftCol:  0, parent: LL });
        expect(sliceLine(LL,  3)).toStrictEqual({ type: "text",     start: 101, indent: 3, prefix:   '\t  ',  content: 'ABC \t  DEF \t', shiftCol:  3, parent: LL });
        expect(sliceLine(LL,  6)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:       '',  content: 'ABC \t  DEF \t', shiftCol:  6, parent: LL });
        expect(sliceLine(LL,  7)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:       '',  content:  'BC \t  DEF \t', shiftCol:  7, parent: LL });
        expect(sliceLine(LL,  9)).toStrictEqual({ type: "text",     start: 101, indent: 5, prefix:  ' \t  ',  content:         'DEF \t', shiftCol:  9, parent: LL });
        expect(sliceLine(LL, 11)).toStrictEqual({ type: "text",     start: 101, indent: 3, prefix:   '\t  ',  content:         'DEF \t', shiftCol: 11, parent: LL });
        expect(sliceLine(LL, 14)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:       '',  content:         'DEF \t', shiftCol: 14, parent: LL });
        expect(sliceLine(LL, 15)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:       '',  content:          'EF \t', shiftCol: 15, parent: LL });
        expect(sliceLine(LL, 17)).toStrictEqual({ type: "emptyish", start: 101, indent: 3, prefix: ' \t',                                shiftCol: 17, parent: LL });
        expect(sliceLine(LL, 19)).toStrictEqual({ type: "emptyish", start: 101, indent: 1, prefix:  '\t',                                shiftCol: 19, parent: LL });
        expect(sliceLine(LL, 20)).toStrictEqual({ type: "empty",    start: 101, indent: 0,                                               shiftCol: 20, parent: LL });
        expect(sliceLine(LL, 30)).toStrictEqual({ type: "empty",    start: 101, indent: 0,                                               shiftCol: 30, parent: LL });
    });

    it('Slice logical lines: text slice', () => {
        const LL: LogicalLine = { type: "text", start: 101, indent: 6,  prefix: '  \t  ',  content: 'ABC \t  DEF \t' };
        let LL1 = sliceLine(LL, 0), LL0 = LL1;
        expect(LL1 = sliceLine(LL0 = LL1, 3)).toStrictEqual({ type: "text",     start: 101, indent: 3, prefix:  '\t  ',  content: 'ABC \t  DEF \t', shiftCol:  3, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 3)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:      '',  content: 'ABC \t  DEF \t', shiftCol:  6, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 1)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:      '',  content:  'BC \t  DEF \t', shiftCol:  7, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 2)).toStrictEqual({ type: "text",     start: 101, indent: 5, prefix: ' \t  ',  content:         'DEF \t', shiftCol:  9, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 2)).toStrictEqual({ type: "text",     start: 101, indent: 3, prefix:  '\t  ',  content:         'DEF \t', shiftCol: 11, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 3)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:      '',  content:         'DEF \t', shiftCol: 14, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 1)).toStrictEqual({ type: "text",     start: 101, indent: 0, prefix:      '',  content:          'EF \t', shiftCol: 15, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 2)).toStrictEqual({ type: "emptyish", start: 101, indent: 3, prefix: ' \t',                               shiftCol: 17, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 2)).toStrictEqual({ type: "emptyish", start: 101, indent: 1, prefix:  '\t',                               shiftCol: 19, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 1)).toStrictEqual({ type: "empty",    start: 101, indent: 0,                                              shiftCol: 20, parent: LL0 });
        expect(LL1 = sliceLine(LL0 = LL1, 9)).toStrictEqual({ type: "empty",    start: 101, indent: 0,                                              shiftCol: 29, parent: LL0 });
    });
});
