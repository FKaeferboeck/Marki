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
            const my_result = referenceRender(blocks, verbose);

            const parsed = commonmark_reader.parse(s);
            const commonmark_result = commonmark_writer.render(parsed) as string;
            if(verbose)
                console.log('Target:', [ commonmark_result ]);

            expect(my_result).toEqual(commonmark_result);
            //expect(my_result.length).toEqual(commonmark_result.length);
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
    `> Foo\n---`,      // The setext heading underline cannot be a lazy continuation line in a list item or block quote
    `> foo\nbar\n===`,
    //`- Foo\n---`,
    `Foo\nBar\n---`, // multiline heading content
    `---\nFoo\n---\nBar\n---\nBaz`, //  a blank line is not required before or after setext headings
    `\n====`, // Setext headings cannot be empty
    `---\n---`,
    //`- foo\n-----`,
    `    foo\n---`,
    `> foo\n-----`,
    `Foo\n\nbar\n---\nbaz`, // 103
    `Foo\nbar\n\n---\n\nbaz`, // 104
    `Foo\nbar\n\n* * *\nbaz`, // 105
    //`Foo\nbar\n\\---\nbaz` // 106

    /* A couple of extreme examples I added needed to add: A paragraph that serves as a lazy continuation to a block quote later gets rejected in favor of a setext header.
       However we don't want to cancel the continuation because the reference implementation doesn't. */
    `> foo\nbar\n> ===`,
    /* Even worse: We first have a lazy "===" which gets accepted as paragraph content; but when we reject the paragraph over the "---" in the next line and reparse it as a setext header
       it would end with that "===" — but the reference implementation doesn't want us to. So we have to remember that this line used to be, and continues to be, a lazy continuation. */ 
    `> foo\nbar\n===\n> ---`
]);


doTest('indented code blocks', [
    `    a simple\n      indented code block`, // 107
    //`  - foo\n\n    bar`, // item list takes precedence
    //`1.  foo\n\n    - bar`, // 109
    //`    <a/>\n    *hi*\n\n    - one`, // The contents of a code block are literal text, and do not get parsed as Markdown
    `    chunk1\n\n    chunk2\n  \n \n \n    chunk3`, // Here we have three chunks separated by blank lines
    `    chunk1\n      \n      chunk2`, // Any initial spaces or tabs beyond four spaces of indentation will be included in the content, even in interior blank lines
    `Foo\n    bar`, // An indented code block cannot interrupt a paragraph
    `    foo\nbar`, // any non-blank line with fewer than four spaces of indentation ends the code block immediately
    `# Heading\n    foo\nHeading\n------\n    foo\n----`, // And indented code can occur immediately before and after other kinds of blocks
    `        foo\n    bar`, // The first line can be preceded by more than four spaces of indentation
    `\n    \n    foo\n    `, // Blank lines preceding or following an indented code block are not included in it
    `    foo  ` // Trailing spaces or tabs are included in the code block’s content
]);


doTest('fenced code blocks', [
    /*'```\n<\n >\n```', // 119
    '~~~\n<\n >\n~~~', // 120
    '``\nfoo\n``', // Fewer than three backticks is not enough*/
    '```\naaa\n~~~\n```', // The closing code fence must use the same character as the opening fence
    '~~~\naaa\n```\n~~~', // 123
    '````\naaa\n```\n``````', // The closing code fence must be at least as long as the opening fence
    '~~~~\naaa\n~~~\n~~~~', // 125
    '```', // Unclosed code blocks are closed by the end of the document
    '`````\n\n```\naaa', // 127
    '> ```\n> aaa\n\nbbb', // 128
    '```\n\n  \n```', // A code block can have all empty lines as its content
    '```\n```', // A code block can be empty
    ' ```\n aaa\naaa\n```', // Fences can be indented
    '  ```\naaa\n  aaa\naaa\n  ```', // 132
    '   ```\n   aaa\n    aaa\n  aaa\n   ```', // 133
    '    ```\n    aaa\n    ```', // Four spaces of indentation is too many
    '```\naaa\n  ```', // Closing fences may be preceded by up to three spaces of indentation, and their indentation need not match that of the opening fence
    '   ```\naaa\n  ```', // 136
    '```\naaa\n    ```', // This is not a closing fence, because it is indented 4 spaces
    //'``` ```\naaa', // Code fences (opening and closing) cannot contain internal spaces or tabs
    '~~~~~~\naaa\n~~~ ~~', // 139
    'foo\n```\nbar\n```\nbaz', // Fenced code blocks can interrupt paragraphs
    'foo\n---\n~~~\nbar\n~~~\n# baz', // Other blocks can also occur before and after fenced code blocks
    '```ruby\ndef foo(x)\n  return 3\nend\n```', // info strings
    '~~~~    ruby startline=3 $%@#$\ndef foo(x)\n  return 3\nend\n~~~~~~~', // 143
    '````;\n````', // 144
    //'``` aa ```\nfoo', // Info strings for backtick code blocks cannot contain backticks
    '~~~ aa ``` ~~~\nfoo\n~~~', // Info strings for tilde code blocks can contain backticks and tildes
    '```\n``` aaa\n```' // 147 Closing code fences cannot have info strings
])


doTest('basic paragraphs', [
    `aaa\n\nbbb`,
    `aaa\nbbb\n\nccc\nddd`,
    `aaa\n\n\nbbb`,
    `  aaa\n bbb`,
    `aaa\n             bbb\n                                       ccc`,
    `   aaa\nbbb`,
    //`aaa     \nbbb     `
]);


doTest('block quotes', [
    '> # Foo\n> bar\n> baz', // 228
    '># Foo\n>bar\n> baz', // The space or tab after the > characters can be omitted
    '   > # Foo\n   > bar\n > baz', // he > characters can be preceded by up to three spaces of indentation
    '    > # Foo\n    > bar\n    > baz', // Four spaces of indentation is too many
    '> # Foo\n> bar\nbaz', // soft continuation
    '> bar\nbaz\n> foo', // A block quote can contain some lazy and some non-lazy continuation lines
    '> foo\n> ---', // Laziness only applies to lines that would have been continuations of paragraphs
    '> foo\n---', // 234 ... without changing the meaning
    //'> - foo\n- bar', // 235
    '>     foo\n    bar', // 236 can't omit the > in front of subsequent lines of an indented or fenced code block
    '> ```\nfoo\n```', // 237
    '> foo\n    - bar', // 238
    //'>', // A block quote can be empty
    //'>\n>  \n> ', // 240
    //'>\n> foo\n>  ', // A block quote can have initial or final blank lines
    '> foo\n\n> bar', // A blank line always separates block quotes
    '> foo\n> bar', // 243
    '> foo\n>\n> bar', // block quote with two paragraphs
    'foo\n> bar', // Block quotes can interrupt paragraphs
    '> aaa\n***\n> bbb', // In general, blank lines are not needed before or after block quotes
    '> bar\nbaz', // However, because of laziness, a blank line is needed between a block quote and a following paragraph
    '> bar\n\nbaz', // 248
    '> bar\n>\nbaz', // 249
    '> > > foo\nbar', // any number of initial >s may be omitted on a continuation line of a nested block quote
    '>>> foo\n> bar\n>>baz', // 251
    '>     code\n\n>    not code' // 252
])
