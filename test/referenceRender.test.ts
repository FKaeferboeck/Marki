import { describe, expect, it, test } from 'vitest'
import { MarkdownParser } from '../src/block-parser';
import { linify } from '../src/parser';
import { lineDataAll } from '../src/util';
import { referenceRender } from '../src/renderer/referenceRenderer';
import * as commonmark from 'commonmark';


const parser = new MarkdownParser();

var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();


function doTest(title: string, input: string[], verbose?: boolean) {
    parser.diagnostics = verbose || false;
    test(title, () => {
        input.forEach(s => {
            const LS        = linify(s);
            const LLD       = lineDataAll(LS, 0);
            const blocks    = parser.processContent(LLD);
            const my_result = referenceRender(blocks);

            const parsed = commonmark_reader.parse(s);
            const commonmark_result = commonmark_writer.render(parsed) as string;

            expect(my_result).toMatch(commonmark_result);
        })
    });
}


doTest('thematic breaks', [
    `***\n---\n___`,
    `+++`, // wrong character
    `===`, //
    `--\n**\n__`, // not enough characters
    ` ***\n  ***\n   ***`, // up to three spaces of indention allowed
    `    ***`, // Four spaces of indentation is too many
    `Foo\n    ***`,
    `_____________________________________`, // More than three characters may be used
    ` - - -`, // Spaces and tabs are allowed between the characters
    ` **  * ** * ** * **`,
    `-     -      -      -`,
    `- - - -    `, // Spaces and tabs are allowed at the end
    `_ _ _ _ a\n\na------\n\n---a---`, // However, no other characters may occur in the line
    //` *-*`, // It is required that all of the characters other than spaces or tabs be the same. So, this is not a thematic break
    //`- foo\n***\n- bar`, // Thematic breaks do not need blank lines before or after
    `Foo\n***\nbar`, // Thematic breaks can interrupt a paragraph
    `Foo\n---\nbar`, // setext heading takes precedence
    //`* Foo\n* * *\n* Bar`, // thematic break takes precedence over list item
    //`- Foo\n- * * *` // thematic break inside list
])


doTest('ATX headings', [
    `# foo\n## foo\n### foo\n#### foo\n##### foo\n###### foo`
]);


doTest('basic paragraphs', [
    `aaa\n\nbbb`,
    `aaa\nbbb\n\nccc\nddd`,
    `aaa\n\n\nbbb`,
    `  aaa\n bbb`,
    `aaa\n             bbb\n                                       ccc`,
    `   aaa\nbbb`,
    //`aaa     \nbbb     `
]);


/*doTest('indented code blocks',
    `    C1a\n\n    C1c\nP1a\n    P1b\n\n    C2a\n\nP2a\n\n    C3\n`,
    [ blk("indentedCodeBlock", 3),  par(2),  spc(),
      blk("indentedCodeBlock", 1),  spc(),  par(),  spc(),
      blk("indentedCodeBlock", 1),  spc()
    ]);


doTest('setext headings',
    `Headline\nsecond line\n==========  \nA paragraph\n===X\n\nHeader 2\n   -\n===`,
    [ blk("sectionHeader_setext", 3, { level: 1 }),  par(2),  spc(),  blk("sectionHeader_setext", 2, { level: 2 }),  par() ]);


doTest('ATX headings',
    `paragraph\n# H1\n##p\n   ####\n###### H6 ###`,
    [ par(),  blk("sectionHeader", 1, { level: 1 }),  par(),  blk("sectionHeader", 1, { level: 4 }), blk("sectionHeader", 1, { level: 6 }) ]);


doTest('thematic breaks',
    'P1\n***\n   -  - - ---   \n__\n___\nP3\n----',
    [ par(1),  blk("thematicBreak", 1, { ruleType: "*" }),  blk("thematicBreak", 1, { ruleType: "-" }),
      par(1),  blk("thematicBreak", 1, { ruleType: "_" }),
      blk("sectionHeader_setext", 2, { level: 2 })
    ]);


doTest('block quotes', '> Q1a\n>Q1b\nQ1c\n\n>Q2a\nQ2b\n===\n\n>Q3a\n>===\n>Q3c\n>---\npara\n\n>Q4a\nQ4b\n>===',
    [ cnt("blockQuote", 3, [ par(3) ]),
      spc(),
      cnt("blockQuote", 2, [ par(2) ]),
      par(1), spc(),
      cnt("blockQuote", 4, [ blk("sectionHeader_setext", 2, { level: 1 }),  blk("sectionHeader_setext", 2, { level: 2 }) ]),
      par(1),  spc(),
      cnt("blockQuote", 3, [ blk("sectionHeader_setext", 3, { level: 1 }) ]),
    ]);


doTest('list item', '* L1\n\n  L2\nL3\n  L4\n\nP',
    [ blk("listItem", 5),  spc(),  par(1)
    ], true);*/