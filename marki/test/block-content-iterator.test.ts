import { describe, it, expect } from "vitest";
import { linify, LogicalLine } from "../src/linify";
import { makeBlockContentIterator } from "../src/util";

const text0 = `Line 1
   Line indent
   
   Line indent 2   
<!-- Comment line -->
   <!-- not comment line -->

Last line`;


describe('block content iterator', () => {
    function perform(input: string, with_cmt_lines: boolean, singleLine = false) {
        const LLs = linify(input, with_cmt_lines);
        const It = makeBlockContentIterator(LLs[0] as LogicalLine, singleLine);
        const buf: string[] = [];
        let c: string | false = false;
        while(true) {
            //It.stateInfo();
            if(!(c = It.pop()))    break;
            buf.push(c);
        }
        return buf.join('');
    }

    it('no comment', () => {
        const output = perform(text0, false);
        expect(output).toBe('Line 1\nLine indent\n\nLine indent 2   \n<!-- Comment line -->\n<!-- not comment line -->\n\nLast line');
    });

    it('comment aware', () => {
        const output = perform(text0, true);
        expect(output).toBe('Line 1\nLine indent\n\nLine indent 2   \n<!-- not comment line -->\n\nLast line');
    });

    it('single line', () => {
        const output = perform(' \t Single line\nnext line', false, true);
        expect(output).toBe('Single line');
    });

    it('empty input', () => {
        expect(perform('',    false))      .toBe('');
        expect(perform('',    false, true)).toBe('');
        expect(perform(' \t', false))      .toBe('');
    });

    it('trailing break', () => {
        expect(perform('Text\n\n',         false)).toBe('Text\n\n');
        expect(perform('\nText\n\n',       false)).toBe('\nText\n\n');
        expect(perform('Text\n<!-- -->',   true)) .toBe('Text');
        expect(perform('Text\n<!-- -->\n', true)) .toBe('Text\n');
    });
});


describe('block content reverse iteration', () => {
    function perform(input: string, with_cmt_lines: boolean, singleLine = false) {
        const LLs = linify(input, with_cmt_lines);
        const It = makeBlockContentIterator(LLs[0] as LogicalLine, singleLine);
        const buf: string[] = [];
        let c: string | false = false;
        It.goToEnd();
        while(true) {
            //It.stateInfo();
            if(!(c = It.unpop()))    break;
            buf.push(c);
        }
        return buf.reverse().join('');
    }

    it('no comment', () => {
        const output = perform(text0, false);
        expect(output).toBe('Line 1\nLine indent\n\nLine indent 2   \n<!-- Comment line -->\n<!-- not comment line -->\n\nLast line');
    });

    it('comment aware', () => {
        const output = perform(text0, true);
        expect(output).toBe('Line 1\nLine indent\n\nLine indent 2   \n<!-- not comment line -->\n\nLast line');
    });

    it('single line', () => {
        const output = perform(' \t Single line\nnext line', false, true);
        expect(output).toBe('Single line');
    });

    it('empty input', () => {
        expect(perform('',    false))      .toBe('');
        expect(perform('',    false, true)).toBe('');
        expect(perform(' \t', false))      .toBe('');
    });

    it('trailing break', () => {
        expect(perform('Text\n\n',         false)).toBe('Text\n\n');
        expect(perform('\nText\n\n',       false)).toBe('\nText\n\n');
        expect(perform('Text\n<!-- -->',   true)) .toBe('Text');
        expect(perform('Text\n<!-- -->\n', true)) .toBe('Text\n');
    });
});
