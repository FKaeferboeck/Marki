import { describe, expect, it, test } from 'vitest'
import { linify } from '../src/parser';
import { lineDataAll } from '../src/util';
import { MarkdownParser } from '../src/markdown-parser';
import { AnyInline } from '../src/markdown-types';
import { referenceRenderInline } from '../src/renderer/referenceRenderer'
import * as commonmark from 'commonmark';


const parser = new MarkdownParser();
parser.makeStartCharMap();

var commonmark_reader = new commonmark.Parser();
var commonmark_writer = new commonmark.HtmlRenderer();


function doTest(idx: number | string, input: string, verbose = false) {
    test('' + idx, () => {
        const LS   = linify(input);
        const LLD  = lineDataAll(LS, 0);
        
        const data = parser.processInline(LLD);
        const rendered = referenceRenderInline(data);
        if(verbose)
            console.log(data);

        const commonmark_parsed = commonmark_reader.parse(input);
        const commonmark_result = commonmark_writer.render(commonmark_parsed) as string;
        if(verbose)
            console.log('CommonMark:', commonmark_result);
        expect(rendered).toEqual(commonmark_result);
    });
}


describe('Inline: Code spans', () => {
    doTest(327, '`hi`lo`');
    doTest(328, '`foo`');
    doTest(329, '`` foo ` bar ``');
    doTest(330, '` `` `');
    doTest(331, '`  ``  `');
    doTest(332, '` a`');
    doTest(333, '`\u00A0b\u00A0`'); // unicode whitespace
    doTest(334, '` `\n`  `');
    doTest(335, '``\nfoo\nbar  \nbaz\n``');
    doTest(336, '``\nfoo \n``');
    doTest(337, '`foo   bar \nbaz`');
    doTest(338, '`foo\`bar`');
    doTest(339, '``foo`bar``');
    doTest(340, '` foo `` bar `');
    doTest(341, '*foo`*`');
    doTest(342, '[not a `link](/foo`)');
    doTest(343, '`<a href="`">`');
    doTest(344, '<a href="`">`');
    doTest(345, '`<https://foo.bar.`baz>`');
    //doTest(346, '<https://foo.bar.`baz>`');
    doTest(347, '```foo``');
    doTest(348, '`foo');
    doTest(349, '`foo``bar``');
});


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
    doTest(511, '[link] (/uri)'); // But it is not allowed between the link text and the following parenthesis
    doTest(512, '[link [foo [bar]]](/uri)'); // The link text may contain balanced brackets, but not unbalanced ones, unless they are escaped
    doTest(513, '[link] bar](/uri)');
    doTest(514, '[link [bar](/uri)');
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
