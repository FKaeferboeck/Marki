import { describe, expect, test } from 'vitest'
import { MarkdownParser, MarkdownParserTraits } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer';
import { MarkiDocument } from '../src/markdown-types';
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
        const expected_result = tableTest(myParserResult);

        expect(my_result_custom).toEqual(expected_result);
    });
}




describe('CFM table', () => {
    /*doTest( 1, 'prehead\nprehead2\n |  head *yes* | head `col2`| \n|---|--\nbody 1\n',
               '<p>prehead\nprehead2</p>\nT{H:head <em>yes</em>,head <code>col2</code>;body 1}\n');*/

    
    
    // GFM tables do not allow multiple header lines
    doTest( 1, '|h1|\n|h2|\n|-|\n|b1|',
               '<p>|h1|</p>\nT{H:h2;b1}\n');

    // GFM tables do not allow multi-line rows
    doTest( 2, '|H1a|H1b\n|-|-\n|b1|\\\n|b2|',
               'T{H:H1a,H1b;b1,\\;b2,}\n');

    // A GFM table can interrupt a paragraph
    doTest( 3, 'P\nH1\n|-|\n|B1|',
               '<p>P</p>\nT{H:H1;B1}\n');

    // .. but not other soft-continued block content
    doTest( 4, '* L1\nL2\nH1\n|-|\n|B1|',
               '<ul>\n<li>L1\nL2\nH1\n|-|\n|B1|</li>\n</ul>\n');

    // Leading and trailing |s can be ommitted from the delimiter line, but if ther is only one column, interpretation as a SETEXT header will take precedence.
    doTest( 5, '|H1|\n----\n|B1|',
               '<h2>|H1|</h2>\n<p>|B1|</p>\n');

    // There can be space surrounding cell content, including in the delimiter row
    doTest( 6, '| H1 |\n|  ----  |  \n| B1 |',
               'T{H:H1;B1}\n');
    
    // Differences in surrounding |s are fine though.
    doTest( 7, ' |H1a|H1b|H1c|  \n--|--|--\n|B1a|B1b|B1c|',
               'T{H:H1a,H1b,H1c;B1a,B1b,B1c}\n');
    
    // Headerless tables do not exist in CFM.
    doTest( 8, '--|--|--\n|B1a|B1b|B1c|',
               '<p>--|--|--\n|B1a|B1b|B1c|</p>\n');

    // Tables without body are allowed.
    doTest( 9, '|H1a|H1b|H1c|\n--|--|--',
               'T{H:H1a,H1b,H1c}\n');
    
    // Deviating numbers of columns in body rows are trimmed away or padded with empty cells, respectively.
    doTest(10, '|H1a|H1b|\n--|--\n |B1a|B1b|B1c|\n B2a',
               'T{H:H1a,H1b;B1a,B1b;B2a,}\n');
});