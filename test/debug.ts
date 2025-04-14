import { linify } from '../src/parser.js';
import { lineDataAll } from '../src/util.js';
import { referenceRender } from '../src/renderer/referenceRenderer.js';
import { MarkdownParser } from '../src/markdown-parser.js';
//import * as commonmark from 'commonmark';


const parser = new MarkdownParser();

/*var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();*/

/*const markdownInput =
`- foo
  - bar
    - baz

      bim`;

parser.diagnostics = true;
const LS        = linify(markdownInput);
const LLD       = lineDataAll(LS, 0);

//console.log(parser.diagnostics, verbose)
const blocks    = parser.processContent(LLD);
console.log(blocks);
const my_result = referenceRender(blocks, true);*/

//const parsed = commonmark_reader.parse(markdownInput);
//const commonmark_result = commonmark_writer.render(parsed) as string;
//console.log('CommonMark:', [ commonmark_result ]);

parser.makeStartCharMap();

{
  const input = '[foo]: /foo-url "foo"\n[bar]: /bar-url\n  "bar"\n[baz]: /baz-url\n\n[foo],\n[bar],\n[baz]';
  const LS   = linify(input);
  const LLD  = lineDataAll(LS, 0);
  
  const diag = false;
  //const diag = verboses[idx] || false;
  parser.diagnostics = diag;
  const blocks = parser.processContent(LLD);
  blocks.forEach(B => {
      if(B.content)
          B.inlineContent = parser.processInline(B.content);

  });
  console.log(blocks)

  
  const my_result = referenceRender(blocks, diag);

  //const data = parser.processInline(LLD);
  console.log(my_result);
}
