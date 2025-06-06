# Marki
Typescript-based extensible Markdown parser with support for incremental changes

This project provides a **Markdown processor** implemented in Typescript.


## Why does this exist?
I have needed a Markdown processor that can be run in Node.js and is highly customizable (for a propriatory Markdown dialect I'm developing for my job).

For a long time I used the popular [markdown-it](https://github.com/markdown-it/markdown-it) processor, which I still recommend!

However I eventually reached the limits of the ways it can be customized and found myself rewriting larger and larger parts of the parser.
Thus was born the idea of reinventing this particular wheel and creating a suitable Markdown processor from scratch.


## Features
As of 2025-06-01 Marki is nearing release of its most basic version — CommonMark compliant Markdown parsing matching the results of the CommonMark reference implementation.

Upcoming features:

- Tier 1 extensions: A set of extensions to the CommonMark specification that are already part of many Markdown processors, including markdown-it.
- Tier 2 extensions: A set of features that I consider reasonable and convenient extensions of the Markdown language.
  Features can be configured and individually selected to define specific Markdown dialects.
- A VS Code extension for working with Markdown using Marki under the hood.
- A renderer producing React pages from Markdown.
- A renderer for converting Markdown to JIRA markup.
