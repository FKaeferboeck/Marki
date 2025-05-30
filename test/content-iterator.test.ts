import { describe } from 'vitest'
import { doTest } from './referenceRender.test';


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
    doTest(342, '[not a `link](/foo`)'); // And this is not parsed as a link
    doTest(343, '`<a href="`">`'); // Code spans, HTML tags, and autolinks have the same precedence. Thus, this is code
    //doTest(344, '<a href="`">`'); // But this is an HTML tag
    doTest(345, '`<https://foo.bar.`baz>`'); // And this is code
    //doTest(346, '<https://foo.bar.`baz>`'); // But this is an autolink
    doTest(347, '```foo``'); // When a backtick string is not closed by a matching backtick string, we just have literal backticks
    doTest(348, '`foo');
    doTest(349, '`foo``bar``'); // opening and closing backtick strings need to be equal in length
});


describe('Emphasis & strong emphasis', () => {
    /* Role 1 */
    doTest(350, '*foo bar*');
    doTest(351, 'a * foo bar*'); // This is not emphasis, because the opening * is followed by whitespace, and hence not part of a left-flanking delimiter run
    doTest(352, 'a*"foo"*'); // This is not emphasis, because the opening * is preceded by an alphanumeric and followed by punctuation, and hence not part of a left-flanking delimiter run
    doTest(353, '*\u00A0a\u00A0*'); // Unicode nonbreaking spaces count as whitespace, too
    doTest(354, '*$*alpha.\n\n*£*bravo.\n\n*€*charlie.'); // Unicode symbols count as punctuation, too
    doTest(355, 'foo*bar*'); // Intraword emphasis with * is permitted
    doTest(356, '5*6*78');
    /* Rule 2 */
    doTest(357, '_foo bar_');
    doTest(358, '_ foo bar_'); // This is not emphasis, because the opening _ is followed by whitespace
    doTest(359, 'a_"foo"_'); // This is not emphasis, because the opening _ is preceded by an alphanumeric and followed by punctuation
    doTest(360, 'foo_bar_'); // Emphasis with _ is not allowed inside words
    doTest(361, '5_6_78');
    doTest(362, 'пристаням_стремятся_');
    doTest(363, 'aa_"bb"_cc'); // Here _ does not generate emphasis, because the first delimiter run is right-flanking and the second left-flanking
    doTest(364, 'foo-_(bar)_'); // This is emphasis, even though the opening delimiter is both left- and right-flanking, because it is preceded by punctuation
    /* Rule 3 */
    doTest(365, '_foo*'); // This is not emphasis, because the closing delimiter does not match the opening delimiter
    doTest(366, '*foo bar *'); // This is not emphasis, because the closing * is preceded by whitespace
    doTest(367, '*foo bar\n*'); // A line ending also counts as whitespace
    doTest(368, '*(*foo)'); // This is not emphasis, because the second * is preceded by punctuation and followed by an alphanumeric
    doTest(369, '*(*foo*)*'); // The point of this restriction is more easily appreciated with this example
    doTest(370, '*foo*bar'); // Intraword emphasis with * is allowed
    /* Rule 4 */
    doTest(371, '_foo bar _'); // This is not emphasis, because the closing _ is preceded by whitespace
    doTest(372, '_(_foo)'); // This is not emphasis, because the second _ is preceded by punctuation and followed by an alphanumeric
    doTest(373, '_(_foo_)_'); // This is emphasis within emphasis
    doTest(374, '_foo_bar'); // Intraword emphasis is disallowed for _
    doTest(375, '_пристаням_стремятся');
    doTest(376, '_foo_bar_baz_');
    doTest(377, '_(bar)_.'); // This is emphasis, even though the closing delimiter is both left- and right-flanking, because it is followed by punctuation
    /* Rule 5 */
    doTest(378, '**foo bar**');
    doTest(379, '** foo bar**'); // This is not strong emphasis, because the opening delimiter is followed by whitespace
    doTest(380, 'a**"foo"**'); // This is not strong emphasis, because the opening ** is preceded by an alphanumeric and followed by punctuation
    doTest(381, 'foo**bar**'); // Intraword strong emphasis with ** is permitted
    /* Rule 6 */
    doTest(382, '__foo bar__');
    doTest(383, '__ foo bar__'); // This is not strong emphasis, because the opening delimiter is followed by whitespace
    doTest(384, '__\nfoo bar__'); // A line ending counts as whitespace
    doTest(385, 'a__"foo"__'); // This is not strong emphasis, because the opening __ is preceded by an alphanumeric and followed by punctuation
    doTest(386, 'foo__bar__'); // Intraword strong emphasis is forbidden with __
    doTest(387, '5__6__78');
    doTest(388, 'пристаням__стремятся__');
    doTest(389, '__foo, __bar__, baz__');
    doTest(390, 'foo-__(bar)__'); // This is strong emphasis, even though the opening delimiter is both left- and right-flanking, because it is preceded by punctuation
    /* Rule 7 */
    doTest(391, '**foo bar **'); // This is not strong emphasis, because the closing delimiter is preceded by whitespace
    doTest(392, '**(**foo)'); // This is not strong emphasis, because the second ** is preceded by punctuation and followed by an alphanumeric
    doTest(393, '*(**foo**)*'); // The point of this restriction is more easily appreciated with these examples
    doTest(394, '**Gomphocarpus (*Gomphocarpus physocarpus*, syn.\n*Asclepias physocarpa*)**');
    doTest(395, '**foo "*bar*" foo**');
    doTest(396, '**foo**bar'); // Intraword emphasis
    /* Rule 8 */
    doTest(397, '__foo bar __'); // This is not strong emphasis, because the closing delimiter is preceded by whitespace
    doTest(398, '__(__foo)'); // This is not strong emphasis, because the second __ is preceded by punctuation and followed by an alphanumeric
    doTest(399, '_(__foo__)_'); // The point of this restriction is more easily appreciated with this example
    doTest(400, '__foo__bar'); // Intraword strong emphasis is forbidden with __
    doTest(401, '__пристаням__стремятся');
    doTest(402, '__foo__bar__baz__');
    doTest(403, '__(bar)__.'); // This is strong emphasis, even though the closing delimiter is both left- and right-flanking, because it is followed by punctuation
    /* Rule 9 */
    doTest(404, '*foo [bar](/url)*'); // Any nonempty sequence of inline elements can be the contents of an emphasized span
    doTest(405, '*foo\nbar*');
    doTest(406, '_foo __bar__ baz_'); // In particular, emphasis and strong emphasis can be nested inside emphasis
    doTest(407, '_foo _bar_ baz_');
    doTest(408, '__foo_ bar_');
    doTest(409, '*foo *bar**');
    doTest(410, '*foo **bar** baz*');
    doTest(411, '*foo**bar**baz*'); // special case "multiples of 3"
    doTest(412, '*foo**bar*');
    doTest(413, '***foo** bar*'); // The same condition ensures that the following cases are all strong emphasis nested inside emphasis, even when the interior whitespace is omitted
    doTest(414, '*foo **bar***');
    doTest(415, '*foo**bar***');
    doTest(416, 'foo***bar***baz'); // When the lengths of the interior closing and opening delimiter runs are both multiples of 3, though, they can match to create emphasis
    doTest(417, 'foo******bar*********baz');
    doTest(418, '*foo **bar *baz* bim** bop*'); // Indefinite levels of nesting are possible
    doTest(419, '*foo [*bar*](/url)*'); // 
    doTest(420, '** is not an empty emphasis'); // There can be no empty emphasis or strong emphasis
    doTest(421, '**** is not an empty strong emphasis');
    /* Rule 10 */
    doTest(422, '**foo [bar](/url)**'); // Any nonempty sequence of inline elements can be the contents of an strongly emphasized span
    doTest(423, '**foo\nbar**');
    doTest(424, '__foo _bar_ baz__'); // In particular, emphasis and strong emphasis can be nested inside strong emphasis
    doTest(425, '__foo __bar__ baz__');
    doTest(426, '____foo__ bar__');
    doTest(427, '**foo **bar****');
    doTest(428, '**foo *bar* baz**');
    doTest(429, '**foo*bar*baz**');
    doTest(430, '***foo* bar**');
    doTest(431, '**foo *bar***');
    doTest(432, '**foo *bar **baz**\nbim* bop**'); // Indefinite levels of nesting are possible
    doTest(433, '**foo [*bar*](/url)**');
    doTest(434, '__ is not an empty emphasis'); // There can be no empty emphasis or strong emphasis
    doTest(435, '____ is not an empty strong emphasis');
    /* Rule 11 */
    doTest(436, 'foo ***');
    doTest(437, 'foo *\**');
    doTest(438, 'foo *_*');
    doTest(439, 'foo *****');
    doTest(440, 'foo **\***');
    doTest(441, 'foo **_**');
    doTest(442, '**foo*'); // Note that when delimiters do not match evenly, Rule 11 determines that the excess literal * characters will appear outside of the emphasis, rather than inside it
    doTest(443, '*foo**');
    doTest(444, '***foo**');
    doTest(445, '****foo*');
    doTest(446, '**foo***');
    doTest(447, '*foo****');
    /* Rule 12 */
    doTest(448, 'foo ___');
    doTest(449, 'foo _\__');
    doTest(450, 'foo _*_');
    doTest(451, 'foo _____');
    doTest(452, 'foo __\___');
    doTest(453, 'foo __*__');
    doTest(454, '__foo_');
    doTest(455, '_foo__'); // Note that when delimiters do not match evenly, Rule 12 determines that the excess literal _ characters will appear outside of the emphasis, rather than inside it
    doTest(456, '___foo__');
    doTest(457, '____foo_');
    doTest(458, '__foo___');
    doTest(459, '_foo____');
    doTest(460, '**foo**'); // Rule 13 implies that if you want emphasis nested directly inside emphasis, you must use different delimiters
    doTest(461, '*_foo_*');
    doTest(462, '__foo__');
    doTest(463, '_*foo*_');
    doTest(464, '****foo****'); // However, strong emphasis within strong emphasis is possible without switching delimiters
    doTest(465, '____foo____');
    doTest(466, '******foo******'); // Rule 13 can be applied to arbitrarily long sequences of delimiters
    /* Rule 14 */
    doTest(467, '***foo***');
    doTest(468, '_____foo_____');
    /* Rule 15 */
    doTest(469, '*foo _bar* baz_');
    doTest(470, '*foo __bar *baz bim__ bam*');
    /* Rule 16 */
    doTest(471, '**foo **bar baz**');
    doTest(472, '*foo *bar baz*');
    /* Rule 17 */
    doTest(473, '*[bar*](/url)');
    doTest(474, '_foo [bar_](/url)');
    //doTest(475, '*<img src="foo" title="*"/>');
    //doTest(476, '**<a href="**">');
    //doTest(477, '__<a href="__">');
    doTest(478, '*a `*`*');
    doTest(479, '_a `_`_');
    /*doTest(480, '**a<https://foo.bar/?q=**>');
    doTest(481, '__a<https://foo.bar/?q=__>');*/
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
    //doTest(491, '[link](<foo\nbar>)');
    doTest(492, '[a](<b)c>)'); // The destination can contain ) if it is enclosed in pointy brackets
    doTest(493, '[link](<foo\>)'); // Pointy brackets that enclose links must be unescaped
    //doTest(494, '[a](<b)c\n[d](<e)f>\n[g](<h>i)', true); // These are not links, because the opening pointy bracket is not matched properly
    doTest(495, '[link](\\(fo\\))'); // Parentheses inside the link destination may be escaped
    doTest(496, '[link](foo(and(bar)))'); // Any number of parentheses are allowed without escaping, as long as they are balanced
    doTest(497, '[link](foo(and(bar))'); // However, if you have unbalanced parentheses, you need to escape or use the <...> form
    doTest(498, '[link](foo\\(and\\(bar\\))');
    doTest(499, '[link](<foo(and(bar)>)');
    doTest(500, '[link](foo\\)\:)'); // Parentheses and other symbols can also be escaped, as usual in Markdown
    doTest(501, '[link](#fragment)\n\n[link](https://example.com#fragment)\n\n[link](https://example.com?foo=3#frag)'); // A link can contain fragment identifiers and queries
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
    doTest(512, '[link [foo [bar]]](/uri)'); // The link text may contain balanced brackets, but not unbalanced ones, unless they are escaped
    doTest(513, '[linki] bar](/uri)');
    doTest(514, '[linki [bar](/uri)');
    doTest(515, '[link \\[bar](/uri)');
    doTest(516, '[link *foo **bar** `#`*](/uri)'); // The link text may contain inline content
    doTest(517, '[![moon](moon.jpg)](/uri)');
    doTest(518, '[foo [bar](/uri)](/uri)'); // However, links may not contain other links, at any level of nesting
    doTest(519, '[foo *[bar [baz](/uri)](/uri)*](/uri)');
    doTest(520, '![[[foo](uri1)](uri2)](uri3)');
    doTest(521, '*[foo*](/uri)'); // These cases illustrate the precedence of link text grouping over emphasis grouping
    doTest(522, '[foo *bar](baz*)');
    doTest(523, '*foo [bar* baz]'); // Note that brackets that *aren't* part of links do not take precedence
    //doTest(524, '[foo <bar attr="](baz)">'); // These cases illustrate the precedence of HTML tags, code spans, and autolinks over link grouping
    doTest(525, '[foo`](/uri)`');
    //doTest(526, '[foo<https://example.com/?search=](uri)>');
    /* full reference links */
    doTest(527, '[foo][bar]\n\n[bar]: /url "title"');
    doTest(528, '[link [foo [bar]]][ref]\n\n[ref]: /uri'); // The link text may contain balanced brackets, but not unbalanced ones, unless they are escaped
    doTest(529, '[link \[bar][ref]\n\n[ref]: /uri');
    doTest(530, '[link *foo **bar** `#`*][ref]\n\n[ref]: /uri'); // The link text may contain inline content
    doTest(531, '[![moon](moon.jpg)][ref]\n\n[ref]: /uri');
    doTest(532, '[foo [bar](/uri)][ref]\n\n[ref]: /uri'); // However, links may not contain other links, at any level of nesting
    doTest(533, '[foo *bar [baz][ref]*][ref]\n\n[ref]: /uri');
    doTest(534, '*[foo*][ref]\n\n[ref]: /uri'); // The following cases illustrate the precedence of link text grouping over emphasis grouping
    doTest(535, '[foo *bar][ref]*\n\n[ref]: /uri');
    //doTest(536, '[foo <bar attr="][ref]">\n\n[ref]: /uri'); // These cases illustrate the precedence of HTML tags, code spans, and autolinks over link grouping
    doTest(537, '[foo`][ref]`\n\n[ref]: /uri');
    //doTest(538, '[foo<https://example.com/?search=][ref]>\n\n[ref]: /uri');
    doTest(539, '[foo][BaR]\n\n[bar]: /url "title"'); // Matching is case-insensitive
    doTest(540, '[ẞ]\n\n[SS]: /url'); // Unicode case fold is used
    doTest(541, '[Foo\n  bar]: /url\n\n[Baz][Foo bar]'); // Consecutive internal spaces, tabs, and line endings are treated as one space for purposes of determining matching
    doTest(542, '[foo] [bar]\n\n[bar]: /url "title"'); // No spaces, tabs, or line endings are allowed between the link text and the link label
    doTest(543, '[foo]\n[bar]\n\n[bar]: /url "title"');
    doTest(544, '[foo]: /url1\n\n[foo]: /url2\n\n[bar][foo]'); // When there are multiple matching link reference definitions, the first is used
    doTest(545, '[bar][foo\\!]\n\n[foo!]: /url'); // matching is performed on normalized strings, not parsed inline content
    doTest(546, '[foo][ref[]\n\n[ref[]: /uri'); // Link labels cannot contain brackets, unless they are backslash-escaped
    doTest(547, '[foo][ref[bar]]\n\n[ref[bar]]: /uri');
    doTest(548, '[[[foo]]]\n\n[[[foo]]]: /url');
    doTest(549, '[foo][ref\\[]\n\n[ref\\[]: /uri');
    doTest(550, '[bar\\\\]: /uri\n\n[bar\\\\]'); // Note that in this example ] is not backslash-escaped
    doTest(551, '[]\n\n[]: /uri'); // A link label must contain at least one character that is not a space, tab, or line ending
    doTest(552, '[\n ]\n\n[\n ]: /uri');
    /* collapsed reference link */
    doTest(553, '[foo][]\n\n[foo]: /url "title"');
    doTest(554, '[*foo* bar][]\n\n[*foo* bar]: /url "title"'); // 
    doTest(555, '[Foo][]\n\n[foo]: /url "title"'); // The link labels are case-insensitive
    doTest(556, '[foo] \n[]\n\n[foo]: /url "title"'); // As with full reference links, spaces, tabs, or line endings are not allowed between the two sets of brackets
    /* shortcut reference link */
    doTest(557, '[foo]\n\n[foo]: /url "title"');
    doTest(558, '[*foo* bar]\n\n[*foo* bar]: /url "title"');
    doTest(559, '[[*foo* bar]]\n\n[*foo* bar]: /url "title"');
    doTest(560, '[[bar [foo]\n\n[foo]: /url');
    doTest(561, '[Foo]\n\n[foo]: /url "title"'); // The link labels are case-insensitive
    doTest(562, '[foo] bar\n\n[foo]: /url'); // A space after the link text should be preserved
    doTest(563, '\\[foo]\n\n[foo]: /url "title"'); // If you just want bracketed text, you can backslash-escape the opening bracket to avoid links
    doTest(564, '[foo*]: /url\n\n*[foo*]'); // Note that this is a link, because a link label ends with the first following closing bracket
    doTest(565, '[foo][bar]\n\n[foo]: /url1\n[bar]: /url2'); // Full and collapsed references take precedence over shortcut references
    doTest(566, '[foo][]\n\n[foo]: /url1');
    doTest(567, '[foo]()\n\n[foo]: /url1'); // Inline links also take precedence
    doTest(568, '[foo](not a link)\n\n[foo]: /url1');
    doTest(569, '[foo][bar][baz]\n\n[baz]: /url'); // In the following case [bar][baz] is parsed as a reference, [foo] as normal text
    doTest(570, '[foo][bar][baz]\n\n[baz]: /url1\n[bar]: /url2'); // Here, though, [foo][bar] is parsed as a reference, since [bar] is defined
    doTest(571, '[foo][bar][baz]\n\n[baz]: /url1\n[foo]: /url2'); // Here [foo] is not parsed as a shortcut reference, because it is followed by a link label (even though [bar] is not defined)
});


describe('Inline: Images', () => {
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
});


describe('Inline: Autolinks', () => {
    doTest(594, '<http://foo.bar.baz>');
    doTest(595, '<https://foo.bar.baz/test?q=hello&id=22&boolean>');
    doTest(596, '<irc://foo.bar:2233/baz>');
    doTest(597, '<MAILTO:FOO@BAR.BAZ>');
    doTest(598, '<a+b+c:d>');
    doTest(599, '<made-up-scheme://foo,bar>');
    doTest(600, '<https://../>');
    doTest(601, '<localhost:5001/foo>');
    doTest(602, '<https://foo.bar/baz bim>'); // Spaces are not allowed in autolinks
    doTest(603, '<https://example.com/\\[\\>'); // Backslash-escapes do not work inside autolinks
    doTest(604, '<foo@bar.example.com>'); // Examples of email autolinks
    doTest(605, '<foo+special@Bar.baz-bar0.com>');
    doTest(606, '<foo\+@bar.example.com>'); // Backslash-escapes do not work inside email autolinks
    doTest(607, '<>'); // These are not autolinks
    doTest(608, '< https://foo.bar >');
    doTest(609, '<m:abc>');
    doTest(610, '<foo.bar.baz>');
    doTest(611, 'https://example.com');
    doTest(612, 'foo@bar.example.com');
});


/*describe('Inline: Raw HTML', () => {
    /*doTest(613, '<a><bab><c2c>'); // Here are some simple open tags
    doTest(614, '<a/><b2/>'); // Empty elements
    doTest(615, '<a  /><b2\ndata="foo" >'); // Whitespace is allowed
    doTest(616, '<a foo="bar" bam = 'baz <em>"</em>'\n_boolean zoop:33=zoop:33 />'); // With attributes
    doTest(617, 'Foo <responsive-image src="foo.jpg" />'); // Custom tag names can be used
    doTest(618, '<33> <__>'); // Illegal tag names, not parsed as HTML
    doTest(619, '<a h*#ref="hi">'); // Illegal attribute names
    doTest(620, '<a href="hi'> <a href=hi'>'); // Illegal attribute values
    doTest(621, '< a><\nfoo><bar/ >\n<foo bar=baz\nbim!bop />'); // Illegal whitespace
    doTest(622, '<a href='bar'title=title>'); // Missing whitespace
    doTest(623, '</a></foo >'); // Closing tags
    doTest(624, '</a href="foo">'); // Illegal attributes in closing tag
    doTest(625, 'foo <!-- this is a --\ncomment - with hyphens -->'); // Comments
    doTest(626, 'foo <!--> foo -->\n\nfoo <!---> foo -->');
    doTest(627, 'foo <?php echo $a; ?>'); // Processing instructions
    doTest(628, 'foo <!ELEMENT br EMPTY>'); // Declarations
    doTest(629, 'foo <![CDATA[>&<]]>'); // CDATA sections
    doTest(630, 'foo <a href="&ouml;">'); // Entity and numeric character references are preserved in HTML attributes
    doTest(631, 'foo <a href="\*">'); // Backslash escapes do not work in HTML attributes
    doTest(632, '<a href="\"">');
});*/


describe('Inline: Hard line breaks', () => {
    doTest(633, 'foo  \nbaz');
    doTest(634, 'foo\\\nbaz'); // a backslash before the line ending may be used instead of two or more spaces
    doTest(635, 'foo       \nbaz'); // More than two spaces can be used
    doTest(636, 'foo  \n     bar'); // Leading spaces at the beginning of the next line are ignored
    doTest(637, 'foo\\\n     bar');
    doTest(638, '*foo  \nbar*'); // Hard line breaks can occur inside emphasis, links, and other constructs that allow inline content
    doTest(639, '*foo\\\nbar*');
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

/* End of the CommonMark 0.31.2 examples */
