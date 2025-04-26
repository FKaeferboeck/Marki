import { describe, expect, it, test } from 'vitest'
import { linify } from '../src/parser';
import { lineDataAll } from '../src/util';
import * as commonmark from 'commonmark';
import { collectLists, listItem_traits } from '../src/blocks/listItem';
import { MarkdownParser } from '../src/markdown-parser';
import { standardBlockParserTraits } from '../src/block-parser';
import { sourceInclude_traits } from '../src/extensions/blocks/source-include';
import { Renderer } from '../src/renderer/renderer';


// As of 2025-03-12 Vitest suddenly isn't able any more to import listItem on its own. Luckily we can repair it like this.
standardBlockParserTraits.listItem = listItem_traits;

const parser = new MarkdownParser();

parser.traitsList["ext_standard_sourceInclude"] = sourceInclude_traits as any;
parser.tryOrder.splice(parser.tryOrder.findIndex(v => v === "paragraph"), 0, "ext_standard_sourceInclude");

const renderer = new Renderer();

renderer.blockHandler["ext_standard_sourceInclude"] = (B_, I) => {
    //const B = B_ as 
    I.add(`<include ${'??'}>`);
};


function doTest2(idx: number | string, input: string, verbose = false) {
    test('' + idx, () => {
        const LS   = linify(input);
        const LLD  = lineDataAll(LS, 0);
        
        //const diag = false;
        const diag = verbose;
        parser.reset();
        parser.diagnostics = diag;
        const blocks = parser.processContent(LLD);
        collectLists(blocks, diag);
        blocks.forEach(B => parser.processBlock(B));
        const my_result = renderer.referenceRender(blocks, diag);
        if(verbose)
            console.log(blocks)

        expect(my_result).toEqual('<include mysource.mkd>');
    });
}


describe('Source include', () => {
    doTest2( 1,   '#include mysource.mkd');

});

