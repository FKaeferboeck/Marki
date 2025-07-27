import { global_MDPT, MarkdownParser } from '../src/markdown-parser';
import { collectLists } from '../src/blocks/listItem.js';
import { MarkdownRendererInstance } from '../src/renderer/renderer.js';
import { pairUpDelimiters } from '../src/delimiter-processing.js';
import { linify } from '../src/linify.js';
import { extendTier2 } from '../src/extensions-tier-2/traits.js';
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard.js';
import { extendTier1 } from '../src/extensions-tier-1/traits.js';
//import * as commonmark from 'commonmark';

extendTier1(global_MDPT, markdownRendererTraits_standard);

const parser = new MarkdownParser();

{
  const input = `|Head 1|Head 2|\n|-|><|-><-|-|\n|C1|C2|\nafterwards'`;
  const LLs   = linify(input, false);
  const diag = false;
  //const diag = verboses[idx] || false;
  parser.diagnostics = diag;
  const blocks = parser.processContent(LLs[0], undefined);
  collectLists(blocks, diag);
  blocks.forEach(B => {
    parser.processBlock(B, parser);
    if(B.inlineContent)
      pairUpDelimiters(B.inlineContent);
  });
  
  console.log(blocks)

  const renderer = new MarkdownRendererInstance(parser);
  const my_result = renderer.referenceRender(blocks, diag);

  //const data = parser.processInline(LLD);
  console.log(my_result);
}
