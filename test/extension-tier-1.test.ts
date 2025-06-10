import { describe, expect, test } from 'vitest'
import { MarkdownParser } from '../src/markdown-parser';
import { EasyInserter, Inserter, Renderer } from '../src/renderer/renderer';
import { extendTier1 } from '../src/extensions-tier-1/blocks/traits';
import { markdown_tabular_traits, MarkdownTabularRow } from '../src/extensions-tier-1/blocks/table';
import { Block_Extension } from '../src/markdown-types';
import { castExtensionBlock } from '../src/traits';


const parser = new MarkdownParser();
const renderer = new Renderer();

extendTier1.call(parser);


function printTableRow(R: MarkdownTabularRow, I: Inserter, header: boolean) {
    const I1 = new EasyInserter();
    I1.add('  <tr>');
    const open = (header ? '<th>' : '<td>'), close = (header ? '</th>' : '</td>');
    {
        I1.add(open);
        I1.add(R.txt);
        I1.add(close);
    }
    I1.add('</tr>');
    I.add(I1.join(''));
}


renderer.blockHandler["ext_tier1_table"] = (B: Block_Extension, I) => {
    if(!castExtensionBlock(B, markdown_tabular_traits))    return;
    I.add(`<table>`);
    if(B.tableHead.length > 0) {
        I.add('<thead>');
        for(const R of B.tableHead)
            printTableRow(R, I, true);
        I.add('</thead>');
    }
    if(B.tableBody.length > 0) {
        I.add('<tbody>');
        for(const R of B.tableBody)
            printTableRow(R, I, false);
        I.add('</tbody>');
    }
    //I.add(`<p>${renderer.renderBlockContent(B, null, "trimmed")}</p>`),
    I.add('</table>');
};

const clearify = (s: string) => s.replaceAll('\t', '[\\t]');

export function doTest(idx: number | string, input: string, expectation: string) {
    test('' + idx, () => {
        const blocks = parser.processDocument(input);
        const my_result = clearify(renderer.referenceRender(blocks));

        expect(my_result).toEqual(expectation);
    });
}


describe('Tabular', () => {
    doTest(1, '|H1|H2|\n|=|=|\n|C1|C2|\nafterwards', '');

});