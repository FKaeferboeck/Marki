import { describe, expect, test } from 'vitest'
import { linify } from '../src/parser';
import { lineDataAll } from '../src/util';
import { Renderer} from '../src/renderer/renderer';
import * as commonmark from 'commonmark';
import { collectLists, listItem_traits } from '../src/blocks/listItem';
import { MarkdownParser } from '../src/markdown-parser';
import { standardBlockParserTraits } from '../src/block-parser';

// As of 2025-03-12 Vitest suddenly isn't able any more to import listItem on its own. Luckily we can repair it like this.
standardBlockParserTraits.listItem = listItem_traits;

const parser = new MarkdownParser();
const renderer = new Renderer();

var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();


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
        const my_result = renderer.referenceRender(blocks, diag);
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
    doTest2(23, '[foo]\n\n[foo]: /bar\\* "ti\\*tle"');
    doTest2(24, '``` foo\\+bar\nfoo\n```');
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
    doTest2(34, '``` f&ouml;&ouml;\nfoo\n```');
    doTest2(35, '`f&ouml;&ouml;`'); // Entity and numeric character references are treated as literal text in code spans and code blocks
    doTest2(36, '    f&ouml;f&ouml;');
    //doTest2(37, '&#42;foo&#42;\n*foo*'); // Entity and numeric character references cannot be used in place of symbols indicating structure in CommonMark documents
    doTest2(38, '&#42; foo\n\n* foo');
    doTest2(39, 'foo&#10;&#10;bar');
    doTest2(40, '&#9;foo');
    doTest2(41, '[a](url &quot;tit&quot;)');
});


describe('Precedence', () => {
    doTest2(42, '- `one\n- two`'); // Indicators of block structure always take precedence over indicators of inline structure
});


describe('thematic breaks', () => {
    doTest2(43, `***\n---\n___`);
    doTest2(44, `+++`); // wrong character
    doTest2(45, `===`); //
    doTest2(46, `--\n**\n__`); // not enough characters
    doTest2(47, ` ***\n  ***\n   ***`); // up to three spaces of indention allowed
    doTest2(48,  `    ***`); // Four spaces of indentation is too many
    doTest2(49, `Foo\n    ***`);
    doTest2(50, `_____________________________________`); // More than three characters may be used
    doTest2(51, ` - - -`); // Spaces and tabs are allowed between the characters
    doTest2(52, ` **  * ** * ** * **`);
    doTest2(53, `-     -      -      -`);
    doTest2(54, `- - - -    `); // Spaces and tabs are allowed at the end
    doTest2(55, `_ _ _ _ a\n\na------\n\n---a---`); // However, no other characters may occur in the line
    //doTest2(56, ` *-*`); // It is required that all of the characters other than spaces or tabs be the same. So, this is not a thematic break
    doTest2(57, `- foo\n***\n- bar`); // Thematic breaks do not need blank lines before or after
    doTest2(58, `Foo\n***\nbar`); // Thematic breaks can interrupt a paragraph
    doTest2(59, `Foo\n---\nbar`); // setext heading takes precedence
    doTest2(60, `* Foo\n* * *\n* Bar`); // thematic break takes precedence over list item
    doTest2(61, `- XFoo\n- * * *`); // thematic break inside list
});


describe('ATX headings', () => {
    doTest2(62, `# foo\n## foo\n### foo\n#### foo\n##### foo\n###### foo`);
    doTest2(63, `####### foo`); // More than six # characters is not a heading
    doTest2(64, `#5 bolt\n\n#hashtag`); // space after # required
    doTest2(65, `\\## foo`); // This is not a heading, because the first # is escaped
    //doTest2(66, `# foo *bar* \\*baz\\*`); // Contents are parsed as inlines
    doTest2(67, `#                  foo                     `); // Leading and trailing spaces or tabs are ignored in parsing inline content
    doTest2(68, ` ### foo\n  ## foo\n   # foo`); // Up to three spaces of indentation are allowed
    doTest2(69, `    # foo`);      // Four spaces of indentation is too many
    doTest2(70, `foo\n    # bar`); // 
    doTest2(71, `## foo ##\n  ###   bar    ###`); // A closing sequence of # characters is optional
    doTest2(72, `# foo ##################################\n##### foo ##`); // It need not be the same length as the opening sequence
    doTest2(73, `### foo ###     `); // Spaces or tabs are allowed after the closing sequence
    doTest2(74, `### foo ### b`);
    doTest2(75, `# foo#`); // closing sequence must be preceded by a space or tab
    doTest2(76, `### foo \\###\n## foo #\\##\n# foo \\#`); // Backslash-escaped # characters do not count as part of the closing sequence
    doTest2(77, `****\n## foo\n****`); // ATX headings need not be separated from surrounding content by blank lines, and they can interrupt paragraphs
    doTest2(78, `Foo bar\n# baz\nBar foo`);
    doTest2(79, `## \n#\n### ###`); // ATX headings can be empty
});



describe('setext headings', () => {
    //doTest2(80, `Foo *bar*\n=========\n\nFoo *bar*\n---------`);
    //doTest2(81, `Foo *bar\nbaz*\n====`); // The content of the header may span more than one line
    //doTest2(82, `  Foo *bar\nbaz*\t\n====`); // surrounding space
    doTest2(83, `Foo\n-------------------------\n\nFoo\n=`); // The underlining can be any length
    doTest2(84, `   Foo\n---\n\n  Foo\n-----\n\n  Foo\n  ===`); // heading content can be preceded by up to three spaces of indentation, and need not line up with the underlining
    doTest2(85, `    Foo\n    ---\n\n    Foo\n---`); // Four spaces of indentation is too many
    doTest2(86, `Foo\n   ----      `); // setext heading underline can be preceded by up to three spaces of indentation, and may have trailing spaces or tabs
    doTest2(87, `Foo\n    ---`); // Four spaces of indentation is too many
    doTest2(88, `Foo\n= =\n\nFoo\n--- -`); // setext heading underline cannot contain internal spaces or tabs
    doTest2(89, `Foo  \n-----`); // Trailing spaces or tabs in the content line do not cause a hard line break
    doTest2(90, `Foo\\\n----`); // Nor does a backslash at the end
    //doTest2(91, `\`Foo\n----\n\`\n\n<a title="a lot\n---\nof dashes"/>`); // indicators of block structure take precedence over indicators of inline structure
    doTest2(92, `> Foo\n---`); // The setext heading underline cannot be a lazy continuation line in a list item or block quote
    doTest2(93, `> foo\nbar\n===`);
    doTest2(94, `- Foo\n---`);
    doTest2(95, `Foo\nBar\n---`); // multiline heading content
    doTest2(96, `---\nFoo\n---\nBar\n---\nBaz`); // a blank line is not required before or after setext headings
    doTest2(97, `\n====`); // Setext headings cannot be empty
    doTest2(98, `---\n---`);
    doTest2(99, `- foo\n-----`);
    doTest2(100, `    foo\n---`);
    doTest2(101, `> foo\n-----`);
    doTest2(102, `> foo\n-----`);
    doTest2(103, `\\> foo\n------`); // if you want a heading with > foo as its literal text, you can use backslash escapes
    doTest2(104, 'Foo\nbar\n\n---\n\nbaz'); // Authors who want interpretation 2 can put blank lines around the thematic break
    doTest2(105, 'Foo\nbar\n* * *\nbaz'); // ... or use a thematic break that cannot count as a setext heading underline
    doTest2(106, 'Foo\nbar\n\\---\nbaz'); // Authors who want interpretation 3 can use backslash escapes
    /* A couple of extreme examples I needed to add: A paragraph that serves as a lazy continuation to a block quote later gets rejected in favor of a setext header.
       However we don't want to cancel the continuation because the reference implementation doesn't. */
    doTest2(106.1, `> (a)\nbar\n> ===`);
    /* Even worse: We first have a lazy "===" which gets accepted as paragraph content; but when we reject the paragraph over the "---" in the next line and reparse it as a setext header
       it would end with that "===" — but the reference implementation doesn't want us to. So we have to remember that this line used to be, and continues to be, a lazy continuation. */ 
    doTest2(106.2, `> (b)\nbar\n===\n> ---`);
});


describe('indented code blocks', () => {
    doTest2(107, `    a simple\n      indented code block`);
    doTest2(108, `  - foo\n\n    bar`); // item list takes precedence
    doTest2(109, `1.  foo\n\n    - bar`);
    doTest2(110, `    <a/>\n    *hi*\n\n    - one`); // The contents of a code block are literal text, and do not get parsed as Markdown
    doTest2(111, `    chunk1\n\n    chunk2\n  \n \n \n    chunk3`); // Here we have three chunks separated by blank lines
    doTest2(112, `    chunk1\n      \n      chunk2`); // Any initial spaces or tabs beyond four spaces of indentation will be included in the content, even in interior blank lines
    doTest2(113, `Foo\n    bar`); // An indented code block cannot interrupt a paragraph
    doTest2(114, `    foo\nbar`); // any non-blank line with fewer than four spaces of indentation ends the code block immediately
    doTest2(115, `# Heading\n    foo\nHeading\n------\n    foo\n----`); // And indented code can occur immediately before and after other kinds of blocks
    doTest2(116, `        foo\n    bar`); // The first line can be preceded by more than four spaces of indentation
    doTest2(117, `\n    \n    foo\n    `); // Blank lines preceding or following an indented code block are not included in it
    doTest2(118, `    foo  `); // Trailing spaces or tabs are included in the code block’s content
});


describe('Fenced code blocks', () => {
    doTest2(119, '```\n<\n >\n```');
    doTest2(120, '~~~\n<\n >\n~~~');
    doTest2(121, '``\nfoo\n``'); // Fewer than three backticks is not enough
    doTest2(122, '```\naaa\n~~~\n```'); // The closing code fence must use the same character as the opening fence
    doTest2(123, '~~~\naaa\n```\n~~~');
    doTest2(124, '````\naaa\n```\n``````'); // The closing code fence must be at least as long as the opening fence
    doTest2(125, '~~~~\naaa\n~~~\n~~~~');
    doTest2(126, '```'); // Unclosed code blocks are closed by the end of the document
    doTest2(127, '`````\n\n```\naaa');
    doTest2(128, '> ```\n> aaa\n\nbbb');
    doTest2(129, '```\n\n  \n```'); // A code block can have all empty lines as its content
    doTest2(130, '```\n```'); // A code block can be empty
    doTest2(131, ' ```\n aaa\naaa\n```'); // Fences can be indented
    doTest2(132, '  ```\naaa\n  aaa\naaa\n  ```');
    doTest2(133, '   ```\n   aaa\n    aaa\n  aaa\n   ```');
    doTest2(134, '    ```\n    aaa\n    ```'); // Four spaces of indentation is too many
    doTest2(135, '```\naaa\n  ```'); // Closing fences may be preceded by up to three spaces of indentation, and their indentation need not match that of the opening fence
    doTest2(136, '   ```\naaa\n  ```');
    doTest2(137, '```\naaa\n    ```'); // This is not a closing fence, because it is indented 4 spaces
    doTest2(138, '``` ```\naaa'); // Code fences (opening and closing) cannot contain internal spaces or tabs
    doTest2(139, '~~~~~~\naaa\n~~~ ~~');
    doTest2(140, 'foo\n```\nbar\n```\nbaz'); // Fenced code blocks can interrupt paragraphs
    doTest2(141, 'foo\n---\n~~~\nbar\n~~~\n# baz'); // Other blocks can also occur before and after fenced code blocks
    doTest2(142, '```ruby\ndef foo(x)\n  return 3\nend\n```'); // info strings
    doTest2(143, '~~~~    ruby startline=3 $%@#$\ndef foo(x)\n  return 3\nend\n~~~~~~~');
    doTest2(144, '````;\n````');
    doTest2(145, '``` aa ```\nfoo'); // Info strings for backtick code blocks cannot contain backticks
    doTest2(146, '~~~ aa ``` ~~~\nfoo\n~~~'); // Info strings for tilde code blocks can contain backticks and tildes
    doTest2(147, '```\n``` aaa\n```'); // Closing code fences cannot have info strings
})


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


describe('list items', () => {
    doTest2(253, 'A paragraph\nwith two lines.\n\n    indented code\n\n> A block quote.');
    doTest2(254, '1.  A paragraph\n    with two lines.\n\n        indented code\n\n    > A block quote.');
    doTest2(255, '- one\n\n two');
    doTest2(256, '- one\n\n  two');
    doTest2(257, ' -    one\n\n     two');
    doTest2(258, ' -    one\n\n      two');
    doTest2(259, '   > > 1.  one\n>>\n>>     two'); // nested lists
    doTest2(260, '>>- one\n>>\n  >  > two');
    doTest2(261, '-one\n\n2.two');
    doTest2(262, '- foo\n\n\n  bar');
    doTest2(263, '1.  foo\n\n    ```\n    bar\n    ```\n\n    baz\n\n    > bam'); // A list item may contain any kind of block
    doTest2(264, '- Foo\n\n      bar\n\n\n      baz'); // A list item that contains an indented code block will preserve empty lines within the code block verbatim
    doTest2(265, '123456789. ok'); // ordered list start numbers must be nine digits or less
    doTest2(266, '1234567890. not ok');
    doTest2(267, '0. ok');
    doTest2(268, '003. ok');
    doTest2(269, '-1. not ok'); // A start number may not be negative
    doTest2(270, '- foo\n\n      bar');
    doTest2(271, '  10.  foo\n\n           bar');
    doTest2(272, '    indented code\n\nparagraph\n\n    more code');
    doTest2(273, '1.     indented code\n\n   paragraph\n\n       more code');
    doTest2(274, '1.      indented code\n\n   paragraph\n\n       more code'); // Note that an additional space of indentation is interpreted as space inside the code block
    doTest2(275, '   foo\n\nbar');
    doTest2(276, '-    foo\n\n  bar');
    doTest2(277, '-  foo\n\n   bar');
    doTest2(278, '-\n  foo278\n-\n  ```\n  bar\n  ```\n\n-\n    baz');
    doTest2(279, '-   \n  foo279');
    doTest2(280, '-\n\n  foo280'); // A list item can begin with at most one blank line
    doTest2(281, '- foo\n-\n- bar'); // Here is an empty bullet list item
    doTest2(282, '- foo\n-   \n- bar'); // It does not matter whether there are spaces or tabs following the list marker
    doTest2(283, '1. foo\n2.\n3. bar'); // Here is an empty ordered list item
    doTest2(284, '*'); // A list may start or end with an empty list item
    doTest2(285, 'foo\n*\n\nfoo\n1.'); // However, an empty list item cannot interrupt a paragraph
    doTest2(286, ' 1.  A paragraph\n     with two lines.\n\n         indented code\n\n     > A block quote.');
    doTest2(287, '  1.  A paragraph\n      with two lines.\n\n          indented code\n\n      > A block quote.');
    doTest2(288, '   1.  A paragraph\n       with two lines.\n\n           indented code\n\n       > A block quote.');
    doTest2(289, '    1.  A paragraph\n        with two lines.\n\n            indented code\n\n        > A block quote.'); // Four spaces indent gives a code block
    doTest2(290, '  1.  A paragraph\nwith two lines.\n\n          indented code\n\n      > A block quote.');
    doTest2(291, '  1.  A paragraph\n    with two lines.'); // Indentation can be partially deleted
    doTest2(292, '> 1. > Blockquote\ncontinued here.'); // These examples show how laziness can work in nested structures
    doTest2(293, '> 1. > Blockquote\n> continued here.');
    doTest2(294, '- foo\n  - bar\n    - baz\n      - boo');
    doTest2(295, '- foo295\n - bar\n  - baz\n   - boo');
    doTest2(296, '10) foo\n    - bar'); // Here we need four indention spaces, because the list marker is wider
    doTest2(297, '11) foo297\n   - bar'); // Three is not enough
    doTest2(298, '- - foo298'); // A list may be the first block in a list item
    doTest2(299, '1. - 2. foo299');
    doTest2(300, '- # Foo\n- Bar\n  ---\n  baz');
});



describe('lists', () => {
    doTest2(301, '- foo\n- bar\n+ baz'); // Changing the bullet or ordered list delimiter starts a new list
    doTest2(302, '1. foo\n2. bar\n3) baz');
    doTest2(303, 'Foo\n- bar\n- baz'); // a list can interrupt a paragraph
    doTest2(304, 'The number of windows in my house is\n14.  The number of doors is 6.');
    doTest2(305, 'The number of windows in my house is\n1.  The number of doors is 6.');
    doTest2(306, '- foo\n\n- bar\n\n\n- baz');
    doTest2(307, '- foo\n  - bar\n    - baz\n\n\n      bim');
    //doTest2(308, '- foo\n- bar\n\n<!-- -->\n\n- baz\n- bim');
    //doTest2(309, '-   foo\n\n    notcode\n\n-   foo\n\n<!-- -->\n\n    code');
    doTest2(310, '- a\n - b\n  - c\n   - d\n  - e\n - f\n- g'); // List items need not be indented to the same level
    doTest2(311, '1. a\n\n  2. b\n\n   3. c');
    doTest2(312, '- a\n - b\n  - c\n   - d\n    - e');
    doTest2(313, '1. a\n\n  2. b\n\n    3. c'); // here 3. c is treated as in indented code block, because it is indented four spaces and preceded by a blank line
    doTest2(314, '- a\n- b\n\n- c'); // This is a loose list, because there is a blank line between two of the list items
    doTest2(315, '* a\n*\n\n* c'); // So is this, with a empty second item
    doTest2(316, '- a\n- b\n\n  c\n- d'); // loose because the second item has two paragraphs
    //doTest2(317, '- a\n- b\n\n  [ref]: /url\n- d');
    doTest2(318, '- a\n- ```\n  b\n\n\n  ```\n- c');
    doTest2(319, '- a\n  - b\n\n    c\n- d'); // Tight list containing a loose sublist
    doTest2(320, '* a\n  > b\n  >\n* c'); // This is a tight list, because the blank line is inside the block quote
    doTest2(321, '- a\n  > b\n  ```\n  c\n  ```\n- d'); // tight, because the consecutive block elements are not separated by blank lines
    doTest2(322, '- a'); // A single-paragraph list is tight
    doTest2(323, '- a\n  - b');
    doTest2(324, '1. ```\n   foo\n   ```\n\n   bar'); // This list is loose, because of the blank line between the two block elements in the list item
    doTest2(325, '* foo\n  * bar\n\n  baz'); // Here the outer list is loose, the inner list tight
    doTest2(326, '- a\n  - b\n  - c\n\n- d\n  - e\n  - f');
});


describe('Inlines', () => {
    doTest2(327, '`hi`lo`');
});


describe('Code spans', () => {
    doTest2(328, '`foo`'); // This is a simple code span
    doTest2(329, '`` foo ` bar ``');
    doTest2(330, '` `` `'); // the motivation for stripping leading and trailing spaces
    doTest2(331, '`  ``  `'); // Note that only one space is stripped
    doTest2(332, '` a`'); // The stripping only happens if the space is on both sides of the string
    doTest2(333, '` b `'); // Only spaces, and not unicode whitespace in general, are stripped in this way
    doTest2(334, '` `\n`  `'); // No stripping occurs if the code span contains only spaces
    doTest2(335, '``\nfoo\nbar  \nbaz\n``'); // Line endings are treated like spaces
    doTest2(336, '``\nfoo \n``');
    doTest2(337, '`foo   bar \nbaz`'); // Interior spaces are not collapsed
    doTest2(338, '`foo\`bar`'); // backslash escapes do not work in code spans
    doTest2(339, '``foo`bar``');
    doTest2(340, '` foo `` bar `');
    doTest2(341, '*foo`*`'); // Code span backticks have higher precedence than any other inline constructs
    //doTest2(342, '[not a `link](/foo`)'); // And this is not parsed as a link
    doTest2(343, '`<a href="`">`'); // Code spans, HTML tags, and autolinks have the same precedence. Thus, this is code
    doTest2(344, '<a href="`">`'); // But this is an HTML tag
    doTest2(345, '`<https://foo.bar.`baz>`'); // And this is code
    //doTest2(346, '<https://foo.bar.`baz>`'); // But this is an autolink
    doTest2(347, '```foo``'); // When a backtick string is not closed by a matching backtick string, we just have literal backticks
    doTest2(348, '`foo');
    doTest2(349, '`foo``bar``'); // opening and closing backtick strings need to be equal in length
});


/*describe('Emphasis & strong emphasis', () => {
    doTest2(350, '*foo bar*'); // Rule 1
});*/
