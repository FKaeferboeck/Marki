import { describe, expect, test } from 'vitest'
import { linify } from '../src/parser';
import { lineDataAll } from '../src/util';
import { MarkdownParser } from '../src/markdown-parser';
import * as commonmark from 'commonmark';
import { Renderer } from '../src/renderer/renderer';
import { standardBlockParserTraits } from '../src/block-parser';
import { listItem_traits, collectLists } from '../src/blocks/listItem';

// As of 2025-03-12 Vitest suddenly isn't able any more to import listItem on its own. Luckily we can repair it like this.
standardBlockParserTraits.listItem = listItem_traits;

const parser = new MarkdownParser();
const renderer = new Renderer();

var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();


function doTest(idx: number | string, input: string, verbose = false) {
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


describe('Code spans', () => {
    doTest(328, '`foo`'); // This is a simple code span
    doTest(329, '`` foo ` bar ``');
    doTest(330, '` `` `'); // the motivation for stripping leading and trailing spaces
    doTest(331, '`  ``  `'); // Note that only one space is stripped
    doTest(332, '` a`'); // The stripping only happens if the space is on both sides of the string
    doTest(333, '`\u00A0b\u00A0`'); // Only spaces, and not unicode whitespace in general, are stripped in this way
    doTest(334, '` `\n`  `'); // No stripping occurs if the code span contains only spaces
    doTest(335, '``\nfoo\nbar  \nbaz\n``'); // Line endings are treated like spaces
    doTest(336, '``\nfoo \n``');
    doTest(337, '`foo   bar \nbaz`'); // Interior spaces are not collapsed
    doTest(338, '`foo\`bar`'); // backslash escapes do not work in code spans
    doTest(339, '``foo`bar``');
    doTest(340, '` foo `` bar `');
    doTest(341, '*foo`*`'); // Code span backticks have higher precedence than any other inline constructs
    //doTest(342, '[not a `link](/foo`)'); // And this is not parsed as a link
    doTest(343, '`<a href="`">`'); // Code spans, HTML tags, and autolinks have the same precedence. Thus, this is code
    doTest(344, '<a href="`">`'); // But this is an HTML tag
    doTest(345, '`<https://foo.bar.`baz>`'); // And this is code
    //doTest(346, '<https://foo.bar.`baz>`'); // But this is an autolink
    doTest(347, '```foo``'); // When a backtick string is not closed by a matching backtick string, we just have literal backticks
    doTest(348, '`foo');
    doTest(349, '`foo``bar``'); // opening and closing backtick strings need to be equal in length
});


/*describe('Emphasis & strong emphasis', () => {
    doTest(350, '*foo bar*'); // Rule 1
});*/


describe('Inline: Links', () => {
    doTest(482, '[link](/uri "title")');
    doTest(483, '[link](/uri)');
    doTest(484, '[](./target.md)');
    doTest(485, '[link]()');
    doTest(486, '[link](<>)');
    doTest(487, '[]()');
    doTest(488, '[link](/my uri)');
    doTest(489, '[link](</my uri>)');
    doTest(490, '[link](foo\nbar)'); // The destination cannot contain line endings, even if enclosed in pointy brackets
    doTest(491, '[link](<foo\nbar>)');
    doTest(492, '[a](<b)c>)'); // The destination can contain ) if it is enclosed in pointy brackets
    doTest(493, '[link](<foo\>)'); // Pointy brackets that enclose links must be unescaped
    //doTest(494, '[a](<b)c\n[d](<e)f>\n[g](<h>i)', true); // These are not links, because the opening pointy bracket is not matched properly
    doTest(495, '[link](\\(fo\\))'); // Parentheses inside the link destination may be escaped
    doTest(496, '[link](foo(and(bar)))'); // Any number of parentheses are allowed without escaping, as long as they are balanced
    doTest(497, '[link](foo(and(bar))'); // However, if you have unbalanced parentheses, you need to escape or use the <...> form
    doTest(498, '[link](foo\\(and\\(bar\\))');
    doTest(499, '[link](<foo(and(bar)>)');
    doTest(500, '[link](foo\\)\:)'); // Parentheses and other symbols can also be escaped, as usual in Markdown
    //doTest(501, '[link](#fragment)\n\n[link](https://example.com#fragment)\n\n[link](https://example.com?foo=3#frag)'); // A link can contain fragment identifiers and queries
    doTest(502, '[link](foo\\bar)'); // Note that a backslash before a non-escapable character is just a backslash
    doTest(503, '[link](foo%20b&auml;)');
    doTest(504, '[link]("title")');
    doTest(505, '[link](/url "title")\n[link](/url \'title\')\n[link](/url (title))'); // Titles may be in single quotes, double quotes, or parentheses
    doTest(506, '[link](/url "title \\"&quot;")'); // Backslash escapes and entity and numeric character references may be used in titles
    doTest(507, '[link](/url "title")');
    doTest(508, '[link](/url "title "and" title")'); // Nested balanced quotes are not allowed without escaping
    doTest(509, '[link](/url \'title "and" title\')'); // But it is easy to work around this by using a different quote type
    doTest(510, '[link](   /uri\n  "title"  )'); // Spaces, tabs, and up to one line ending is allowed around the destination and title
    doTest(511, '[linki] (/uri)'); // But it is not allowed between the link text and the following parenthesis (it could be a shortcut reference link if defined)
    /*doTest(512, '[link [foo [bar]]](/uri)'); // The link text may contain balanced brackets, but not unbalanced ones, unless they are escaped
    doTest(513, '[linki] bar](/uri)');
    doTest(514, '[linki [bar](/uri)');
    doTest(515, '[link \\[bar](/uri)');
    //doTest(516, '[link *foo **bar** `#`*](/uri)'); // The link text may contain inline content
    //doTest(517, '[![moon](moon.jpg)](/uri)');
    //doTest(518, '[foo [bar](/uri)](/uri)'); // However, links may not contain other links, at any level of nesting
    doTest(519, '[foo *[bar [baz](/uri)](/uri)*](/uri)');
    doTest(520, '![[[foo](uri1)](uri2)](uri3)');
    doTest(521, '*[foo*](/uri)'); // These cases illustrate the precedence of link text grouping over emphasis grouping
    doTest(522, '[foo *bar](baz*)');
    doTest(523, '*foo [bar* baz]'); // Note that brackets that *aren’t* part of links do not take precedence
    doTest(524, '[foo <bar attr="](baz)">'); // These cases illustrate the precedence of HTML tags, code spans, and autolinks over link grouping
    doTest(525, '[foo`](/uri)`');
    doTest(526, '[foo<https://example.com/?search=](uri)>');
    /*doTest(527, ''); // 
    doTest(528, ''); // 
    doTest(529, ''); // 
    doTest(530, ''); // */
});


/*describe('Inline: Images', () => {
    doTest(572, '![foo](/url "title")');
    doTest(573, '![foo *bar*]\n\n[foo *bar*]: train.jpg "train & tracks"');
    doTest(574, '![foo ![bar](/url)](/url2)');
    doTest(575, '![foo [bar](/url)](/url2)');
    doTest(576, '![foo *bar*][]\n\n[foo *bar*]: train.jpg "train & tracks"');
    doTest(577, '![foo *bar*][foobar]\n\n[FOOBAR]: train.jpg "train & tracks"');
    doTest(578, '![foo](train.jpg)');
    doTest(579, 'My ![foo bar](/path/to/train.jpg  "title"   )');
    doTest(580, '![foo](<url>)');
    doTest(581, '![](/url)');
    doTest(582, '![foo][bar]\n\n[bar]: /url');
    doTest(583, '![foo][bar]\n\n[BAR]: /url');
    doTest(584, '![foo][]\n\n[foo]: /url "title"');
    doTest(585, '![*foo* bar][]\n\n[*foo* bar]: /url "title"');
    doTest(586, '![Foo][]\n\n[foo]: /url "title"');
    doTest(587, '![foo] \n[]\n\n[foo]: /url "title"');
    doTest(588, '![foo]\n\n[foo]: /url "title"'); // Shortcut
    doTest(589, '![*foo* bar]\n\n[*foo* bar]: /url "title"');
    doTest(590, '![[foo]]\n\n[[foo]]: /url "title"'); // Note that link labels cannot contain unescaped brackets
    doTest(591, '![Foo]\n\n[foo]: /url "title"'); // The link labels are case-insensitive
    doTest(592, '!\[foo]\n\n[foo]: /url "title"'); // If you just want a literal ! followed by bracketed text, you can backslash-escape the opening [
    doTest(593, '\![foo]\n\n[foo]: /url "title"'); // If you want a link after a literal !, backslash-escape the !
});*/


/*describe('Inline: Autolinks', () => {
    doTest(594, '<http://foo.bar.baz>');
    doTest(595, '<https://foo.bar.baz/test?q=hello&id=22&boolean>');
    doTest(596, '<irc://foo.bar:2233/baz>');
    doTest(597, '<MAILTO:FOO@BAR.BAZ>');
    doTest(598, '<a+b+c:d>');
    doTest(599, '<made-up-scheme://foo,bar>');
    doTest(600, '<https://../>');
    doTest(601, '<localhost:5001/foo>');
    doTest(602, '<https://foo.bar/baz bim>'); // Spaces are not allowed in autolinks
    doTest(603, '<https://example.com/\[\>'); // Backslash-escapes do not work inside autolinks
    doTest(604, '<foo@bar.example.com>'); // Examples of email autolinks
    doTest(605, '<foo+special@Bar.baz-bar0.com>');
    doTest(606, '<foo\+@bar.example.com>'); // Backslash-escapes do not work inside email autolinks
    doTest(607, '<>'); // These are not autolinks
    doTest(608, '< https://foo.bar >');
    doTest(609, '<m:abc>');
    doTest(610, '<foo.bar.baz>');
    doTest(611, 'https://example.com');
    doTest(612, 'foo@bar.example.com');
});*/


// TODO!! HTML content


describe('Inline: Hard line breaks', () => {
    doTest(633, 'foo  \nbaz');
    doTest(634, 'foo\\\nbaz'); // a backslash before the line ending may be used instead of two or more spaces
    doTest(635, 'foo       \nbaz'); // More than two spaces can be used
    doTest(636, 'foo  \n     bar'); // Leading spaces at the beginning of the next line are ignored
    doTest(637, 'foo\\\n     bar');
    //doTest(638, '*foo  \nbar*'); // Hard line breaks can occur inside emphasis, links, and other constructs that allow inline content
    //doTest(639, '*foo\\\nbar*');
    doTest(640, '`code  \nspan`'); // Hard line breaks do not occur inside code spans
    doTest(641, '`code\\\nspan`');
    //doTest(642, '<a href="foo  \nbar">'); // ... or HTML tags
    //doTest(643, '<a href="foo\\\nbar">');
    doTest(644, 'foo\\'); // Neither syntax for hard line breaks works at the end of a paragraph or other block element
    doTest(645, 'foo  ');
    doTest(646, '### foo\\');
    doTest(647, '### foo  ');
});


describe('Inline: soft line breaks', () => {
    doTest(648, 'foo\nbaz');
    //doTest(649, 'foo \n baz'); // Spaces at the end of the line and beginning of the next line are removed
});


describe('Inline: Textual content', () => {
    doTest(650, 'hello $.;\'there'); // Any characters not given an interpretation by the above rules will be parsed as plain textual content
    doTest(651, 'Foo χρῆν');
    doTest(652, 'Multiple     spaces'); // Internal spaces are preserved verbatim
});
