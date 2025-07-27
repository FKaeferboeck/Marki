import { describe, expect, test } from 'vitest'
import { MarkdownParser } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer';
import { extendTier1 } from "../src/extensions-tier-1/traits";

const parser = new MarkdownParser();
const renderer = new MarkdownRendererInstance(parser);

extendTier1(parser.MDPT, renderer);

const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

export function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, async () => {
        const blocks = await parser.processDocument(input);
        const my_result = clearify(renderer.referenceRender(blocks));

        expect(my_result).toEqual(expectation);
    });
}


describe('Tabular', () => {
    doTest(1, '|Head 1|Head 2|\n|=|><|=><=|=|\n|C1|C2|\nafterwards', '');

});
