import { MarkdownParser } from '../src/markdown-parser.js';
import { collectLists } from '../src/blocks/listItem.js';
import { Renderer } from '../src/renderer/renderer.js';
import { pairUpDelimiters } from '../src/delimiter-processing.js';
import { linify } from '../src/linify.js';
//import * as commonmark from 'commonmark';



const parser = new MarkdownParser();

{
  const input = `foo <!-- this is a --\ncomment - with hyphens -->`;
  const LLs   = linify(input, false);
  const diag = false;
  //const diag = verboses[idx] || false;
  parser.diagnostics = diag;
  const blocks = parser.processContent(LLs[0]);
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
