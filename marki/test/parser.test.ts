import { describe, expect, it, test } from 'vitest'
import { IncrementalChange, linify_old, linify_update, LinifyUpdateResult, spliceContent, TextPart } from '../src/parser';
import { Range } from 'vscode-languageserver';

const part = (line: number, character: number, content: string): TextPart => ({ type: "TextPart",     line,  character,  content });
const cmt0 = (line: number, character: number, content: string) => ({ type: "XML_Comment",  line,  character,  content,  continues: false });
const cmt1 = (line: number, character: number, content: string) => ({ type: "XML_Comment",  line,  character,  content,  continues: true  });
const tag0 = (line: number, character: number, content: string) => ({ type: "HTML_Tag",     line,  character,  content,  continues: false });
const tag1 = (line: number, character: number, content: string) => ({ type: "HTML_Tag",     line,  character,  content,  continues: true  });

const logl = (start: number, extent: number, type: string) => ({ start, extent, type });

const rng = (line0: number, char0: number, line1: number, char1: number): Range =>
    ({ start: { line: line0,  character: char0 },  end: { line: line1,  character: char1 } });

const upd = (start: number, removed: number, added: number): LinifyUpdateResult =>
    ({ logical_line_start: start,  logical_lines_removed: removed,  logical_lines_added: added });


function makeTestData01() {
    return [
        part(0, 0, 'AAA'),  part(1, 0, 'BBB'),  part(1, 3, 'CCC'),  part(1, 6, 'DDD'),
        part(2, 0, ''),
        part(3, 0, 'EEE')
    ];
}

test('Helper function spliceContent()', () => {
    const AA = makeTestData01();
    expect(spliceContent(AA, rng(0, 0, 0, 0), 'X')).toBe('XAAA\nBBBCCCDDD\n\nEEE');
    expect(spliceContent(AA, rng(0, 1, 0, 2), 'X')).toBe('AXA\nBBBCCCDDD\n\nEEE');
    expect(spliceContent(AA, rng(1, 4, 1, 5), 'X')).toBe('AAA\nBBBCXCDDD\n\nEEE');
    expect(spliceContent(AA, rng(1, 3, 1, 6), 'X')).toBe('AAA\nBBBXDDD\n\nEEE');
    expect(spliceContent(AA, rng(1, 2, 1, 7), 'X')).toBe('AAA\nBBXDD\n\nEEE');
    expect(spliceContent(AA, rng(1, 0, 1, 9), 'X')).toBe('AAA\nX\n\nEEE');
    expect(spliceContent(AA, rng(2, 0, 2, 0), 'X')).toBe('AAA\nBBBCCCDDD\nX\nEEE');
    expect(spliceContent(AA, rng(1, 9, 3, 0), 'X')).toBe('AAA\nBBBCCCDDDXEEE');
    expect(spliceContent(AA, rng(1, 9, 1, 9), 'X')).toBe('AAA\nBBBCCCDDDX\n\nEEE');
    expect(spliceContent(AA, rng(3, 3, 3, 3), 'X')).toBe('AAA\nBBBCCCDDD\n\nEEEX');
});


const text0 = `Hallooo!

Text1 <!-- Cmt -->Text2<!--

Cmt2-->Text3
Text4
    
<!-- Cmt3 -->

Ende`;

const text1 = `<div>
  <p class="text"
     style="color:Blue;">Erster Text</p>
  <!-- <img src="A"> -->
</div>
`

describe('Full linify()', () => {
    it('With XML comments', () => {
        const LS = linify_old(text0);
        const LS_target = {
            all: [
                part(0, 0, 'Hallooo!'),  part(1, 0, ''),  part(2, 0, 'Text1 '),  cmt0(2, 6, '<!-- Cmt -->'),  part(2, 18, 'Text2'),
                cmt1(2, 23, '<!--'),  cmt1(3, 0, ''),  cmt0(4, 0, 'Cmt2-->'),
                part(4, 7, 'Text3'),  part(5, 0, 'Text4'),  part(6, 0, '    '),  cmt0(7, 0, '<!-- Cmt3 -->'),
                part(8, 0, ''),  part(9,0, 'Ende')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 1, "empty"),  logl(2, 7, "text"),
                logl(9, 1, "text"),  logl(10, 1, "emptyish"),  logl(11, 1, "comment"),
                logl(12, 1, "empty"),  logl(13, 1, "text")
            ]
        };
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
    });

    /*it('With HTML tags', () => {
        const LS = linify(text1);
        const LS_target = {
            all: [
                tag0(0, 0, '<div>'),  part(1, 0, '  '),  tag1(1, 2, '<p class="text"'),  tag0(2, 0, '     style="color:Blue;">'),
                part(2, 25, 'Erster Text'),  tag0(2, 36, '</p>'),
                part(3, 0, '  '),  cmt0(3, 2, '<!-- <img src="A"> -->'),
                tag0(4, 0, '</div>'),  part(5, 0, '')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 5, "text"),  logl(6, 2, "comment"),  logl(8, 1, "text"),  logl(9, 1, "empty")
            ]
        };
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
    });*/
});


describe('linify_update()', () => {
    test('simple text insert', () => {
        const LS = linify_old(text0);
        const D: IncrementalChange = { range: rng(2, 20, 2, 20),  text: 'XX' };
        const delta = linify_update(LS, D);
    
        const LS_target = {
            all: [
                part(0, 0, 'Hallooo!'),  part(1, 0, ''),  part(2, 0, 'Text1 '),  cmt0(2, 6, '<!-- Cmt -->'),  part(2, 18, 'TeXXxt2'),
                cmt1(2, 25, '<!--'),  cmt1(3, 0, ''),  cmt0(4, 0, 'Cmt2-->'),
                part(4, 7, 'Text3'),  part(5, 0, 'Text4'),  part(6, 0, '    '),  cmt0(7, 0, '<!-- Cmt3 -->'),
                part(8, 0, ''),  part(9,0, 'Ende')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 1, "empty"),  logl(2, 7, "text"),
                logl(9, 1, "text"),  logl(10, 1, "emptyish"),  logl(11, 1, "comment"),
                logl(12, 1, "empty"),  logl(13, 1, "text")
            ]
        };
    
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
        expect(delta)           .toEqual(upd(2, 1, 1));
    });

    test('insert comment part', () => {
        const LS = linify_old(text0);
        const D: IncrementalChange = { range: rng(2, 20, 2, 20),  text: 'X<!-- between -->Y' };
        const delta = linify_update(LS, D);
    
        const LS_target = {
            all: [
                part(0, 0, 'Hallooo!'),  part(1, 0, ''),  part(2, 0, 'Text1 '),  cmt0(2, 6, '<!-- Cmt -->'),
                part(2, 18, 'TeX'),  cmt0(2, 21, '<!-- between -->'),  part(2, 37, 'Yxt2'),
                cmt1(2, 41, '<!--'),  cmt1(3, 0, ''),  cmt0(4, 0, 'Cmt2-->'),
                part(4, 7, 'Text3'),  part(5, 0, 'Text4'),  part(6, 0, '    '),  cmt0(7, 0, '<!-- Cmt3 -->'),
                part(8, 0, ''),  part(9,0, 'Ende')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 1, "empty"),  logl(2, 9, "text"),
                logl(11, 1, "text"),  logl(12, 1, "emptyish"),  logl(13, 1, "comment"),
                logl(14, 1, "empty"),  logl(15, 1, "text")
            ]
        };
    
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
        expect(delta)           .toEqual(upd(2, 1, 1));
    });

    test('remove comment part', () => {
        const LS = linify_old(text0);
        const D: IncrementalChange = { range: rng(2, 6, 2, 18),  text: 'XY' };
        const delta = linify_update(LS, D);
    
        const LS_target = {
            all: [
                part(0, 0, 'Hallooo!'),  part(1, 0, ''),  part(2, 0, 'Text1 XYText2'),
                cmt1(2, 13, '<!--'),  cmt1(3, 0, ''),  cmt0(4, 0, 'Cmt2-->'),
                part(4, 7, 'Text3'),  part(5, 0, 'Text4'),  part(6, 0, '    '),  cmt0(7, 0, '<!-- Cmt3 -->'),
                part(8, 0, ''),  part(9,0, 'Ende')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 1, "empty"),  logl(2, 5, "text"),
                logl(7, 1, "text"),  logl(8, 1, "emptyish"),  logl(9, 1, "comment"),
                logl(10, 1, "empty"),  logl(11, 1, "text")
            ]
        };
    
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
        expect(delta)           .toEqual(upd(2, 1, 1));
    });
});


describe('linify_update() with remainder', () => {
    it('disrupting comment start', () => {
        const LS = linify_old(text0);
        const D: IncrementalChange = { range: rng(2, 25, 2, 25),  text: ' ' };
        const delta = linify_update(LS, D);
    
        const LS_target = {
            all: [
                part(0, 0, 'Hallooo!'),  part(1, 0, ''),  part(2, 0, 'Text1 '),  cmt0(2, 6, '<!-- Cmt -->'),  part(2, 18, 'Text2<! --'),
                part(3, 0, ''),  part(4, 0, 'Cmt2-->Text3'),  part(5, 0, 'Text4'),  part(6, 0, '    '),  cmt0(7, 0, '<!-- Cmt3 -->'),
                part(8, 0, ''),  part(9,0, 'Ende')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 1, "empty"),  logl(2, 3, "text"),
                logl(5, 1, "empty"),  logl(6, 1, "text"),  logl(7, 1, "text"),  logl(8, 1, "emptyish"),
                logl(9, 1, "comment"),  logl(10, 1, "empty"),  logl(11, 1, "text")
            ]
        };
    
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
        expect(delta)           .toEqual(upd(2, 6, 8));
    });

    it('disrupting end of single-line comment', () => {
        const LS = linify_old(text0);
        const D: IncrementalChange = { range: rng(2, 16, 2, 16),  text: ' ' };
        const delta = linify_update(LS, D);
    
        const LS_target = {
            all: [
                part(0, 0, 'Hallooo!'),  part(1, 0, ''),  part(2, 0, 'Text1 '),  cmt1(2, 6, '<!-- Cmt - ->Text2<!--'),
                cmt1(3, 0, ''),  cmt0(4, 0, 'Cmt2-->'),  part(4, 7, 'Text3'),  part(5, 0, 'Text4'),  part(6, 0, '    '),  cmt0(7, 0, '<!-- Cmt3 -->'),
                part(8, 0, ''),  part(9,0, 'Ende')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 1, "empty"),  logl(2, 5, "text"),
                logl(7, 1, "text"),  logl(8, 1, "emptyish"),
                logl(9, 1, "comment"),  logl(10, 1, "empty"),  logl(11, 1, "text")
            ]
        };
    
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
        expect(delta)           .toEqual(upd(2, 6, 6));
    });

    it('disrupting end of multi-line comment', () => {
        const LS = linify_old(text0);
        const D: IncrementalChange = { range: rng(4, 5, 4, 5),  text: ' ' };
        const delta = linify_update(LS, D);
    
        const LS_target = {
            all: [
                part(0, 0, 'Hallooo!'),  part(1, 0, ''),  part(2, 0, 'Text1 '),  cmt0(2, 6, '<!-- Cmt -->'),  part(2, 18, 'Text2'),
                cmt1(2, 23, '<!--'),  cmt1(3, 0, ''),
                cmt1(4, 0, 'Cmt2- ->Text3'),  cmt1(5, 0, 'Text4'),  cmt1(6, 0, '    '),  cmt0(7, 0, '<!-- Cmt3 -->'),
                part(8, 0, ''),  part(9,0, 'Ende')
            ],
            logical_lines: [
                logl(0, 1, "text"),  logl(1, 1, "empty"),  logl(2, 9, "text"),
                logl(11, 1, "empty"),  logl(12, 1, "text")
            ]
        };
    
        expect(LS.all)          .toEqual(LS_target.all);
        expect(LS.logical_lines).toEqual(LS_target.logical_lines);
        expect(delta)           .toEqual(upd(2, 6, 3));
    });
});
