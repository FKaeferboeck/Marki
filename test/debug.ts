import { linify } from '../src/parser.js';
import { lineDataAll } from '../src/util.js';
import { MarkdownParser } from '../src/markdown-parser.js';
import { collectLists } from '../src/blocks/listItem.js';
import { Renderer } from '../src/renderer/renderer.js';
import { pairUpDelimiters } from '../src/delimiter-processing.js';
//import * as commonmark from 'commonmark';


const parser = new MarkdownParser();

const x = /\s/.test('\u00A0');


{
  const input = '*\u00A0a\u00A0*';
  const LS   = linify(input);
  const LLD  = lineDataAll(LS, 0);
  const diag = false;
  //const diag = verboses[idx] || false;
  parser.diagnostics = diag;
  const blocks = parser.processContent(LLD);
  collectLists(blocks, diag);
  blocks.forEach(B => {
    parser.processBlock(B);
    if(B.inlineContent)
      pairUpDelimiters(B.inlineContent);
  });
  
  console.log(blocks)

  const renderer = new Renderer();
  const my_result = renderer.referenceRender(blocks, diag);

  //const data = parser.processInline(LLD);
  console.log(my_result);
}
