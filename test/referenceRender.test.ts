import { describe, expect, it, test } from 'vitest'
import { linify } from '../src/parser';
import { lineDataAll } from '../src/util';
import { referenceRender } from '../src/renderer/referenceRenderer';
import * as commonmark from 'commonmark';
import { collectLists, listItem_traits } from '../src/blocks/listItem';
import { MarkdownParser } from '../src/markdown-parser';
import { standardBlockParserTraits } from '../src/block-parser';


// As of 2025-03-12 Vitest suddenly isn't able any more to import listItem on its own. Luckily we can repair it like this.
standardBlockParserTraits.listItem = listItem_traits;

const parser = new MarkdownParser();
parser.makeStartCharMap();

var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();


function doTest(title: string, startNumber: number, input: (string | boolean)[]) {
    const verboses: Record<number, boolean> = { };
    describe(title, () => {
        input.forEach((s, idx) => {
            test('Case ' + (idx + startNumber), () => {
                if(typeof s === "boolean") {
                    verboses[idx + 1] = s;
                    return;
                }
                const LS        = linify(s);
                const LLD       = lineDataAll(LS, 0);
                const diag = verboses[idx] || false;
                parser.diagnostics = diag;
                const blocks    = parser.processContent(LLD);
                collectLists(blocks, diag);
                const my_result = referenceRender(blocks, diag);

                const parsed = commonmark_reader.parse(s);
                const commonmark_result = commonmark_writer.render(parsed) as string;
                if(diag)
                    console.log('CommonMark:', [ commonmark_result ]);

                expect(my_result).toEqual(commonmark_result);
                //expect(my_result.length).toEqual(commonmark_result.length);
            })
        });
    });
}


doTest('thematic breaks', 1, [
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
    `- foo\n***\n- bar`, // Thematic breaks do not need blank lines before or after
    `Foo\n***\nbar`, // Thematic breaks can interrupt a paragraph
    `Foo\n---\nbar`, // setext heading takes precedence
    `* Foo\n* * *\n* Bar`, // thematic break takes precedence over list item
    `- XFoo\n- * * *` // thematic break inside list
])


doTest('ATX headings', 1, [
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


doTest('setext headings', 83, [
    //`Foo *bar*\n=========\n\nFoo *bar*\n---------`, // 83
    //`Foo *bar\nbaz*\n====`, // 84 The content of the header may span more than one line
    //`  Foo *bar\nbaz*\t\n====`, // 85 surrounding space
    `Foo\n-------------------------\n\nFoo\n=`, // 86 The underlining can be any length
    `   Foo\n---\n\n  Foo\n-----\n\n  Foo\n  ===`, // 87 The heading content can be preceded by up to three spaces of indentation, and need not line up with the underlining
    `    Foo\n    ---\n\n    Foo\n---`, // 88 Four spaces of indentation is too many
    `Foo\n= =\n\nFoo\n--- -`, // 89 The setext heading underline cannot contain internal spaces or tabs
    //`Foo  \n-----`, // 90 Trailing spaces or tabs in the content line do not cause a hard line break
    `Foo\\\n----`, // 91 Nor does a backslash at the end
    //`\`Foo\n----\n\`\n\n<a title="a lot\n---\nof dashes"/>`, // 92 indicators of block structure take precedence over indicators of inline structure
    `> Foo\n---`, // 93 The setext heading underline cannot be a lazy continuation line in a list item or block quote
    `> 94foo\nbar\n===`, // 94
    `- Foo\n---`, // 95
    `Foo\nBar\n---`, // 96 multiline heading content
    `---\nFoo\n---\nBar\n---\nBaz`, // 97 a blank line is not required before or after setext headings
    `\n====`, // 98 Setext headings cannot be empty
    `---\n---`, // 99
    `- foo\n-----`, // 100
    `    101foo\n---`, // 101
    `> 102foo\n-----`,
    `103Foo\n\nbar\n---\nbaz`, // 103
    `103Foo\nbar\n\n---\n\nbaz`, // 104
    `105Foo\nbar\n\n* * *\nbaz`, // 105
    //`Foo\nbar\n\\---\nbaz` // 106

    /* A couple of extreme examples I added needed to add: A paragraph that serves as a lazy continuation to a block quote later gets rejected in favor of a setext header.
       However we don't want to cancel the continuation because the reference implementation doesn't. */
    `> (a)\nbar\n> ===`,
    /* Even worse: We first have a lazy "===" which gets accepted as paragraph content; but when we reject the paragraph over the "---" in the next line and reparse it as a setext header
       it would end with that "===" — but the reference implementation doesn't want us to. So we have to remember that this line used to be, and continues to be, a lazy continuation. */ 
    `> (b)\nbar\n===\n> ---`
]);


doTest('indented code blocks', 107, [
    `    a simple\n      indented code block`, // 107
    `  - foo108\n\n    bar`, // item list takes precedence
    `1.  foo109\n\n    - bar109`, // 109
    //`    <a/>\n    *hi*\n\n    - one`, // The contents of a code block are literal text, and do not get parsed as Markdown
    `    chunk1\n\n    chunk2\n  \n \n \n    chunk3`, // Here we have three chunks separated by blank lines
    `    chunk1\n      \n      chunk2`, // Any initial spaces or tabs beyond four spaces of indentation will be included in the content, even in interior blank lines
    `Foo\n    bar`, // An indented code block cannot interrupt a paragraph
    `    foo\nbar`, // any non-blank line with fewer than four spaces of indentation ends the code block immediately
    `# Heading\n    foo\nHeading\n------\n    foo\n----`, // And indented code can occur immediately before and after other kinds of blocks
    `        foo116\n    bar`, // The first line can be preceded by more than four spaces of indentation
    `\n    \n    foo117\n    `, // Blank lines preceding or following an indented code block are not included in it
    `    foo  ` // 118 Trailing spaces or tabs are included in the code block’s content
]);


doTest('fenced code blocks', 119, [
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


doTest('basic paragraphs', 148, [
    `aaa\n\nbbb`,
    `aaa\nbbb\n\nccc\nddd`,
    `aaa\n\n\nbbb`,
    `  aaa\n bbb`,
    `aaa\n             bbb\n                                       ccc`,
    `   aaa\nbbb`,
    //`aaa     \nbbb     `
]);


doTest('block quotes', 228, [
    '> # Foo\n> bar\n> baz', // 228
    '># Foo\n>bar\n> baz', // The space or tab after the > characters can be omitted
    '   > # Foo\n   > bar\n > baz', // he > characters can be preceded by up to three spaces of indentation
    '    > # Foo\n    > bar\n    > baz', // Four spaces of indentation is too many
    '> # Foo\n> bar\nbaz', // soft continuation
    '> bar\nbaz\n> foo', // A block quote can contain some lazy and some non-lazy continuation lines
    '> foo\n> ---', // Laziness only applies to lines that would have been continuations of paragraphs
    '> foo\n---', // 234 ... without changing the meaning
    '> - foo\n- bar', // 235
    '>     foo\n    bar', // 236 can't omit the > in front of subsequent lines of an indented or fenced code block
    '> ```\nfoo\n```', // 237
    '> foo\n    - bar', // 238
    '>', // A block quote can be empty
    '>\n>  \n> ', // 240
    '>\n> foo\n>  ', // 241 A block quote can have initial or final blank lines
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


doTest('list items', 253, [
    'A paragraph\nwith two lines.\n\n    indented code\n\n> A block quote.', // 253
    '1.  A paragraph\n    with two lines.\n\n        indented code\n\n    > A block quote.', // 254
    '- one\n\n two', // 255
    '- one\n\n  two', // 256
    ' -    one\n\n     two', // 257
    ' -    one\n\n      two', // 258
    '   > > 1.  one\n>>\n>>     two', // 259 nested lists
    '>>- one\n>>\n  >  > two', // 260
    '-one\n\n2.two', // 261
    '- foo\n\n\n  bar', // 262
    '1.  foo\n\n    ```\n    bar\n    ```\n\n    baz\n\n    > bam', // 263 A list item may contain any kind of block
    '- Foo\n\n      bar\n\n\n      baz', // 264 A list item that contains an indented code block will preserve empty lines within the code block verbatim
    '123456789. ok', // 265 ordered list start numbers must be nine digits or less
    '1234567890. not ok', // 266
    '0. ok', // 267
    '003. ok', // 268
    '-1. not ok', // 269 A start number may not be negative
    '- foo\n\n      bar', // 270
    '  10.  foo\n\n           bar', // 271
    '    indented code\n\nparagraph\n\n    more code', // 272
    '1.     indented code\n\n   paragraph\n\n       more code', // 273
    '1.      indented code\n\n   paragraph\n\n       more code', // 274 Note that an additional space of indentation is interpreted as space inside the code block
    '   foo\n\nbar', // 275
    '-    foo\n\n  bar', // 276
    '-  foo\n\n   bar', // 277
    '-\n  foo278\n-\n  ```\n  bar\n  ```\n\n-\n    baz', // 278
    '-   \n  foo279', // 279
    '-\n\n  foo280', // 280 A list item can begin with at most one blank line
    '- foo\n-\n- bar', // 281 Here is an empty bullet list item
    '- foo\n-   \n- bar', // 282 It does not matter whether there are spaces or tabs following the list marker
    '1. foo\n2.\n3. bar', // 283 Here is an empty ordered list item
    '*', // 284 A list may start or end with an empty list item
    'foo\n*\n\nfoo\n1.', // 285 However, an empty list item cannot interrupt a paragraph
    ' 1.  A paragraph\n     with two lines.\n\n         indented code\n\n     > A block quote.', // 286
    '  1.  A paragraph\n      with two lines.\n\n          indented code\n\n      > A block quote.', // 287
    '   1.  A paragraph\n       with two lines.\n\n           indented code\n\n       > A block quote.', // 288
    '    1.  A paragraph\n        with two lines.\n\n            indented code\n\n        > A block quote.', // 289 Four spaces indent gives a code block
    '  1.  A paragraph\nwith two lines.\n\n          indented code\n\n      > A block quote.', // 290
    '  1.  A paragraph\n    with two lines.', // 291 Indentation can be partially deleted
    '> 1. > Blockquote\ncontinued here.', // 292 These examples show how laziness can work in nested structures
    '> 1. > Blockquote\n> continued here.', // 293
    '- foo\n  - bar\n    - baz\n      - boo', // 294
    '- foo295\n - bar\n  - baz\n   - boo', // 295
    '10) foo\n    - bar', // 296 Here we need four indention spaces, because the list marker is wider
    '11) foo297\n   - bar', // 297 Three is not enough
    '- - foo298', // 298 A list may be the first block in a list item
    '1. - 2. foo299', // 299
    '- # Foo\n- Bar\n  ---\n  baz' // 300
]);


doTest('lists', 301, [
    '- foo\n- bar\n+ baz', // 301 Changing the bullet or ordered list delimiter starts a new list
    '1. foo\n2. bar\n3) baz', // 302
    'Foo\n- bar\n- baz', // 303 a list can interrupt a paragraph
    'The number of windows in my house is\n14.  The number of doors is 6.', // 304
    'The number of windows in my house is\n1.  The number of doors is 6.', // 305
    '- foo\n\n- bar\n\n\n- baz', // 306
    '- foo\n  - bar\n    - baz\n\n\n      bim', // 307
    //'- foo\n- bar\n\n<!-- -->\n\n- baz\n- bim', // 308
    //'-   foo\n\n    notcode\n\n-   foo\n\n<!-- -->\n\n    code', // 309
    '- a\n - b\n  - c\n   - d\n  - e\n - f\n- g', // 310 List items need not be indented to the same level
    '1. a\n\n  2. b\n\n   3. c', // 311
    '- a\n - b\n  - c\n   - d\n    - e', // 312
    '1. a\n\n  2. b\n\n    3. c', // 313 here 3. c is treated as in indented code block, because it is indented four spaces and preceded by a blank line
    '- a\n- b\n\n- c', // 314 This is a loose list, because there is a blank line between two of the list items
    '* a\n*\n\n* c', // 315 So is this, with a empty second item
    '- a\n- b\n\n  c\n- d', // 316 loose because the second item has two paragraphs
    //'- a\n- b\n\n  [ref]: /url\n- d', // 317
    '- a\n- ```\n  b\n\n\n  ```\n- c', // 318
    '- a\n  - b\n\n    c\n- d', // 319 Tight list containing a loose sublist
    '* a\n  > b\n  >\n* c', // 320 This is a tight list, because the blank line is inside the block quote
    '- a\n  > b\n  ```\n  c\n  ```\n- d', // 321 tight, because the consecutive block elements are not separated by blank lines
    '- a', // 322 A single-paragraph list is tight
    '- a\n  - b', // 323
    '1. ```\n   foo\n   ```\n\n   bar', // 324 This list is loose, because of the blank line between the two block elements in the list item
    '* foo\n  * bar\n\n  baz', // 325 Here the outer list is loose, the inner list tight
    '- a\n  - b\n  - c\n\n- d\n  - e\n  - f' // 326
]);



function doTest2(idx: number | string, input: string, verbose = false) {
    test('' + idx, () => {
        const LS   = linify(input);
        const LLD  = lineDataAll(LS, 0);
        
        //const diag = false;
        const diag = verbose;
        parser.diagnostics = diag;
        const blocks = parser.processContent(LLD);
        blocks.forEach(B => {
            if(B.content)
                B.inlineContent = parser.processInline(B.content);
        });
        const my_result = referenceRender(blocks, diag);
        if(verbose)
            console.log(blocks)

        const commonmark_parsed = commonmark_reader.parse(input);
        const commonmark_result = commonmark_writer.render(commonmark_parsed) as string;
        if(verbose)
            console.log('CommonMark:', commonmark_result);
        expect(my_result).toEqual(commonmark_result);
    });
}

describe('Link reference definitions', () => {
    doTest2(192, '[foo]: /url "title"\n\n[foo]');
    doTest2(193, '   [foo]: \n      /url  \n           \'the title\'  \n\n[foo]');
    doTest2(194, '[Foo*bar\\]]:my_(url) \'title (with parens)\'\n\n[Foo*bar\\]]');
    doTest2(195, '[Foo195 bar]:\n<my url>\n\'title\'\n\n[Foo195 bar]');
    doTest2(196, '[foo196]: /url \'\ntitle\nline1\nline2\n\'\n\n[foo196]');
    doTest2(197, '');
    doTest2(198, '');
    doTest2(199, '');
    doTest2(200, '');
    doTest2(201, '');
});
