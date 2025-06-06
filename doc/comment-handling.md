# Comments in Markdown & extending their capabilities

One of the extensions of Marki over pure CommonMark concerns the handling of XML comments.

XML comments (which look `<!-- like this -->`) are the only type of comments supported in Markdown, owing to the close
relationship between Markdown and HTML.
For this reason it's desirable that XML comments in Markdown can match as many as possible of the capabilities of multi-line comments in other programming/markup languages.

The major problem we run into is that there is a reasonable sounding requirement on comments that isn't totally achievable within Markdown:

*A comment, regardless of its content, should produce the same output of its surrounding markdown as if the comment weren't present.*

The problem with this is

* A comment can contain empty lines.
* Empty lines end Markdown blocks in most cases.
* Therefore comments need to be recognized before splitting markdown into blocks (which is the biggest step in parsing),
  so that we know when an empty lines should not end the current block because it's inside a comment.
* However comments are not recognized inside literal inline elements (for example `` `<!-- this is not a comment -->` ``), just as they aren't inside string literals in other languages.
* Therefore in the following example the parser must know that this is *not* a comment and thus the paragraph ends after the first line.
  
      A paragraph containing `literal content which <!-- isn't
      
      an XML comment -->`
* This is only achievable if inline parsing is done simultaneously with block parsing, which is something the Markdown model doesn't allow
  (for example because Link definitions must be parsed before link references).

For this reason we must make the following restrictions to XML comments in Markdown:

1) Block structure defining content cannot contain XML comments. E.g. the following isn't an enumerated list item:
   
       1<!-- -->) not a list item
2) In CommonMark XML comments may contain empty lines if they are blocks themselves, but not for inline comments.

We can relax rule (2) slightly by defining:

> A group of lines that starts with fewer than four spaces and contains only XML comments (possibly with empty lines inside) and non-breaking whitespace is called a *comment line*
  (although it may represent more than one physical line).

  If a comment line appears within a non-literal block (i.e. not an indented code block or fenced section) it is treated as non-existing and doesn't interrupt/end the block.

For example, this will be a single paragraph