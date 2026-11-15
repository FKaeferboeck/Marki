import { describe, expect, test } from 'vitest'
import * as commonmark from 'commonmark';
import { global_MDPT, MarkdownParser, MarkdownParserTraits } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer';
import { MarkiDocument } from '../src/markdown-types';
import { linify } from '../src/linify';
import { extendGFM } from "../src/gfm/traits";
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard';

// comment lines are an extension feature, but there's no harm in running it through a few CommonMark tests as well to highlight the difference
const test_MDPT = new MarkdownParserTraits();
test_MDPT.makeCommentLines = true;

extendGFM(test_MDPT, markdownRendererTraits_standard);

const parser   = new MarkdownParser(test_MDPT);
const renderer = new MarkdownRendererInstance(parser);

const clearify = (s: string) => s.replace(/\t/g, '[\\t]');

function tableTest(s: string) {
    return s.replace(/T{.*}/g, table => {
        const rows = table.slice(2, table.length - 1).split(';').map(row =>
            (row.startsWith('H:') ? { header: true,   txt: `<tr>\n<th>${row.slice(2).replace(/,/g, '</th>\n<th>')}</th>\n</tr>` }
                                  : { header: false,  txt: `<tr>\n<td>${row.replace(/,/g, '</td>\n<td>')}</td>\n</tr>` }));
        let h: boolean | undefined;
        const arr: string[] = [ '<table>' ];
        for(const row of rows) {
            if(row.header !== h) {
                if(h !== undefined)
                    arr.push(h ? '</thead>' : '</tbody>');
                arr.push(row.header ? '<thead>' : '<tbody>');
                h = row.header;
            }
            arr.push(row.txt);
        }
        if(h !== undefined)
            arr.push(h ? '</thead>' : '</tbody>');
        arr.push('</table>');
        return arr.join('\n');
    });
}




export function doTest(idx: number | string, input: string, myParserResult: string) {
    test('' + idx, async () => {
        const doc: MarkiDocument = {
            URL: `Marki-UnitTest-${idx}.sdsmd`,
            title: undefined,
            input,
            LLs: [],
            blocks: [],
            localCtx: { }
        }

        await parser.processDocument(doc);

        const my_result_custom = clearify(renderer.renderAsString(doc.blocks));
        console.log(my_result_custom)

        const expected_result = tableTest(myParserResult);

        expect(my_result_custom).toEqual(expected_result);
    });
}




describe('CFM table', () => {
    doTest( 1, 'prehead\nprehead2\n |  head *yes* | head `col2`| \n|---|--\nbody 1\n',
               '<p>prehead\nprehead2</p>\nT{H:head <em>yes</em>,head <code>col2</code>;body 1}\n');
    
});