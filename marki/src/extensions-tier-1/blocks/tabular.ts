import { lineBreak_traits } from "src/inline/hard-break.js";
import { ParsingContext } from "../../block-parser.js";
import { InlineParser_Standard } from "../../inline-parser.js";
import { InlineParserProvider, InlineParsingContext } from "../../inline-parsing-context.js";
import { LogicalLine, LogicalLine_text, standardBlockStart } from "../../linify.js";
import { MarkdownParserTraits } from "../../markdown-parser.js";
import { Block_Extension, ExtensionBlockType, InlineContent, InlineContentElement, InlineElementBase } from "../../markdown-types.js";
import { Inserter, EasyInserter, MarkdownRendererInstance, MarkdownRendererTraits } from "../../renderer/renderer.js";
import { BlockTraits, InlineElementTraits, castExtensionBlock } from "../../traits.js";
import { makeBlockContentIterator } from "../../util.js";
import { pairUpDelimiters } from "src/delimiter-processing.js";
import { inlineTrimRight } from "src/renderer/util.js";

export const tabular_type = "ext_tier1_tabular" as const;
const tabular_cellbr_type = "ext_tier1_tabular_cellbr" as const;

export type TabularHalign = "left" | "right" | "center" | "justify";
const halign_finder: Record<string, TabularHalign> = { '<': "left",  '>': "right",  '><': "center",  '<>': "justify" };

export interface TabularColumnFormat {
    halign: TabularHalign;
}

export interface MarkdownTabularRow {
    LL: LogicalLine_text;
    
    cells: { content: InlineContent; }[];
}

export interface MarkdownTabularSection {
    LLs:  LogicalLine_text[];
    rows: MarkdownTabularRow[];
}

export interface MarkdownTabular {
    head:     MarkdownTabularSection;
    body:     MarkdownTabularSection;
    format:   TabularColumnFormat[];
    nColumns: number;
}


function isFormatLine(LL: LogicalLine) {
    if(LL.type !== "text" || !LL.content.startsWith('|'))
        return false;
    let rexres = /^\|((?:[\-<>]+\|)+)\s*$/.exec(LL.content);
    if(!rexres)
        return false;
    const colsFormats = rexres[1].slice(0, -1).split('|');
    const cols: TabularColumnFormat[] = [];
    for(const f of colsFormats) {
        if(!(rexres = /^-*(<>?|><?)?-*$/.exec(f)))
            return false;
        const F: TabularColumnFormat = { halign: "left" };
        if(rexres[1])
            F.halign = halign_finder[rexres[1]];
        cols.push(F);
    }
    return cols;
}



interface TabularCellbrMarker {
    type:          typeof tabular_cellbr_type;
    rowContinuing: boolean;
}

const isTabularCellBreak = (elt: InlineContentElement): elt is TabularCellbrMarker & InlineElementBase<typeof tabular_cellbr_type> =>
    (typeof elt !== "string" && elt.type == tabular_cellbr_type);


export const tabular_cellbr_traits: InlineElementTraits<typeof tabular_cellbr_type, TabularCellbrMarker & InlineElementBase<typeof tabular_cellbr_type>> = {
    startChars: [ '|' ],
    parse(It, B) {
        It.pop();
        B.rowContinuing = (It.peek() == '\\');
        if (B.rowContinuing)
            It.pop();
        It.skipNobrSpace();
        return true;
    },
    creator(ctx) { return new InlineParser_Standard<typeof tabular_cellbr_type>(ctx, this); },
    defaultElementInstance: { type: tabular_cellbr_type,  rowContinuing: false }
};


function inlineProcessTabularSection(ctx: ParsingContext, IPP: InlineParserProvider, S: MarkdownTabularSection) {
    let It = makeBlockContentIterator(S.LLs[0]);
    const buf: InlineContent = [];
    let elt1: InlineContentElement = '';
    const context = new InlineParsingContext(IPP, ctx.MDP);
    context.inlineParseLoop(It, buf);
    let i0 = 0,  i_row = 0,  i_cell = -1;
    const flush = (i1: number) => {
        if(i_cell >= 0 && i1 > i0) { // flush contents to cell
            const row = (S.rows[i_row] ||= { LL: S.LLs[0],  cells: [] });
            const C = (row.cells[i_cell] ||= { content: [] }).content;
            if (C.length > 0) {
                inlineTrimRight(C);
                C.push({ type: "lineBreak" } as InlineContentElement);
            }
            C.push(... buf.slice(i0, i1));
        }
        i0 = i1 + 1;
        ++i_cell;
    };

    buf.forEach((elt, i) => {
        if(typeof elt === "string")
            return;
        if(elt.type === "lineBreak") {
            if(i > 0 && isTabularCellBreak(elt1 = buf[i - 1])) {
                if(elt1.rowContinuing)
                    --i_row;
            }
            else
                flush(i);
            ++i_row;
            i_cell = -1;
        }
        else if(isTabularCellBreak(elt))
            flush(i);
    });
    if(buf.length > 0 && !isTabularCellBreak(elt1 = buf[buf.length - 1]))
        flush(buf.length);

    for(const row of S.rows) {
        for(const cell of row.cells)
            pairUpDelimiters(cell.content);
    }
}


export const markdown_tabular_traits: BlockTraits<ExtensionBlockType, MarkdownTabular> = {
    blockType: tabular_type,

    startsHere(LL) {
        if(!standardBlockStart(LL))
            return -1;
        if(!LL.content.startsWith('|'))
            return -1;
        const F = isFormatLine(LL);
        if(F)
            this.B.format = F;
        else
            this.B.head.LLs.push({ ... LL });
        return 0;
    },

    continuesHere(LL) {
        const hadFormat = (this.B.format.length > 0);
        if(!standardBlockStart(LL) || !LL.content.startsWith('|'))
            return (hadFormat ? "end" : "reject");
        if(!hadFormat) {
            const F = isFormatLine(LL);
            if(F)    this.B.format = F;
        } else
            (hadFormat ? this.B.body : this.B.head).LLs.push({ ... LL });
        return 0;
    },

    finalizeBlockHook() {
        const B = this.B;
        // if the table ended and there was no format line, all the content is <tbody>, not <thead>
        const hadFormat = (B.format.length > 0);
        if(!hadFormat) {
            B.body = B.head;
            B.head = { LLs: [],  rows: [] };
        }
        // link lines of each section together for inline processing
        for(const S of [B.head, B.body]) {
            for(let i = 0, iN = S.LLs.length - 1;  i <= iN;  ++i)
                S.LLs[i].next = (i < iN ? S.LLs[i + 1] : undefined);
        }

        const nCols = Math.max(B.head.rows.reduce((max, F) => Math.max(max, F.cells.length), B.format.length),
                               B.body.rows.reduce((max, F) => Math.max(max, F.cells.length), B.format.length));
        for(let i = B.format.length;  i < nCols;  ++i)
            B.format.push({ halign: "left" });
    },

    allowSoftContinuations: false,
    allowCommentLines: true,

    inlineProcessing(B) {
        if(!castExtensionBlock(B, markdown_tabular_traits))    return;
        const IPP = this.MDP.MDPT.customInlineParserProviders[tabular_type];
        if(!IPP)    return;

        inlineProcessTabularSection(this, IPP, B.head);
        inlineProcessTabularSection(this, IPP, B.body);
    },

    defaultBlockInstance: {
        head: { LLs: [],  rows: [] },
        body: { LLs: [],  rows: [] },
        format: [],
        nColumns: 0
    }
};


/* Rendering stuff */

/*function printTabularColFormats(format: TabularColumnFormat[], I: Inserter) {
    let lastRelevant = -1;
    format.forEach((F, i) => { if(F.halign !== "left")    lastRelevant = i; });
    if(lastRelevant < 0) // all columns have default format
        return;
    I.add('<colgroup>');
    const Fs: (TabularColumnFormat & { n: number; })[] = [ { ... format[0],  n: 1 }];
    // collate identical column formats
    for(let i = 1;  i <= lastRelevant;  ++i) {
        const F0 = Fs[Fs.length - 1],  F = format[i];
        if(F.halign === F0.halign)
            ++F0.n;
        else
            Fs.push({ ... F,  n: 1 });
    }
    Fs.forEach(F => I.add(`  <col${F.n > 1 ? ` span="${F.n}"`:''} style="text-align:${F.halign}">`));
    I.add('</colgroup>');
}*/

function printTableRow(renderer: MarkdownRendererInstance, R: MarkdownTabularRow, Fs: TabularColumnFormat[] | null, I: Inserter, header: boolean) {
    const I1 = new EasyInserter();
    I1.add('  <tr>');
    const open = (header ? '<th' : '<td'), close = (header ? '</th>' : '</td>');
    R.cells.forEach((C, i) => {
        const F = Fs?.[i];
        const classes: string[] = [];
        if(F && F.halign != "left")
            classes.push(F.halign[0]);
        I1.add(open);
        if(classes.length > 0)
            I1.add(` class="${classes.join(' ')}"`);
        I1.add('>');
        renderer.inlineRenderer.render(C.content, I1, true);
        I1.add(close);
    });
    I1.add('</tr>');
    I.add(I1.join(''));
}

export function ext_tier1_tabular_render(this: MarkdownRendererInstance, B: Block_Extension, I: Inserter) {
    if(!castExtensionBlock(B, markdown_tabular_traits))    return;
    I.add(`<table>`);
    //printTabularColFormats(B.format, I);
    if(B.head.rows.length > 0) {
        I.add('<thead>');
        for(const R of B.head.rows)
            printTableRow(this, R, B.format, I, true);
        I.add('</thead>');
    }
    if(B.body.rows.length > 0) {
        I.add('<tbody>');
        for(const R of B.body.rows)
            printTableRow(this, R, B.format, I, false);
        I.add('</tbody>');
    }
    I.add('</table>');
};


export function extend_tier1_tabular(MDPT: MarkdownParserTraits, MDRT?: MarkdownRendererTraits) {
    const table_cell_parser = new InlineParserProvider(MDPT, MDPT.inlineParser_standard);
    //table_cell_parser.delims[braced_start_traits.name] = braced_start_traits;
    table_cell_parser.traits["lineBreak"] = lineBreak_traits;
    table_cell_parser.traits[tabular_cellbr_type] = tabular_cellbr_traits;
    MDPT.customInlineParserProviders[tabular_type] = table_cell_parser;
}
