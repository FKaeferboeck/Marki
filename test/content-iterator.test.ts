import { describe, expect, it, test } from 'vitest'
import { linify } from '../src/parser';
import { lineDataAll } from '../src/util';
import { MarkdownParser } from '../src/markdown-parser';
import { AnyInline } from '../src/markdown-types';
import { referenceRenderInline } from '../src/renderer/referenceRenderer'
import * as commonmark from 'commonmark';


const parser = new MarkdownParser();
parser.makeStartCharMap();

var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();


function doTest(idx: number | string, input: string, verbose = false) {
    test('' + idx, () => {
        const LS   = linify(input);
        const LLD  = lineDataAll(LS, 0);
        
        const data = parser.processInline(LLD);
        const rendered = referenceRenderInline(data);
        if(verbose)
            console.log(data);

        const commonmark_parsed = commonmark_reader.parse(input);
        const commonmark_result = commonmark_writer.render(commonmark_parsed) as string;
        if(verbose)
            console.log('CommonMark:', commonmark_result);
        expect(rendered).toEqual(commonmark_result);
    });
}


describe('Inline: Code spans', () => {
    doTest(327, '`hi`lo`');
    doTest(328, '`foo`');
    doTest(329, '`` foo ` bar ``');
    doTest(330, '` `` `');
    doTest(331, '`  ``  `');
    doTest(332, '` a`');
    doTest(333, '`\u00A0b\u00A0`'); // unicode whitespace
    doTest(334, '` `\n`  `');
    doTest(335, '``\nfoo\nbar  \nbaz\n``');
    doTest(336, '``\nfoo \n``');
    doTest(337, '`foo   bar \nbaz`');
    doTest(338, '`foo\`bar`');
    doTest(339, '``foo`bar``');
    doTest(340, '` foo `` bar `');
    doTest(341, '*foo`*`');
    doTest(342, '[not a `link](/foo`)');
    doTest(343, '`<a href="`">`');
    doTest(344, '<a href="`">`');
    doTest(345, '`<https://foo.bar.`baz>`');
    //doTest(346, '<https://foo.bar.`baz>`');
    doTest(347, '```foo``');
    doTest(348, '`foo');
    doTest(349, '`foo``bar``');
});
