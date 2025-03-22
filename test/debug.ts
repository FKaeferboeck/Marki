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
  const input = '`hi`lo`';
  const LS   = linify(input);
  const LLD  = lineDataAll(LS, 0);
  const data = parser.processInline(LLD);
  console.log(data);
}
