import { global_MDPT, MarkdownParser } from '../src/markdown-parser';
import { MarkdownRendererInstance } from '../src/renderer/renderer.js';
import { markdownRendererTraits_standard } from '../src/renderer/renderer-standard.js';
import { extendTier1 } from '../src/extensions-tier-1/traits.js';
import { sourceInclude_traits } from "../src/extensions-tier-1/blocks/source-include.js"

extendTier1(global_MDPT, markdownRendererTraits_standard);

sourceInclude_traits.sourceIncludeResolve = (filepath, called_from) => {
  const fp = `C:\\Users\\fkaferbo\\projects\\Marki\\marki\\test\\${filepath}`;
  //console.log(`Resolve to [${fp}]`)
  return fp;
}

const parser = new MarkdownParser();

const input = `  - foo\n\n    \tbar`;


try {
  const blocks = await parser.processDocument(input);

  const renderer = new MarkdownRendererInstance(parser);
  const my_result = renderer.referenceRender(blocks);
  console.log(my_result);
} catch (e) {
  console.error('Caught error:', e);
}