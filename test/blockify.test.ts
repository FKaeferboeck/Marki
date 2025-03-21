import { describe, expect, it, test } from 'vitest'
import { linify } from '../src/parser';
import { AnyBlock, Block, BlockBase_Container, BlockType, isContainer } from '../src/markdown-types';
import { lineDataAll } from '../src/util';
import { MarkdownParser } from '../src/markdown-parser';

interface ResultMakerItem {
    type:      BlockType;
    extent:    number;
    extra?:    Record<string, any>;
    contents?: ResultMakerItem[];
}

const blk = (type: BlockType, extent: number, extra?: Record<string, any>) => ({ type, extent, extra });
const par = (extent: number = 1) => blk("paragraph",  extent);
const spc = (extent: number = 1) => blk("emptySpace", extent);
const cnt = (type: BlockType, extent: number, contents: ResultMakerItem[], extra?: Record<string, any>) => ({ type, extent, contents, extra });

function resultMaker(input: ResultMakerItem[], i: number = 0) {
    return input.map(I => {
        const X = { type: I.type,  range: [ i, I.extent ], ... (I.extra || {}) };
        if(I.contents)
            (X as any).blocks = resultMaker(I.contents, i);
        i += I.extent;
        return X;
    });
}


const ignored_props = { type: true,  logical_line_start: true,  logical_line_extent: true,  contents: true };

function blocks_check(blocks: AnyBlock[]) {
    return blocks.map(B => {
        const X = { type: B.type,  range: [ B.logical_line_start, B.logical_line_extent ] };
        for(const k of Object.keys(B).filter(k => !ignored_props[k]))
            X[k] = B[k];
        if(isContainer(B) && B.blocks.length > 0)
            (X as any).blocks = blocks_check(B.blocks);
        return X;
    });
}

const parser = new MarkdownParser();


function doTest(title: string, input: string, target_: { type: BlockType,  extent: number }[], verbose?: boolean) {
    test(title, () => {
        parser.diagnostics = verbose || false;
        const LS      = linify(input);
        const LLD     = lineDataAll(LS, 0);
        const target  = resultMaker(target_);
        const blocks  = parser.processContent(LLD);
        const blocks_ = blocks_check(blocks);
        if(verbose) {
            console.log(blocks)
            blocks.forEach((B, i) => { if("blocks" in B)    console.log(`Content blocks of [${i}]:`, B.blocks); });
        }
        expect(blocks_).toMatchObject(target);
    });
}


doTest('basic paragraphs', 'First paragraph\n\nSecond\n   paragraph\n\n\nThird',
       [ par(),  spc(),  par(2),  spc(2),  par() ]);


/*doTest('indented code blocks',
    `    C1a\n\n    C1c\nP1a\n    P1b\n\n    C2a\n\nP2a\n\n    C3\n`,
    [ blk("indentedCodeBlock", 3),  par(2),  spc(),
      blk("indentedCodeBlock", 1),  spc(),  par(),  spc(),
      blk("indentedCodeBlock", 1),  spc()
    ]);


doTest('setext headings',
    `Headline\nsecond line\n==========  \nA paragraph\n===X\n\nHeader 2\n   -\n===`,
    [ blk("sectionHeader_setext", 3, { level: 1 }),  par(2),  spc(),  blk("sectionHeader_setext", 2, { level: 2 }),  par() ]);


doTest('ATX headings',
    `paragraph\n# H1\n##p\n   ####\n###### H6 ###`,
    [ par(),  blk("sectionHeader", 1, { level: 1 }),  par(),  blk("sectionHeader", 1, { level: 4 }), blk("sectionHeader", 1, { level: 6 }) ]);


doTest('thematic breaks',
    'P1\n***\n   -  - - ---   \n__\n___\nP3\n----',
    [ par(1),  blk("thematicBreak", 1, { ruleType: "*" }),  blk("thematicBreak", 1, { ruleType: "-" }),
      par(1),  blk("thematicBreak", 1, { ruleType: "_" }),
      blk("sectionHeader_setext", 2, { level: 2 })
    ]);


doTest('block quotes', '> Q1a\n>Q1b\nQ1c\n\n>Q2a\nQ2b\n===\n\n>Q3a\n>===\n>Q3c\n>---\npara\n\n>Q4a\nQ4b\n>===',
    [ cnt("blockQuote", 3, [ par(3) ]),
      spc(),
      cnt("blockQuote", 2, [ par(2) ]),
      par(1), spc(),
      cnt("blockQuote", 4, [ blk("sectionHeader_setext", 2, { level: 1 }),  blk("sectionHeader_setext", 2, { level: 2 }) ]),
      par(1),  spc(),
      cnt("blockQuote", 3, [ blk("sectionHeader_setext", 3, { level: 1 }) ]),
    ]);


doTest('list item', '* L1\n\n  L2\nL3\n  L4\n\nP',
    [ blk("listItem", 5),  spc(),  par(1)
    ], true);*/