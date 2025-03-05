import { describe, expect, it, test } from 'vitest'
import { lineDataAll, MarkdownParser } from '../src/block-parser';
import { linify } from '../src/parser';
import { BlockType } from '../src/markdown-types';


const blk = (type: BlockType, extent: number, extra?: Record<string, any>) => ({ type, extent, extra });

function resultMaker(input: { type: BlockType,  extent: number,  extra?: Record<string, any> }[]) {
    let i = 0;
    return input.map(I => {
        const X = { type: I.type,  range: [ i, I.extent ], ... (I.extra || {}) };
        i += I.extent;
        return X;
    });
}


const parser = new MarkdownParser();

const ignored_props = { type: true,  logical_line_start: true,  logical_line_extent: true,  contents: true };

function doTest(title: string, input: string, target_: { type: BlockType,  extent: number }[], verbose?: boolean) {
    test(title, () => {
        parser.diagnostics = verbose || false;
        const LS           = linify(input);
        const LLD          = lineDataAll(LS, 0);
        const target       = resultMaker(target_);
        const blocks       = parser.processContent(LLD);
        const blocks_check = blocks.map(B => {
            const X = { type: B.type,  range: [ B.logical_line_start, B.logical_line_extent ] };
            for(const k of Object.keys(B).filter(k => !ignored_props[k]))
                X[k] = B[k];
            return X;
        });
        if(verbose)
            console.log(blocks)
        expect(blocks_check).toMatchObject(target);
    });
}


doTest('basic paragraphs', 'First paragraph\n\nSecond\n   paragraph\n\n\nThird',
       [ blk("paragraph", 1),  blk("emptySpace", 1),  blk("paragraph", 2),  blk("emptySpace", 2),  blk("paragraph", 1) ]);


doTest('setext header',
    `Headline\nsecond line\n==========  \nA paragraph\n===X\n\nHeader 2\n   -`,
    [ blk("sectionHeader_setext", 3, { level: 1 }),  blk("paragraph", 2),  blk("emptySpace", 1),  blk("sectionHeader_setext", 2, { level: 2 }) ]);
