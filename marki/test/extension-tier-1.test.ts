import { describe, expect, test } from 'vitest'
import { global_MDPT, MarkdownParser, MarkdownParserTraits } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer';
import { extendTier1 } from "../src/extensions-tier-1/traits";
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard';
import { sourceInclude_traits } from '../src/extensions-tier-1/blocks/source-include';
import { MarkiDocument } from '../src/markdown-types';
import { resolve, basename, posix } from 'path';

const tier1_MDPT = new MarkdownParserTraits();
extendTier1(tier1_MDPT, markdownRendererTraits_standard);

const parser = new MarkdownParser(tier1_MDPT);
const renderer = new MarkdownRendererInstance(parser);

// Very simplistic include path resolver for testing only
// We don't use physical sub-directories here, they get simulated
sourceInclude_traits.sourceIncludeResolve = (filepath, _called_from, ifctx) => {
    filepath = posix.normalize(filepath);
    const pathOnly = posix.dirname(filepath);
    const fileOnly = basename(filepath);
    let fp = `./test/data/${fileOnly}`;
    fp = resolve(fp);

    if(posix.isAbsolute(filepath)) {
        ifctx.mode   = "absolute";
        ifctx.prefix = pathOnly;
    }
    else
        ifctx.prefix = posix.join(ifctx.prefix, pathOnly);
    return fp;
}


const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, async () => {
        const doc: MarkiDocument = {
            URL: sourceInclude_traits.sourceIncludeResolve!(`Marki-UnitTest-Tier1-${idx}.sdsmd`, '', { mode: "relative",  prefix: '' }) as string,
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
Afterwards, [foodoo]`, `<h1>Main file</h1>
<p>Main text</p>
<h1>File included</h1>
<p>Second degree</p>
<div>Could not include file: Circular include of "testinclude.sdsmd": skipping it</div>
<p>Hi there!</p>
<p>Afterwards, <a href="urloo" title="This works!">foodoo</a></p>\n`);

    doTest(2, `Hi!\n\n#include Marki-UnitTest-Tier1-2.sdsmd`, '<p>Hi!</p>\n<div>Could not include file: Circular include of "Marki-UnitTest-Tier1-2.sdsmd": skipping it</div>\n');

    /* If a Markdown file is included by a relative path that results in a different directory, we need to make sure that hyperlinks/image URLs in that included file
     * point to the correct location in the rendered HTML. Therefore the relative path resulting from the include must be prepended to all URLs.
     * This affects link definition blocks, inline links, and images.
     */
    doTest(3, `[foo]\n\n#include dir-1/dir-2-1/testinclude3.sdsmd`,
              `<p><a href="dir-1/dir-2-2/dir-3-2/index.html" title="This works!">foo</a></p>\n<p><a href="dir-1/dir-2-2/dir-3-3/index.html">direct link</a>
<img src="dir-1/dir-2-2/dir-3-3/img.gif" alt="direct img" /></p>\n`);
});


describe('Tabular', () => {
    doTest(1, '|Head 1|Head 2|\n|-|><|-><-|-|\n|C1|C2|\nafterwards',
    '<table>\n<thead>\n  <tr><th>Head 1</th><th class="c">Head 2</th></tr>\n</thead>\n<tbody>\n  <tr><td>C1</td><td class="c">C2</td></tr>\n</tbody>\n</table>\n<p>afterwards</p>\n');

    // comment lines can come inbetween table rows (in fact this was the biggest reason for developing the comment line feature in the first place)
    doTest(2, '|#|H2|\n|-|--|\n|1|AA|\n<!-- cmt\n\nline -->\n|2|BB|',
        '<table>\n<thead>\n  <tr><th>#</th><th>H2</th></tr>\n</thead>\n<tbody>\n  <tr><td>1</td><td>AA</td></tr>\n  <tr><td>2</td><td>BB</td></tr>\n</tbody>\n</table>\n')

    doTest(3, 'One ~~~two~~three~~~ four',
        '<p>One <s>~two~~three</s>~ four</p>\n');
});
