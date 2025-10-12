import { MarkdownParser, MarkdownParserTraits } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer.js';
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard.js';
import { extendTier1 } from '../src/extensions-tier-1/traits.js';
import { sourceInclude_traits } from "../src/extensions-tier-1/blocks/source-include.js"
import { MarkiDocument } from '../src/markdown-types.js';
import { resolve } from 'path';

const test_MDPT = new MarkdownParserTraits();
test_MDPT.makeCommentLines = true;

extendTier1(test_MDPT, markdownRendererTraits_standard);

sourceInclude_traits.sourceIncludeResolve = (filepath, called_from) => {
  let fp = `./test/${filepath}`;
  fp = resolve(fp);
  return fp;
}

const parser = new MarkdownParser(test_MDPT);

const input = '- foo\n<!-- -->\n- baz'; //`Hi!\n\n#include Marki-UnitTest-Tier1-2.sdsmd`;

const doc: MarkiDocument = {
  URL: sourceInclude_traits.sourceIncludeResolve('Marki-UnitTest-Tier1-2.sdsmd', '', { mode: "relative",  prefix: '' }) as string,
  title: undefined,
  input,
  LLs: [],
  blocks: [],
  localCtx: { }
};


try {
  await parser.processDocument(doc);

  const renderer = new MarkdownRendererInstance(parser);
  const my_result = renderer.referenceRender(doc.blocks);
  console.log(my_result);
} catch (e) {
  console.error('Caught error:', e);
}