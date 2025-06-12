import { describe, expect, test } from 'vitest'
import { MarkdownParser } from '../src/markdown-parser';
import { Renderer } from '../src/renderer/renderer';
import { extendTier2 } from '../src/extensions-tier-2/traits';

const parser = new MarkdownParser();
const renderer = new Renderer();

extendTier2(parser, renderer);

const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

export function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, () => {
        const blocks = parser.processDocument(input);
        const my_result = clearify(renderer.referenceRender(blocks));

        expect(my_result).toEqual(expectation);
    });
}


describe('Styling', () => {
    doTest(1, 'A paragraph $c1{with *style* content}, does this work?',
              '<p>A paragraph <span class="style-1">with <em>style</em> content</span>, does this work?</p>\n');

});
