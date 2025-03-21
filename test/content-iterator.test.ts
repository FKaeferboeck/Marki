import { describe, expect, it, test } from 'vitest'
import { LinePart, linify } from '../src/parser';
import { AnyBlock, AnyInline, Block, BlockBase_Container, BlockType, InlinePos, isContainer } from '../src/markdown-types';
import { BlockContentIterator, contentSlice, lineDataAll, makeBlockContentIterator, makeInlinePos } from '../src/util';
import { MarkdownParser } from '../src/markdown-parser';
import { codeSpan_traits } from '../src/inline/code-span';
import { IndentedCodeBlock } from '../src/blocks/indentedCodeBlock';


const parser = new MarkdownParser();


function doTest(title: string, input: string) {
    test(title, () => {
        const LS      = linify(input);
        const LLD     = lineDataAll(LS, 0);

        let It = makeBlockContentIterator(LLD);
        const checkpoint = makeInlinePos(LLD), checkpoint1 = makeInlinePos(LLD);
        //expect(blocks_).toMatchObject(target);
        let s: false | string = false;

        It = makeBlockContentIterator(LLD);
        let s1: false | string | LinePart = false;
        let buf: (string | AnyInline)[] = [];

        while(s1 = It.nextItem()) {

            if(s1 === '`') {
                It.setCheckPointAtPrev(checkpoint1);
                const elt = codeSpan_traits.parse(It);
                if(elt) {
                    const flush = contentSlice(checkpoint, checkpoint1, false);
                    if(flush)
                        buf.push(flush);
                    buf.push(elt);
                    It.setCheckPoint(checkpoint);
                    continue;
                }
            }
        }
        const flush = contentSlice(checkpoint, It.pos, false);
        if(flush)
            buf.push(flush);

        //console.log(`[${buf.join('')}]`);
        console.log(buf);
    });
}


doTest('first test', 'Hallo\nThis is `` se`c<! -- cmt -->ond `` content');
