import { describe, expect, test } from 'vitest'
import { MarkdownParser } from '../src/markdown-parser';
import { Renderer } from '../src/renderer/renderer';
import { extendTier1 } from '../src/extensions-tier-1/blocks/traits';

const parser = new MarkdownParser();
const renderer = new Renderer();

extendTier1(parser, renderer);

const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

export function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, () => {
        const blocks = parser.processDocument(input);
        const my_result = clearify(renderer.referenceRender(blocks));

        expect(my_result).toEqual(expectation);
    });
}


describe('Tabular', () => {
    doTest(1, '|Head 1|Head 2|\n|=|><|=><=|=|\n|C1|C2|\nafterwards', '');

});
