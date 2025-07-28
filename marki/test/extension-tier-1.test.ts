import { describe, expect, test } from 'vitest'
import { global_MDPT, MarkdownParser } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer';
import { extendTier1 } from "../src/extensions-tier-1/traits";
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard';

extendTier1(global_MDPT, markdownRendererTraits_standard);

const parser = new MarkdownParser();
const renderer = new MarkdownRendererInstance(parser);


const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

export function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, async () => {
        const blocks = await parser.processDocument(input);
        const my_result = clearify(renderer.referenceRender(blocks));

        expect(my_result).toEqual(expectation);
    });
}


describe('Tabular', () => {
    doTest(1, '|Head 1|Head 2|\n|-|><|-><-|-|\n|C1|C2|\nafterwards',
    '<table>\n<thead>\n  <tr><th>Head 1</th><th>Head 2</th></tr>\n</thead>\n<tbody>\n  <tr><td>C1</td><td class="c">C2</td></tr>\n</tbody>\n</table>\n<p>afterwards</p>\n');

    doTest(2, 'One ~~~two~~three~~~ four',
        '<p>One <s>~two~~three</s>~ four</p>\n');
});
