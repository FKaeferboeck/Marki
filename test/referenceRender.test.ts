import { describe, expect, test } from 'vitest'
import { linify_old } from '../src/parser';
import { lineDataAll } from '../src/util';
import { Renderer} from '../src/renderer/renderer';
import * as commonmark from 'commonmark';
import { collectLists, listItem_traits } from '../src/blocks/listItem';
import { MarkdownParser } from '../src/markdown-parser';
import { standardBlockParserTraits } from '../src/block-parser';
import { pairUpDelimiters } from '../src/delimiter-processing';

// As of 2025-03-12 Vitest suddenly isn't able any more to import listItem on its own. Luckily we can repair it like this.
standardBlockParserTraits.listItem = listItem_traits;

const parser = new MarkdownParser();
const renderer = new Renderer();

var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();


export function doTest(idx: number | string, input: string, verbose = false) {
    test('' + idx, () => {
        const LS   = linify_old(input);
        const LLD  = lineDataAll(LS, 0);
        
        //const diag = false;
        const diag = verbose;
        parser.reset();
        parser.diagnostics = diag;
        const blocks = parser.processContent(LLD);
        collectLists(blocks, diag);
        blocks.forEach(B => {
            parser.processBlock(B);
            if(B.inlineContent)
                pairUpDelimiters(B.inlineContent);
        });
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
    doTest( 1,   '\tfoo\tbaz\t\tbim');
    doTest( 2,   '  \tfoo\tbaz\t\tbim');
    doTest( 3,   '    a\ta\n    ὐ\ta');
    doTest( 4,   '  - foo\n\n    \tbar');
    doTest( 5,   '- foo\n\n\t\tbar');
    doTest( 5.1, '- foo\n\n    \t\tbar');
    doTest( 6,   '>\t\tfoo');
    doTest( 7,   '-\t\tfoo');
    doTest( 8,   '    foo\n    \tbar');
    doTest( 9,   ' - foo\n    - bar\n \t - baz');
    doTest(10,   '#\tFoo');
    doTest(11,   '*\t*\t*\t');
});


describe('Backslash escapes', () => {
    doTest(12, '\\!\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\-\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\\\\\]\\^\\_\\`\\{\\|\\}\\~');
    doTest(13, '\\→\\A\\a\\ \\3\\φ\\«'); // Backslashes before other characters are treated as literal backslashes
    doTest(14, `\\*not emphasized*
\\<br/> not a tag
\\[not a link](/foo)
\\\`not code\`
1\\. not a list
\\* not a list
\\# not a heading
\\[foo]: /url "not a reference"
\\&ouml; not a character entity`);
    doTest(15, '\\\\*emphasis*'); // If a backslash is itself escaped, the following character is not
    doTest(16, 'foo\\\nbar'); // A backslash at the end of the line is a hard line break
    doTest(17, '`` \\[\\` ``'); // Backslash escapes do not work in code blocks, code spans, autolinks, or raw HTML
    doTest(18, '    \\[\\]');
    doTest(19, '~~~\n\\[\\]\n~~~');
    doTest(20, '<https://example.com?find=\\*>');
    doTest(21, '<a href="/bar\\/)">');
    doTest(22, '[foo](/bar\\* "ti\\*tle")'); // But they work in all other contexts, including URLs and link titles, link references, and info strings in fenced code blocks
    doTest(23, '[foo]\n\n[foo]: /bar\\* "ti\\*tle"');
    doTest(24, '``` foo\\+bar\nfoo\n```');
});


describe('Entity and numeric character references', () => {
    doTest(25, '&nbsp; &amp; &copy; &AElig; &Dcaron;\n&frac34; &HilbertSpace; &DifferentialD;\n&ClockwiseContourIntegral; &ngE;');
    doTest(26, '&#35; &#1234; &#992; &#0;');
    doTest(27, '&#X22; &#XD06; &#xcab;');
    doTest(28, '&nbsp &x; &#; &#x;\n&#87654321;\n&#abcdef0;\n&ThisIsNotDefined; &hi?;'); // Here are some nonentities
    doTest(29, '&copy');
    doTest(30, '&MadeUpEntity;'); // Strings that are not on the list of HTML5 named entities are not recognized as entity references
    doTest(31, '<a href="&ouml;&ouml;.html">'); // Entity and numeric character references are recognized in any context besides code spans or code blocks
    doTest(32, '[foo](/f&ouml;&ouml; "f&ouml;&ouml;")');
    doTest(33, '[foo]\n\n[foo]: /f&ouml;&ouml; "f&ouml;&ouml;"');
    doTest(34, '``` f&ouml;&ouml;\nfoo\n```');
    doTest(35, '`f&ouml;&ouml;`'); // Entity and numeric character references are treated as literal text in code spans and code blocks
    doTest(36, '    f&ouml;f&ouml;');
    doTest(37, '&#42;foo&#42;\n*foo*'); // Entity and numeric character references cannot be used in place of symbols indicating structure in CommonMark documents
    doTest(38, '&#42; foo\n\n* foo');
    doTest(39, 'foo&#10;&#10;bar');
    doTest(40, '&#9;foo');
    doTest(41, '[a](url &quot;tit&quot;)');
});


describe('Precedence', () => {
    doTest(42, '- `one\n- two`'); // Indicators of block structure always take precedence over indicators of inline structure
});


describe('thematic breaks', () => {
    doTest(43, `***\n---\n___`);
    doTest(44, `+++`); // wrong character
    doTest(45, `===`); //
    doTest(46, `--\n**\n__`); // not enough characters
    doTest(47, ` ***\n  ***\n   ***`); // up to three spaces of indention allowed
    doTest(48,  `    ***`); // Four spaces of indentation is too many
    doTest(49, `Foo\n    ***`);
    doTest(50, `_____________________________________`); // More than three characters may be used
    doTest(51, ` - - -`); // Spaces and tabs are allowed between the characters
    doTest(52, ` **  * ** * ** * **`);
    doTest(53, `-     -      -      -`);
    doTest(54, `- - - -    `); // Spaces and tabs are allowed at the end
    doTest(55, `_ _ _ _ a\n\na------\n\n---a---`); // However, no other characters may occur in the line
    doTest(56, ` *-*`); // It is required that all of the characters other than spaces or tabs be the same. So, this is not a thematic break
    doTest(57, `- foo\n***\n- bar`); // Thematic breaks do not need blank lines before or after
    doTest(58, `Foo\n***\nbar`); // Thematic breaks can interrupt a paragraph
    doTest(59, `Foo\n---\nbar`); // setext heading takes precedence
    doTest(60, `* Foo\n* * *\n* Bar`); // thematic break takes precedence over list item
    doTest(61, `- XFoo\n- * * *`); // thematic break inside list
});


describe('ATX headings', () => {
    doTest(62, `# foo\n## foo\n### foo\n#### foo\n##### foo\n###### foo`);
    doTest(63, `####### foo`); // More than six # characters is not a heading
    doTest(64, `#5 bolt\n\n#hashtag`); // space after # required
    doTest(65, `\\## foo`); // This is not a heading, because the first # is escaped
    doTest(66, `# foo *bar* \\*baz\\*`); // Contents are parsed as inlines
    doTest(67, `#                  foo                     `); // Leading and trailing spaces or tabs are ignored in parsing inline content
    doTest(68, ` ### foo\n  ## foo\n   # foo`); // Up to three spaces of indentation are allowed
    doTest(69, `    # foo`);      // Four spaces of indentation is too many
    doTest(70, `foo\n    # bar`); // 
    doTest(71, `## foo ##\n  ###   bar    ###`); // A closing sequence of # characters is optional
    doTest(72, `# foo ##################################\n##### foo ##`); // It need not be the same length as the opening sequence
    doTest(73, `### foo ###     `); // Spaces or tabs are allowed after the closing sequence
    doTest(74, `### foo ### b`);
    doTest(75, `# foo#`); // closing sequence must be preceded by a space or tab
    doTest(76, `### foo \\###\n## foo #\\##\n# foo \\#`); // Backslash-escaped # characters do not count as part of the closing sequence
    doTest(77, `****\n## foo\n****`); // ATX headings need not be separated from surrounding content by blank lines, and they can interrupt paragraphs
    doTest(78, `Foo bar\n# baz\nBar foo`);
    doTest(79, `## \n#\n### ###`); // ATX headings can be empty
});



describe('setext headings', () => {
    doTest(80, `Foo *bar*\n=========\n\nFoo *bar*\n---------`);
    doTest(81, `Foo *bar\nbaz*\n====`); // The content of the header may span more than one line
    doTest(82, `  Foo *bar\nbaz*\t\n====`); // surrounding space
    doTest(83, `Foo\n-------------------------\n\nFoo\n=`); // The underlining can be any length
    doTest(84, `   Foo\n---\n\n  Foo\n-----\n\n  Foo\n  ===`); // heading content can be preceded by up to three spaces of indentation, and need not line up with the underlining
    doTest(85, `    Foo\n    ---\n\n    Foo\n---`); // Four spaces of indentation is too many
    doTest(86, `Foo\n   ----      `); // setext heading underline can be preceded by up to three spaces of indentation, and may have trailing spaces or tabs
    doTest(87, `Foo\n    ---`); // Four spaces of indentation is too many
    doTest(88, `Foo\n= =\n\nFoo\n--- -`); // setext heading underline cannot contain internal spaces or tabs
    doTest(89, `Foo  \n-----`); // Trailing spaces or tabs in the content line do not cause a hard line break
    doTest(90, `Foo\\\n----`); // Nor does a backslash at the end
    doTest(91, `\`Foo\n----\n\`\n\n<a title="a lot\n---\nof dashes"/>`); // indicators of block structure take precedence over indicators of inline structure
    doTest(92, `> Foo\n---`); // The setext heading underline cannot be a lazy continuation line in a list item or block quote
    doTest(93, `> foo\nbar\n===`);
    doTest(94, `- Foo\n---`);
    doTest(95, `Foo\nBar\n---`); // multiline heading content
    doTest(96, `---\nFoo\n---\nBar\n---\nBaz`); // a blank line is not required before or after setext headings
    doTest(97, `\n====`); // Setext headings cannot be empty
    doTest(98, `---\n---`);
    doTest(99, `- foo\n-----`);
    doTest(100, `    foo\n---`);
    doTest(101, `> foo\n-----`);
    doTest(102, `> foo\n-----`);
    doTest(103, `\\> foo\n------`); // if you want a heading with > foo as its literal text, you can use backslash escapes
    doTest(104, 'Foo\nbar\n\n---\n\nbaz'); // Authors who want interpretation 2 can put blank lines around the thematic break
    doTest(105, 'Foo\nbar\n* * *\nbaz'); // ... or use a thematic break that cannot count as a setext heading underline
    doTest(106, 'Foo\nbar\n\\---\nbaz'); // Authors who want interpretation 3 can use backslash escapes
    /* A couple of extreme examples I needed to add: A paragraph that serves as a lazy continuation to a block quote later gets rejected in favor of a setext header.
       However we don't want to cancel the continuation because the reference implementation doesn't. */
    doTest(106.1, `> (a)\nbar\n> ===`);
    /* Even worse: We first have a lazy "===" which gets accepted as paragraph content; but when we reject the paragraph over the "---" in the next line and reparse it as a setext header
       it would end with that "===" — but the reference implementation doesn't want us to. So we have to remember that this line used to be, and continues to be, a lazy continuation. */ 
    doTest(106.2, `> (b)\nbar\n===\n> ---`);
});


describe('indented code blocks', () => {
    doTest(107, `    a simple\n      indented code block`);
    doTest(108, `  - foo\n\n    bar`); // item list takes precedence
    doTest(109, `1.  foo\n\n    - bar`);
    doTest(110, `    <a/>\n    *hi*\n\n    - one`); // The contents of a code block are literal text, and do not get parsed as Markdown
    doTest(111, `    chunk1\n\n    chunk2\n  \n \n \n    chunk3`); // Here we have three chunks separated by blank lines
    doTest(112, `    chunk1\n      \n      chunk2`); // Any initial spaces or tabs beyond four spaces of indentation will be included in the content, even in interior blank lines
    doTest(113, `Foo\n    bar`); // An indented code block cannot interrupt a paragraph
    doTest(114, `    foo\nbar`); // any non-blank line with fewer than four spaces of indentation ends the code block immediately
    doTest(115, `# Heading\n    foo\nHeading\n------\n    foo\n----`); // And indented code can occur immediately before and after other kinds of blocks
    doTest(116, `        foo\n    bar`); // The first line can be preceded by more than four spaces of indentation
    doTest(117, `\n    \n    foo\n    `); // Blank lines preceding or following an indented code block are not included in it
    doTest(118, `    foo  `); // Trailing spaces or tabs are included in the code block’s content
});


describe('Fenced code blocks', () => {
    doTest(119, '```\n<\n >\n```');
    doTest(120, '~~~\n<\n >\n~~~');
    doTest(121, '``\nfoo\n``'); // Fewer than three backticks is not enough
    doTest(122, '```\naaa\n~~~\n```'); // The closing code fence must use the same character as the opening fence
    doTest(123, '~~~\naaa\n```\n~~~');
    doTest(124, '````\naaa\n```\n``````'); // The closing code fence must be at least as long as the opening fence
    doTest(125, '~~~~\naaa\n~~~\n~~~~');
    doTest(126, '```'); // Unclosed code blocks are closed by the end of the document
    doTest(127, '`````\n\n```\naaa');
    doTest(128, '> ```\n> aaa\n\nbbb');
    doTest(129, '```\n\n  \n```'); // A code block can have all empty lines as its content
    doTest(130, '```\n```'); // A code block can be empty
    doTest(131, ' ```\n aaa\naaa\n```'); // Fences can be indented
    doTest(132, '  ```\naaa\n  aaa\naaa\n  ```');
    doTest(133, '   ```\n   aaa\n    aaa\n  aaa\n   ```');
    doTest(134, '    ```\n    aaa\n    ```'); // Four spaces of indentation is too many
    doTest(135, '```\naaa\n  ```'); // Closing fences may be preceded by up to three spaces of indentation, and their indentation need not match that of the opening fence
    doTest(136, '   ```\naaa\n  ```');
    doTest(137, '```\naaa\n    ```'); // This is not a closing fence, because it is indented 4 spaces
    doTest(138, '``` ```\naaa'); // Code fences (opening and closing) cannot contain internal spaces or tabs
    doTest(139, '~~~~~~\naaa\n~~~ ~~');
    doTest(140, 'foo\n```\nbar\n```\nbaz'); // Fenced code blocks can interrupt paragraphs
    doTest(141, 'foo\n---\n~~~\nbar\n~~~\n# baz'); // Other blocks can also occur before and after fenced code blocks
    doTest(142, '```ruby\ndef foo(x)\n  return 3\nend\n```'); // info strings
    doTest(143, '~~~~    ruby startline=3 $%@#$\ndef foo(x)\n  return 3\nend\n~~~~~~~');
    doTest(144, '````;\n````');
    doTest(145, '``` aa ```\nfoo'); // Info strings for backtick code blocks cannot contain backticks
    doTest(146, '~~~ aa ``` ~~~\nfoo\n~~~'); // Info strings for tilde code blocks can contain backticks and tildes
    doTest(147, '```\n``` aaa\n```'); // Closing code fences cannot have info strings
})


describe('HTML blocks', () => {
    doTest(148, '<table><tr><td>\n<pre>\n**Hello**,\n\n_world_.\n</pre>\n</td></tr></table>');
    doTest(149, '<table>\n  <tr>\n    <td>\n           hi\n    </td>\n  </tr>\n</table>\n\nokay.');
    doTest(150, ' <div>\n  *hello*\n         <foo><a>');
    doTest(151, '</div>\n*foo*'); // A block can also start with a closing tag
    doTest(152, '<DIV CLASS="foo">\n\n*Markdown*\n\n</DIV>'); // Here we have two HTML blocks with a Markdown paragraph between them
    doTest(153, '<div id="foo"\n  class="bar">\n</div>'); // The tag on the first line can be partial, as long as it is split where there would be whitespace
    doTest(154, '<div id="foo" class="bar\n  baz">\n</div>');
    doTest(155, '<div>\n*foo*\n\n*bar*'); // An open tag need not be closed
    doTest(156, '<div id="foo"\n*hi*'); // A partial tag need not even be completed (garbage in, garbage out)
    doTest(157, '<div class\nfoo');
    doTest(158, '<div *???-&&&-<---\n*foo*'); // The initial tag doesn’t even need to be a valid tag, as long as it starts like one
    doTest(159, '<div><a href="bar">*foo*</a></div>'); // In type 6 blocks, the initial tag need not be on a line by itself
    doTest(160, '<table><tr><td>\nfoo\n</td></tr></table>');
    doTest(161, '<div></div>\n``` c\nint x = 33;\n```'); // Everything until the next blank line or end of document gets included in the HTML block
    doTest(162, '<a href="foo">\n*bar*\n</a>'); // To start an HTML block with a tag that is not in the list of block-level tags in (6), you must put the tag by itself on the first line (and it must be complete)
    doTest(163, '<Warning>\n*bar*\n</Warning>'); // In type 7 blocks, the tag name can be anything
    doTest(164, '<i class="foo">\n*bar*\n</i>');
    doTest(165, '</ins>\n*bar*');
    doTest(166, '<del>\n*foo*\n</del>');     // as HTML block
    doTest(167, '<del>\n\n*foo*\n\n</del>'); // Same with content as Markdown
    doTest(168, '<del>*foo*</del>');         // Same as raw HTML inside paragraph
    /* Type 1 */
    doTest(169, '<pre language="haskell"><code>\nimport Text.HTML.TagSoup\n\nmain :: IO ()\nmain = print $ parseTags tags\n</code></pre>\nokay');
    doTest(170, '<script type="text/javascript">\n// JavaScript example\n\ndocument.getElementById("demo").innerHTML = "Hello JavaScript!";\n</script>\nokay');
    doTest(171, '<textarea>\n\n*foo*\n\n_bar_\n\n</textarea>');
    doTest(172, '<style\n  type="text/css">\nh1 {color:red;}\n\np {color:blue;}\n</style>\nokay');
    doTest(173, '<style\n  type="text/css">\n\nfoo'); // If there is no matching end tag, the block will end at the end of the document (or the enclosing block quote or list item)
    doTest(174, '> <div>\n> foo\n\nbar');
    doTest(175, '- <div>\n- foo');
    doTest(176, '<style>p{color:red;}</style>\n*foo*'); // The end tag can occur on the same line as the start tag
    //doTest(177, '<!-- foo -->*bar*\n*baz*');
    doTest(178, '<script>\nfoo\n</script>1. *bar*'); // Note that anything on the last line after the end tag will be included in the HTML block
    /* Type 2 */
    //doTest(179, '<!-- Foo\n\nbar\n   baz -->\nokay');
    /* Type 3 — processing instruction */
    doTest(180, '<?php\n\n  echo \'>\';\n\n?>\nokay');
    /* Type 4 — declaration */
    doTest(181, '<!DOCTYPE html>');
    /* Type 5 — CDATA section */
    doTest(182, '<![CDATA[\nfunction matchwo(a,b)\n{\n  if (a < b && a < 0) then {\n    return 1;\n\n  } else {\n\n    return 0;\n  }\n}\n]]>\nokay');
    //doTest(183, '  <!-- foo -->\n\n    <!-- foo -->'); // The opening tag can be preceded by up to three spaces of indentation, but not four
    doTest(184, '  <div>\n\n    <div>');
    doTest(185, 'Foo\n<div>\nbar\n</div>'); // An HTML block of types 1–6 can interrupt a paragraph, and need not be preceded by a blank line
    doTest(186, '<div>\nbar\n</div>\n*foo*'); // However, a following blank line is needed, except at the end of a document, and except for blocks of types 1–5, above
    doTest(187, 'Foo\n<a href="bar">\nbaz'); // HTML blocks of type 7 cannot interrupt a paragraph 
    doTest(188, '<div>\n\n*Emphasized* text.\n\n</div>');
    doTest(189, '<div>\n*Emphasized* text.\n</div>');
    doTest(190, '<table>\n\n<tr>\n\n<td>\nHi\n</td>\n\n</tr>\n\n</table>');
    doTest(191, '<table>\n\n  <tr>\n\n    <td>\n      Hi\n    </td>\n\n  </tr>\n\n</table>'); // if the inner tags are indented and separated by spaces, they will be interpreted as an indented code block
});


describe('Link reference definitions', () => {
    doTest(192, '[foo]: /url "title"\n\n[foo]');
    doTest(193, '   [foo]: \n      /url  \n           \'the title\'  \n\n[foo]');
    doTest(194, '[Foo*bar\\]]:my_(url) \'title (with parens)\'\n\n[Foo*bar\\]]');
    doTest(195, '[Foo195 bar]:\n<my url>\n\'title\'\n\n[Foo195 bar]');
    doTest(196, '[foo]: /url \'\ntitle\nline1\nline2\n\'\n\n[foo]');
    doTest(197, '[foo]: /url \'title\n\nwith blank line\'\n\n[foo]');
    doTest(198, '[foo]:\n/Xurlr\n\n[foo]'); // The title may be omitted
    doTest(199, '[foo]:\n\n[foo]'); // The link destination may not be omitted
    doTest(200, '[foo]: <>\n\n[foo]'); // However, an empty link destination may be specified using angle brackets
    doTest(201, '[foo]: <bar>(baz)\n\n[foo]'); // The title must be separated from the link destination by spaces or tabs
    doTest(202, '[foo]: /url\bar\*baz "foo\"bar\baz"\n\n[foo]'); // Both title and destination can contain backslash escapes and literal backslashes
    doTest(203, '[foo]\n\n[foo]: url'); // A link can come before its corresponding definition
    doTest(204, '[foo]\n\n[foo]: first\n[foo]: second'); // If there are several matching definitions, the first one takes precedence
    doTest(205, '[FOO]: /url\n\n[Foo]'); // matching of labels is case-insensitive
    doTest(206, '[ΑΓΩ]: /φου\n\n[αγω]');
    doTest(207, '[foo]: /url'); // link def that isn't used
    doTest(208, '[\nfoo\n]: /url\nbar');
    doTest(209, '[foo]: /url "title" ok'); // not a link reference definition, because there are characters other than spaces or tabs after the title
    doTest(210, '[foo]: /url\n"ti\ntle" ok'); // This is a link reference definition, but it has no title
    doTest(211, '    [foo]: /url "title"\n\n[foo]'); // This is not a link reference definition, because it is indented four spaces
    doTest(212, '```\n[foo]: /url\n```\n\n[foo]'); // This is not a link reference definition, because it occurs inside a code block
    doTest(213, 'Foo\n[bar]: /baz\n\n[bar]'); // A link reference definition cannot interrupt a paragraph
    doTest(214, '# [Foo]\n[foo]: /url\n> bar'); // However, it can directly follow other block elements
    doTest(215, '[foo]: /url\nbar\n===\n[foo]');
    doTest(216, '[foo]: /url\n===\n[foo]');
    doTest(217, '[foo]: /foo-url "foo"\n[bar]: /bar-url\n  "bar"\n[baz]: /baz-url\n\n[foo],\n[bar],\n[baz]'); // Several link reference definitions can occur one after another
    doTest(218, '[foo]\n\n> [foo]: /url'); // Link reference definitions can occur inside block containers
});


describe('Paragraphs', () => {
    doTest(219, `aaa\n\nbbb`); // A simple example with two paragraphs
    doTest(220, `aaa\nbbb\n\nccc\nddd`); // Paragraphs can contain multiple lines, but no blank lines
    doTest(221, `aaa\n\n\nbbb`); // Multiple blank lines between paragraphs have no effect
    doTest(222, `  aaa\n bbb`); // Leading spaces or tabs are skipped
    doTest(223, `aaa\n             bbb\n                                       ccc`); // Lines after the first may be indented any amount, since indented code blocks cannot interrupt paragraphs
    doTest(224, `   aaa\nbbb`); // The first line may be preceded by up to three spaces
    doTest(225, `    aaa\nbbb`); // Four spaces is too many
    doTest(226, 'aaa     \nbbb     '); // Final spaces or tabs are stripped before inline parsing
});


describe('Blank lines', () => {
    doTest(227,   '  \n\naaa\n  \n\n# aaa\n\n  ');
    doTest(227.1, '\n\n  \n\n    aaa\n      \n    \n    # aaa\n    \n      \n    \n    ');
});


describe('Block quotes', () => {
    doTest(228,   '> # Foo\n> bar\n> baz');
    doTest(229,   '># Foo\n>bar\n> baz'); // The space or tab after the > characters can be omitted
    doTest(230,   '   > # Foo\n   > bar\n > baz'); // he > characters can be preceded by up to three spaces of indentation
    doTest(231,   '    > # Foo\n    > bar\n    > baz'); // Four spaces of indentation is too many
    doTest(232,   '> # Foo\n> bar\nbaz'); // soft continuation
    doTest(233,   '> bar\nbaz\n> foo'); // A block quote can contain some lazy and some non-lazy continuation lines
    doTest(234,   '> foo\n> ---'); // Laziness only applies to lines that would have been continuations of paragraphs
    doTest(234.1, '> foo\n---'); // ... without changing the meaning
    doTest(235,   '> - foo\n- bar');
    doTest(236,   '>     foo\n    bar'); // can't omit the > in front of subsequent lines of an indented or fenced code block
    doTest(237,   '> ```\nfoo\n```');
    doTest(238,   '> foo\n    - bar');
    doTest(239,   '>'); // A block quote can be empty
    doTest(240,   '>\n>  \n> ');
    doTest(241,   '>\n> foo\n>  '); // A block quote can have initial or final blank lines
    doTest(242,   '> foo\n\n> bar'); // A blank line always separates block quotes
    doTest(243,   '> foo\n> bar');
    doTest(244,   '> foo\n>\n> bar'); // block quote with two paragraphs
    doTest(245,   'foo\n> bar'); // Block quotes can interrupt paragraphs
    doTest(246,   '> aaa\n***\n> bbb'); // In general, blank lines are not needed before or after block quotes
    doTest(247,   '> bar\nbaz'); // However, because of laziness, a blank line is needed between a block quote and a following paragraph
    doTest(248,   '> bar\n\nbaz');
    doTest(249,   '> bar\n>\nbaz');
    doTest(250,   '> > > foo\nbar'); // any number of initial >s may be omitted on a continuation line of a nested block quote
    doTest(251,   '>>> foo\n> bar\n>>baz');
    doTest(252,   '>     code\n\n>    not code');
});


describe('list items', () => {
    doTest(253, 'A paragraph\nwith two lines.\n\n    indented code\n\n> A block quote.');
    doTest(254, '1.  A paragraph\n    with two lines.\n\n        indented code\n\n    > A block quote.');
    doTest(255, '- one\n\n two');
    doTest(256, '- one\n\n  two');
    doTest(257, ' -    one\n\n     two');
    doTest(258, ' -    one\n\n      two');
    doTest(259, '   > > 1.  one\n>>\n>>     two'); // nested lists
    doTest(260, '>>- one\n>>\n  >  > two');
    doTest(261, '-one\n\n2.two');
    doTest(262, '- foo\n\n\n  bar');
    doTest(263, '1.  foo\n\n    ```\n    bar\n    ```\n\n    baz\n\n    > bam'); // A list item may contain any kind of block
    doTest(264, '- Foo\n\n      bar\n\n\n      baz'); // A list item that contains an indented code block will preserve empty lines within the code block verbatim
    doTest(265, '123456789. ok'); // ordered list start numbers must be nine digits or less
    doTest(266, '1234567890. not ok');
    doTest(267, '0. ok');
    doTest(268, '003. ok');
    doTest(269, '-1. not ok'); // A start number may not be negative
    doTest(270, '- foo\n\n      bar');
    doTest(271, '  10.  foo\n\n           bar');
    doTest(272, '    indented code\n\nparagraph\n\n    more code');
    doTest(273, '1.     indented code\n\n   paragraph\n\n       more code');
    doTest(274, '1.      indented code\n\n   paragraph\n\n       more code'); // Note that an additional space of indentation is interpreted as space inside the code block
    doTest(275, '   foo\n\nbar');
    doTest(276, '-    foo\n\n  bar');
    doTest(277, '-  foo\n\n   bar');
    doTest(278, '-\n  foo278\n-\n  ```\n  bar\n  ```\n\n-\n    baz');
    doTest(279, '-   \n  foo279');
    doTest(280, '-\n\n  foo280'); // A list item can begin with at most one blank line
    doTest(281, '- foo\n-\n- bar'); // Here is an empty bullet list item
    doTest(282, '- foo\n-   \n- bar'); // It does not matter whether there are spaces or tabs following the list marker
    doTest(283, '1. foo\n2.\n3. bar'); // Here is an empty ordered list item
    doTest(284, '*'); // A list may start or end with an empty list item
    doTest(285, 'foo\n*\n\nfoo\n1.'); // However, an empty list item cannot interrupt a paragraph
    doTest(286, ' 1.  A paragraph\n     with two lines.\n\n         indented code\n\n     > A block quote.');
    doTest(287, '  1.  A paragraph\n      with two lines.\n\n          indented code\n\n      > A block quote.');
    doTest(288, '   1.  A paragraph\n       with two lines.\n\n           indented code\n\n       > A block quote.');
    doTest(289, '    1.  A paragraph\n        with two lines.\n\n            indented code\n\n        > A block quote.'); // Four spaces indent gives a code block
    doTest(290, '  1.  A paragraph\nwith two lines.\n\n          indented code\n\n      > A block quote.');
    doTest(291, '  1.  A paragraph\n    with two lines.'); // Indentation can be partially deleted
    doTest(292, '> 1. > Blockquote\ncontinued here.'); // These examples show how laziness can work in nested structures
    doTest(293, '> 1. > Blockquote\n> continued here.');
    doTest(294, '- foo\n  - bar\n    - baz\n      - boo');
    doTest(295, '- foo295\n - bar\n  - baz\n   - boo');
    doTest(296, '10) foo\n    - bar'); // Here we need four indention spaces, because the list marker is wider
    doTest(297, '11) foo297\n   - bar'); // Three is not enough
    doTest(298, '- - foo298'); // A list may be the first block in a list item
    doTest(299, '1. - 2. foo299');
    doTest(300, '- # Foo\n- Bar\n  ---\n  baz');
});



describe('lists', () => {
    doTest(301, '- foo\n- bar\n+ baz'); // Changing the bullet or ordered list delimiter starts a new list
    doTest(302, '1. foo\n2. bar\n3) baz');
    doTest(303, 'Foo\n- bar\n- baz'); // a list can interrupt a paragraph
    doTest(304, 'The number of windows in my house is\n14.  The number of doors is 6.');
    doTest(305, 'The number of windows in my house is\n1.  The number of doors is 6.');
    doTest(306, '- foo\n\n- bar\n\n\n- baz');
    doTest(307, '- foo\n  - bar\n    - baz\n\n\n      bim');
    //doTest(308, '- foo\n- bar\n\n<!-- -->\n\n- baz\n- bim');
    //doTest(309, '-   foo\n\n    notcode\n\n-   foo\n\n<!-- -->\n\n    code');
    doTest(310, '- a\n - b\n  - c\n   - d\n  - e\n - f\n- g'); // List items need not be indented to the same level
    doTest(311, '1. a\n\n  2. b\n\n   3. c');
    doTest(312, '- a\n - b\n  - c\n   - d\n    - e');
    doTest(313, '1. a\n\n  2. b\n\n    3. c'); // here 3. c is treated as in indented code block, because it is indented four spaces and preceded by a blank line
    doTest(314, '- a\n- b\n\n- c'); // This is a loose list, because there is a blank line between two of the list items
    doTest(315, '* a\n*\n\n* c'); // So is this, with a empty second item
    doTest(316, '- a\n- b\n\n  c\n- d'); // loose because the second item has two paragraphs
    doTest(317, '- a\n- b\n\n  [ref]: /url\n- d');
    doTest(318, '- a\n- ```\n  b\n\n\n  ```\n- c');
    doTest(319, '- a\n  - b\n\n    c\n- d'); // Tight list containing a loose sublist
    doTest(320, '* a\n  > b\n  >\n* c'); // This is a tight list, because the blank line is inside the block quote
    doTest(321, '- a\n  > b\n  ```\n  c\n  ```\n- d'); // tight, because the consecutive block elements are not separated by blank lines
    doTest(322, '- a'); // A single-paragraph list is tight
    doTest(323, '- a\n  - b');
    doTest(324, '1. ```\n   foo\n   ```\n\n   bar'); // This list is loose, because of the blank line between the two block elements in the list item
    doTest(325, '* foo\n  * bar\n\n  baz'); // Here the outer list is loose, the inner list tight
    doTest(326, '- a\n  - b\n  - c\n\n- d\n  - e\n  - f');
});


describe('Inlines', () => {
    doTest(327, '`hi`lo`');
});

/* ... to be continued in ./content-iterator.test.ts */
