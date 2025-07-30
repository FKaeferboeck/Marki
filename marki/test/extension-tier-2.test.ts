import { describe, expect, test } from 'vitest'
import { global_MDPT, MarkdownParser } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer';
import { extendTier2 } from '../src/extensions-tier-2/traits';
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard';
import { MarkiDocument } from '../src/markdown-types';

extendTier2(global_MDPT, markdownRendererTraits_standard);

const parser = new MarkdownParser();
const renderer = new MarkdownRendererInstance(parser);

const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, async () => {
        const doc: MarkiDocument = {
            URL: `Marki-UnitTest-${idx}.sdsmd`,
            title: undefined,
            input,
            blocks: [],
            localCtx: { }
        }
        await parser.processDocument(doc);
        const my_result = clearify(renderer.referenceRender(doc.blocks));

        expect(my_result).toEqual(expectation);
    });
}


describe('Styling', () => {
    doTest(1, 'A paragraph $c1{with *style* content}, does this work?',
              '<p>A paragraph <span class="style-1">with <em>style</em> content</span>, does this work?</p>\n');

});
