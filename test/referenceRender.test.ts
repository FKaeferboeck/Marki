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
        parser.reset();
        parser.diagnostics = diag;
        const blocks = parser.processContent(LLD);
        collectLists(blocks, diag);
        blocks.forEach(B => parser.processBlock(B));
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


describe('Tabs', () => {
    doTest2( 1,   '\tfoo\tbaz\t\tbim');
    doTest2( 2,   '  \tfoo\tbaz\t\tbim');
    doTest2( 3,   '    a\ta\n    ὐ\ta');
    doTest2( 4,   '  - foo\n\n    \tbar');
    doTest2( 5,   '- foo\n\n\t\tbar');
    doTest2( 5.1, '- foo\n\n    \t\tbar');
    doTest2( 6,   '>\t\tfoo');
    doTest2( 7,   '-\t\tfoo');
    doTest2( 8,   '    foo\n    \tbar');
    doTest2( 9,   ' - foo\n    - bar\n \t - baz');
    doTest2(10,   '#\tFoo');
    doTest2(11,   '*\t*\t*\t');
});


describe('Backslash escapes', () => {
    doTest2(12, '\\!\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\-\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\\\\\]\\^\\_\\`\\{\\|\\}\\~');
    doTest2(13, '\\→\\A\\a\\ \\3\\φ\\«'); // Backslashes before other characters are treated as literal backslashes
    doTest2(14, `\\*not emphasized*
\\<br/> not a tag
\\[not a link](/foo)
\\\`not code\`
1\\. not a list
\\* not a list
\\# not a heading
\\[foo]: /url "not a reference"
\\&ouml; not a character entity`);
    //doTest2(15, '\\\\*emphasis*'); // If a backslash is itself escaped, the following character is not
    doTest2(16, 'foo\\\nbar'); // A backslash at the end of the line is a hard line break
    //doTest2(17, '`` \\[\\` ``'); // Backslash escapes do not work in code blocks, code spans, autolinks, or raw HTML
    doTest2(18, '    \\[\\]');
    doTest2(19, '~~~\n\\[\\]\n~~~');
    //doTest2(20, '<https://example.com?find=\\*>');
    //doTest2(21, '<a href="/bar\\/)">');
    doTest2(22, '[foo](/bar\\* "ti\\*tle")'); // But they work in all other contexts, including URLs and link titles, link references, and info strings in fenced code blocks
    //doTest2(23, '[foo]\n\n[foo]: /bar\\* "ti\\*tle"');
    //doTest2(24, '``` foo\\+bar\nfoo\n```');
});


describe('Entity and numeric character references', () => {
    doTest2(25, '&nbsp; &amp; &copy; &AElig; &Dcaron;\n&frac34; &HilbertSpace; &DifferentialD;\n&ClockwiseContourIntegral; &ngE;');
    doTest2(26, '&#35; &#1234; &#992; &#0;');
    doTest2(27, '&#X22; &#XD06; &#xcab;');
    doTest2(28, '&nbsp &x; &#; &#x;\n&#87654321;\n&#abcdef0;\n&ThisIsNotDefined; &hi?;'); // Here are some nonentities
    doTest2(29, '&copy');
    doTest2(30, '&MadeUpEntity;'); // Strings that are not on the list of HTML5 named entities are not recognized as entity references
    //doTest2(31, '<a href="&ouml;&ouml;.html">'); // Entity and numeric character references are recognized in any context besides code spans or code blocks
    doTest2(32, '[foo](/f&ouml;&ouml; "f&ouml;&ouml;")');
    doTest2(33, '[foo]\n\n[foo]: /f&ouml;&ouml; "f&ouml;&ouml;"');
    /*doTest2(34, '``` f&ouml;&ouml;\nfoo\n```');
    //doTest2(35, '`f&ouml;&ouml;`'); // Entity and numeric character references are treated as literal text in code spans and code blocks
    doTest2(36, '    f&ouml;f&ouml;');
    doTest2(37, '&#42;foo&#42;\n*foo*'); // Entity and numeric character references cannot be used in place of symbols indicating structure in CommonMark documents
    doTest2(38, '&#42; foo\n\n* foo');
    doTest2(39, 'foo&#10;&#10;bar');
    doTest2(40, '&#9;foo');
    doTest2(41, '[a](url &quot;tit&quot;)');*/
});


describe('Link reference definitions', () => {
    doTest2(192, '[foo]: /url "title"\n\n[foo]');
    doTest2(193, '   [foo]: \n      /url  \n           \'the title\'  \n\n[foo]');
    doTest2(194, '[Foo*bar\\]]:my_(url) \'title (with parens)\'\n\n[Foo*bar\\]]');
    doTest2(195, '[Foo195 bar]:\n<my url>\n\'title\'\n\n[Foo195 bar]');
    doTest2(196, '[foo]: /url \'\ntitle\nline1\nline2\n\'\n\n[foo]');
    doTest2(197, '[foo]: /url \'title\n\nwith blank line\'\n\n[foo]');
    doTest2(198, '[foo]:\n/Xurlr\n\n[foo]'); // The title may be omitted
    doTest2(199, '[foo]:\n\n[foo]'); // The link destination may not be omitted
    doTest2(200, '[foo]: <>\n\n[foo]'); // However, an empty link destination may be specified using angle brackets
    doTest2(201, '[foo]: <bar>(baz)\n\n[foo]'); // The title must be separated from the link destination by spaces or tabs
    doTest2(202, '[foo]: /url\bar\*baz "foo\"bar\baz"\n\n[foo]'); // Both title and destination can contain backslash escapes and literal backslashes
    doTest2(203, '[foo]\n\n[foo]: url'); // A link can come before its corresponding definition
    doTest2(204, '[foo]\n\n[foo]: first\n[foo]: second'); // If there are several matching definitions, the first one takes precedence
    doTest2(205, '[FOO]: /url\n\n[Foo]'); // matching of labels is case-insensitive
    doTest2(206, '[ΑΓΩ]: /φου\n\n[αγω]');
    doTest2(207, '[foo]: /url'); // link def that isn't used
    doTest2(208, '[\nfoo\n]: /url\nbar');
    doTest2(209, '[foo]: /url "title" ok'); // not a link reference definition, because there are characters other than spaces or tabs after the title
    doTest2(210, '[foo]: /url\n"ti\ntle" ok'); // This is a link reference definition, but it has no title
    doTest2(211, '    [foo]: /url "title"\n\n[foo]'); // This is not a link reference definition, because it is indented four spaces
    doTest2(212, '```\n[foo]: /url\n```\n\n[foo]'); // This is not a link reference definition, because it occurs inside a code block
    doTest2(213, 'Foo\n[bar]: /baz\n\n[bar]'); // A link reference definition cannot interrupt a paragraph
    doTest2(214, '# [Foo]\n[foo]: /url\n> bar'); // However, it can directly follow other block elements
    doTest2(215, '[foo]: /url\nbar\n===\n[foo]');
    doTest2(216, '[foo]: /url\n===\n[foo]');
    doTest2(217, '[foo]: /foo-url "foo"\n[bar]: /bar-url\n  "bar"\n[baz]: /baz-url\n\n[foo],\n[bar],\n[baz]'); // Several link reference definitions can occur one after another
    doTest2(218, '[foo]\n\n> [foo]: /url'); // Link reference definitions can occur inside block containers
});


describe('Paragraphs', () => {
    doTest2(219, `aaa\n\nbbb`); // A simple example with two paragraphs
    doTest2(220, `aaa\nbbb\n\nccc\nddd`); // Paragraphs can contain multiple lines, but no blank lines
    doTest2(221, `aaa\n\n\nbbb`); // Multiple blank lines between paragraphs have no effect
    doTest2(222, `  aaa\n bbb`); // Leading spaces or tabs are skipped
    doTest2(223, `aaa\n             bbb\n                                       ccc`); // Lines after the first may be indented any amount, since indented code blocks cannot interrupt paragraphs
    doTest2(224, `   aaa\nbbb`); // The first line may be preceded by up to three spaces
    doTest2(225, `    aaa\nbbb`); // Four spaces is too many
    doTest2(226, 'aaa     \nbbb     '); // Final spaces or tabs are stripped before inline parsing
});


describe('Blank lines', () => {
    doTest2(227,   '  \n\naaa\n  \n\n# aaa\n\n  ');
    doTest2(227.1, '\n\n  \n\n    aaa\n      \n    \n    # aaa\n    \n      \n    \n    ');
});


describe('Block quotes', () => {
    doTest2(228,   '> # Foo\n> bar\n> baz');
    doTest2(229,   '># Foo\n>bar\n> baz'); // The space or tab after the > characters can be omitted
    doTest2(230,   '   > # Foo\n   > bar\n > baz'); // he > characters can be preceded by up to three spaces of indentation
    doTest2(231,   '    > # Foo\n    > bar\n    > baz'); // Four spaces of indentation is too many
    doTest2(232,   '> # Foo\n> bar\nbaz'); // soft continuation
    doTest2(233,   '> bar\nbaz\n> foo'); // A block quote can contain some lazy and some non-lazy continuation lines
    doTest2(234,   '> foo\n> ---'); // Laziness only applies to lines that would have been continuations of paragraphs
    doTest2(234.1, '> foo\n---'); // ... without changing the meaning
    doTest2(235,   '> - foo\n- bar');
    doTest2(236,   '>     foo\n    bar'); // can't omit the > in front of subsequent lines of an indented or fenced code block
    doTest2(237,   '> ```\nfoo\n```');
    doTest2(238,   '> foo\n    - bar');
    doTest2(239,   '>'); // A block quote can be empty
    doTest2(240,   '>\n>  \n> ');
    doTest2(241,   '>\n> foo\n>  '); // A block quote can have initial or final blank lines
    doTest2(242,   '> foo\n\n> bar'); // A blank line always separates block quotes
    doTest2(243,   '> foo\n> bar');
    doTest2(244,   '> foo\n>\n> bar'); // block quote with two paragraphs
    doTest2(245,   'foo\n> bar'); // Block quotes can interrupt paragraphs
    doTest2(246,   '> aaa\n***\n> bbb'); // In general, blank lines are not needed before or after block quotes
    doTest2(247,   '> bar\nbaz'); // However, because of laziness, a blank line is needed between a block quote and a following paragraph
    doTest2(248,   '> bar\n\nbaz');
    doTest2(249,   '> bar\n>\nbaz');
    doTest2(250,   '> > > foo\nbar'); // any number of initial >s may be omitted on a continuation line of a nested block quote
    doTest2(251,   '>>> foo\n> bar\n>>baz');
    doTest2(252,   '>     code\n\n>    not code');
});

