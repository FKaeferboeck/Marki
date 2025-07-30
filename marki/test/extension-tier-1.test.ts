import { describe, expect, test } from 'vitest'
import { global_MDPT, MarkdownParser } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer';
import { extendTier1 } from "../src/extensions-tier-1/traits";
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard';
import { sourceInclude_traits } from '../src/extensions-tier-1/blocks/source-include';
import { MarkiDocument } from '../src/markdown-types';
import { resolve } from 'path';

extendTier1(global_MDPT, markdownRendererTraits_standard);

const parser = new MarkdownParser();
const renderer = new MarkdownRendererInstance(parser);

// Very simplistic include path resolver for testing only
sourceInclude_traits.sourceIncludeResolve = (filepath, called_from) => {
    let fp = `./test/${filepath}`;
    fp = resolve(fp);
    //console.log(`Resolve to [${fp}]`)
    return fp;
}


const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, async () => {
        const doc: MarkiDocument = {
            URL: sourceInclude_traits.sourceIncludeResolve(`Marki-UnitTest-Tier1-${idx}.sdsmd`, '') as string,
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


describe('#include', () => {
    /* A fairly complex (but realistic) scenario: An include which contains another include, which contains a link def that is referenced in the the main document;
     * It demonstrates: * Recursive includes
     *                  * That includes are performed before any inline processing
     *                  * Guarding against circular includes
     */
    doTest(1, `# Main file
Main text

#include <testinclude.sdsmd>
Afterwards, [foo]`, `<h1>Main file</h1>
<p>Main text</p>
<h1>File included</h1>
<p>Second degree</p>
<div>Could not include file: Circular include of "testinclude.sdsmd": skipping it</div>
<p>Hi there!</p>
<p>Afterwards, <a href="/url" title="This works!">foo</a></p>\n`);

        doTest(2, `Hi!\n\n#include Marki-UnitTest-Tier1-2.sdsmd`, '<p>Hi!</p>\n<div>Could not include file: Circular include of "Marki-UnitTest-Tier1-2.sdsmd": skipping it</div>\n');
});


describe('Tabular', () => {
    doTest(1, '|Head 1|Head 2|\n|-|><|-><-|-|\n|C1|C2|\nafterwards',
    '<table>\n<thead>\n  <tr><th>Head 1</th><th>Head 2</th></tr>\n</thead>\n<tbody>\n  <tr><td>C1</td><td class="c">C2</td></tr>\n</tbody>\n</table>\n<p>afterwards</p>\n');

    doTest(2, 'One ~~~two~~three~~~ four',
        '<p>One <s>~two~~three</s>~ four</p>\n');
});
