import { InlineParser_Standard } from "../../inline-parser.js";
import { InlineParserProvider, InlineParsingContext } from "../../inline-parsing-context.js";
import { LogicalLine, LogicalLine_text, standardBlockStart } from "../../linify.js";
import { MarkdownParser, standardDelimiterTraits, standardInlineParserTraits } from "../../markdown-parser.js";
import { Block_Extension, ExtensionBlockType, InlineContent, InlineElementBase } from "../../markdown-types.js";
import { Inserter, EasyInserter, Renderer } from "../../renderer/renderer.js";
import { BlockTraits, InlineElementTraits, castExtensionBlock } from "../../traits.js";
import { makeBlockContentIterator } from "../../util.js";

export const tabular_type = "ext_tier1_tabular" as const;
const tabular_linebr_type = "ext_tier1_tabular_cellbr" as const;

export type TabularHalign = "left" | "right" | "center" | "justify";
const halign_finder: Record<string, TabularHalign> = { '<': "left",  '>': "right",  '><': "center",  '<>': "justify" };

export interface TabularColumnFormat {
    halign: TabularHalign;
}


export interface MarkdownTabularRow {
    LL: LogicalLine_text;
    cells: { content: InlineContent; }[];
}

export interface MarkdownTabular {
    tableHead: MarkdownTabularRow[];
    tableBody: MarkdownTabularRow[];
    format:    TabularColumnFormat[];
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



interface TabularCellbrMarker { type: typeof tabular_linebr_type; }

export const tabular_cellbr_traits: InlineElementTraits<typeof tabular_linebr_type, TabularCellbrMarker & InlineElementBase<typeof tabular_linebr_type>> = {
    startChars: [ '|' ],
    parse(It) {
        It.pop();
        return true;
    },
    creator(MDP) { return new InlineParser_Standard<typeof tabular_linebr_type>(MDP, this); },
    defaultElementInstance: { type: tabular_linebr_type }
};


function getTableCellParserProvider(MDP: MarkdownParser) {
    if(!MDP.customInlineParserProviders[tabular_type]) {
        const IPP = new InlineParserProvider(MDP);
        IPP.traits = { ... standardInlineParserTraits,
                       ext_tier1_tabular_cellbr: tabular_cellbr_traits };
        IPP.delims = { ... standardDelimiterTraits };
        IPP.makeStartCharMap();
        MDP.customInlineParserProviders[tabular_type] = IPP;
    }
    return MDP.customInlineParserProviders[tabular_type];
}

function inlineProcessTabularRow(IPP: InlineParserProvider, H: MarkdownTabularRow) {
    let It = makeBlockContentIterator(H.LL, true); // TODO!! There should not be a "next"
    It.pop(); // skip the first '|'
    const buf: InlineContent = [];
    const context = new InlineParsingContext(IPP);
    context.inlineParseLoop(It, buf);
    let i0 = 0;
    buf.forEach((elt, i) => {
        if(!(typeof elt !== "string" && elt.type === tabular_linebr_type))    return;
        H.cells.push({ content: buf.slice(i0, i) });
        i0 = i + 1;
    });
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
            this.B.tableHead.push({ LL,  cells: [] });
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
            (hadFormat ? this.B.tableBody : this.B.tableHead).push({ LL,  cells: [] });
        return 0;
    },

    finalizeBlockHook() {
        const B = this.B;
        const nCols = B.tableHead.reduce((max, F) => Math.max(max, F.LL.content.length), B.format.length);
        for(let i = B.format.length;  i < nCols;  ++i)
            B.format.push({ halign: "left" });
    },

    allowSoftContinuations: false,
    allowCommentLines: true,

    inlineProcessing(B) {
        if(!castExtensionBlock(B, markdown_tabular_traits))    return;
        const IPP = getTableCellParserProvider(this);
        B.tableHead.forEach(R => inlineProcessTabularRow(IPP, R));
        B.tableBody.forEach(R => inlineProcessTabularRow(IPP, R));
    },

    defaultBlockInstance: {
        tableHead: [],
        tableBody: [],
        format:    []
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

function printTableRow(renderer: Renderer, R: MarkdownTabularRow, Fs: TabularColumnFormat[] | null, I: Inserter, header: boolean) {
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

export function ext_tier1_tabular_render(this: Renderer, B: Block_Extension, I: Inserter) {
    if(!castExtensionBlock(B, markdown_tabular_traits))    return;
    I.add(`<table>`);
    //printTabularColFormats(B.format, I);
    if(B.tableHead.length > 0) {
        I.add('<thead>');
        for(const R of B.tableHead)
            printTableRow(this, R, null, I, true);
        I.add('</thead>');
    }
    if(B.tableBody.length > 0) {
        I.add('<tbody>');
        for(const R of B.tableBody)
            printTableRow(this, R, B.format, I, false);
        I.add('</tbody>');
    }
    I.add('</table>');
};
