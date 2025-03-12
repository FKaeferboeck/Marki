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
            parser.diagnostics = verbose || false;
            //console.log(parser.diagnostics, verbose)
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
    `# foo\n## foo\n### foo\n#### foo\n##### foo\n###### foo`,
    `####### foo`, // More than six # characters is not a heading
    `#5 bolt\n\n#hashtag`, // space after # required
    //`\\## foo`, // This is not a heading, because the first # is escaped
    //`# foo *bar* \\*baz\\*`, // Contents are parsed as inlines
    `#                  foo                     `, // Leading and trailing spaces or tabs are ignored in parsing inline content
    ` ### foo\n  ## foo\n   # foo`, // Up to three spaces of indentation are allowed
    `    # foo`,      // Four spaces of indentation is too many
    `foo\n    # bar`, // 
    `## foo ##\n  ###   bar    ###`, // A closing sequence of # characters is optional
    `# foo ##################################\n##### foo ##`, // It need not be the same length as the opening sequence
    `### foo ###     `, // Spaces or tabs are allowed after the closing sequence
    `### foo ### b`,
    `# foo#`, // closing sequence must be preceded by a space or tab
    //`### foo \\###\n## foo #\\##\n# foo \\#`, // Backslash-escaped # characters do not count as part of the closing sequence
    `****\n## foo\n****`, // ATX headings need not be separated from surrounding content by blank lines, and they can interrupt paragraphs
    `Foo bar\n# baz\nBar foo`,
    `## \n#\n### ###` // ATX headings can be empty
]);


doTest('setext headings', [
    //`Foo *bar*\n=========\n\nFoo *bar*\n---------`,
    //`Foo *bar\nbaz*\n====`, // The content of the header may span more than one line
    //`  Foo *bar\nbaz*\t\n====`, // surrounding space
    `Foo\n-------------------------\n\nFoo\n=`, // The underlining can be any length
    `   Foo\n---\n\n  Foo\n-----\n\n  Foo\n  ===`, // The heading content can be preceded by up to three spaces of indentation, and need not line up with the underlining
    `    Foo\n    ---\n\n    Foo\n---`, // Four spaces of indentation is too many
    `Foo\n= =\n\nFoo\n--- -`, // The setext heading underline cannot contain internal spaces or tabs
    //`Foo  \n-----`, // Trailing spaces or tabs in the content line do not cause a hard line break
    `Foo\\\n----`, // Nor does a backslash at the end
    //`\`Foo\n----\n\`\n\n<a title="a lot\n---\nof dashes"/>`, // indicators of block structure take precedence over indicators of inline structure
    `> Foo\n---`, // The setext heading underline cannot be a lazy continuation line in a list item or block quote
    ``, // 
    ``, // 
    ``, // 
    ``, // 
    ``, // 
    ``, // 
    ``, // 
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

