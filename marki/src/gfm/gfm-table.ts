import { BlockTraits_, BlockTraits, castExtensionBlock } from "../traits.js";
import { isSpaceLine, lineContent, LogicalLine, LogicalLine_text, LogicalLine_with_cmt, Slice, sliceLine, sliceLine_fromTo, standardBlockStart } from "../linify.js";
import { AnyBlock, Block_Extension, ExtensionBlockType, InlineContent } from "../markdown-types.js";
import { MarkdownParserTraits } from "../markdown-parser.js";
import { Inserter, MarkdownRendererInstance, MarkdownRendererTraits } from "../renderer/renderer.js";
import { addParagraphStopper, endRejectingLines, ParagraphStopper } from "../blocks/paragraph.js";
import { BlockParser, ParsingContext } from "src/block-parser.js";
import { InlineParserProvider, InlineParsingContext } from "src/inline-parsing-context.js";
import { makeBlockContentIterator } from "src/util.js";
import { pairUpDelimiters } from "src/delimiter-processing.js";
import { quickRow } from "src/renderer/util.js";

export type TabularHalign = null | "left" | "right" | "center" | "justify";
const halign_finder: Record<string, TabularHalign> = { '<': "left",  '>': "right",  '><': "center",  '<>': "justify" };

export interface TabularColumnFormat {
    halign: TabularHalign;
    hsep?: boolean; // vertical line at the right edge of the column
}

export interface TableCell extends MarkdownTabularCellStyle // bottom border
{
    LL: Slice<LogicalLine>;
    inlineContent: InlineContent;
}

export interface MarkdownTabularRow {
    LL: LogicalLine_text;
    
    cells: TableCell[];
    borderBottom?: MarkdownTabularBorderStyle[];
}

export type MarkdownTabularBorderStyle = 0 | 1 | 2; // none/single/double
export interface MarkdownTabularCellStyle {
    borderBottom?: MarkdownTabularBorderStyle[];
}

export interface MarkdownTabularSection {
    LLs:  (LogicalLine_text & MarkdownTabularCellStyle)[];
    rows: MarkdownTabularRow[];
}

export interface MarkdownTabular {
    head:     MarkdownTabularSection;
    body:     MarkdownTabularSection;
    format:   TabularColumnFormat[];
    nColumns: number;
}

type TableParsingStage = "header"| "delimiter" | "body";


interface GFM_TableTraits_Extra {
    allowHeaderless:       boolean;
    allowMultilineHeaders: boolean;
    arrowAlignmentMarker:  boolean;
    allowRowContinuations: boolean; // can a table row be split over multiple source lines by using "|\" at the end?
}

type GFM_TableTraits = BlockTraits<ExtensionBlockType, MarkdownTabular, GFM_TableTraits_Extra>;


const rex_delimRow_GFM   = /^\s*\|?\s*(:?-+:?\s*(?:\|?\s*:?-+:?\s*)*)\|?\s*$/;
const rex_delimRow_arrow = /^\s*\|?\s*(:?-+:?\s*(?:\|?\s*:?-+:?\s*)*|-*(?:<>?|><?)-*)\|?\s*$/; // TODO!! Fix

function isDelimiterRow(this: GFM_TableTraits, LL: LogicalLine): false | TabularColumnFormat[] {
    if (!standardBlockStart(LL))
        return false;
    if (/^\s*-+\s*$/.test(LL.content)) // valid syntax, but interpretation as a SETEXT header takes precedence
        return false;
    let rexres = (this.arrowAlignmentMarker ? rex_delimRow_arrow : rex_delimRow_GFM).exec(LL.content);
    if (!rexres)
        return false;

    return rexres[1].split('|').map(s => {
        s = s.trim();
        const H: TabularColumnFormat = { halign: (s.startsWith(':') ? s.endsWith(':') ? "center" : "left"
                                                                    : s.endsWith(':') ? "right"  : null) };
        if(!H.halign && this.arrowAlignmentMarker) { // null => might be arrow halign syntax
            rexres = /[<>]+/.exec(s);
            H.halign = halign_finder[rexres?.[0] || ''] || null;
        }
        return H;
    });
}


function appendLL(LL: Slice<LogicalLine>, LL1: Slice<LogicalLine>) {
    let LL0: LogicalLine_with_cmt = LL;
    while(LL0.next)
        LL0 = LL0.next;
    LL0.next = LL1;
}

function splitRow(LL: LogicalLine, row_out: TableCell[]) {
    if (!standardBlockStart(LL))
        return 0;
    const rex = /\s*(\\*\|)\s*/g,  s = LL.content;
    let rexres: RegExpMatchArray | null = null;
    let startPos = 0,  nCells = 0;

    const appendCell = (LL: Slice<LogicalLine>) => {
        const cell0 = row_out[nCells];
        if(!cell0)
            row_out.push({ LL,  inlineContent: [] });
        else {
            appendLL(cell0.LL, LL); // TODO!! Harmonize borders etc.
        }
        // TODO!! Do something with separator rexres[0]
        ++nCells;
    };

    while(rexres = rex.exec(s)) {
        if((rexres[1].length % 2) === 0) // even length == odd number of backslashes == escaped pipe
            continue;
        const LL1 = sliceLine_fromTo(LL, startPos, rexres.index! - startPos); // TODO!! end pos rexres.index
        startPos = rex.lastIndex;
        if(nCells == 0 && isSpaceLine(LL1)) // to the left of an initial | there is no cell, but maybe space
            continue;
        appendCell(LL1);
    }
    if(startPos < s.length) { // there's something left after the last delimiter
        const LL1 = sliceLine(LL, startPos);
        if(!isSpaceLine(LL1)) // ... and it's not just space
            appendCell(LL1);
    }
    return nCells;
}


type GFM_TableParser = BlockParser<`ext_${string}_${string}`, BlockTraits_<`ext_${string}_${string}`, MarkdownTabular, {}>>;
const getTableParsingStage = (P: GFM_TableParser) => (P as GFM_TableParser & { tableParsingStage: TableParsingStage; }).tableParsingStage || "header";
const setTableParsingStage = (P: GFM_TableParser, stage: TableParsingStage) => { (P as GFM_TableParser & { tableParsingStage: TableParsingStage; }).tableParsingStage = stage; }

function inlineProcessTabularSection(ctx: ParsingContext, IPP: InlineParserProvider, S: MarkdownTabularSection) {
    for(const R of S.rows) {
        for(const C of R.cells) {
            const context = new InlineParsingContext(IPP, ctx);
            context.inlineParseLoop(makeBlockContentIterator(C.LL), C.inlineContent);
            pairUpDelimiters(C.inlineContent);
        }
    }
}


export const gfm_table_traits: GFM_TableTraits = {
    blockType: "ext_gfm_table",

    startsHere(LL) {
        if(LL.type != "text")
            return -1;
        this.B.head.LLs.push({ ... LL });
        setTableParsingStage(this, "header");
        return LL.indent; // because this will only be called when all other possibilities have been excluded
    },
    continuesHere(LL) {
        if(LL.type !== "text")
            return "end";

        /* The following property is only set when that line was previously recognized as a soft container continuation, and the paragraph it was in was then rejected.
         * Since in that scenario we might have accepted a setext end line as a paragraph continuation, when we reparse it as a setext header we want it to remain as such,
         * so that the setext header doesn't end earlier than we expect it to.
         * Example:
         *      > paragraph content start
         *      =========================        <- would be setext end line but is accepted as paragraph continuation instead because it softly continues a block quote
         *      > -----------------------        <- here the paragraph gets rejected and reparsed as setext header => that's where that setext header should end and not in the previous line
         */
        if(LL.isSoftContainerContinuation)
            return "soft";

        if(this.B.format.length > 0) { // after delimiter row -> is content row
            // TODO!!
            setTableParsingStage(this, "body");
            return "soft";
        }

        const format = isDelimiterRow.call(this.traits, LL);
        if(!format || format.length !== this.B.nColumns)
            /* This is an impossible case since we only try to parse a GFM table if those lines were rejectes as paragraph content,
             * which operation already checked the column counts.
             */
            return "reject";

        setTableParsingStage(this, "delimiter");
        this.B.format = format;
        return LL.indent;
    },

    postprocessContentLine(LL, bct) {
        const stage = getTableParsingStage(this);
        console.log(`Postprocess (${stage}) "${lineContent(LL)}".`)
        if(stage === "delimiter" || LL.type !== "text")
            return LL;
        const section = (stage === "header" ? this.B.head : this.B.body);

        const cells: TableCell[] = [];
        const nCols = splitRow(LL, cells);
        if(stage === "header") {
            if(this.B.nColumns === 0)
                this.B.nColumns = nCols;
            else if(this.B.nColumns !== nCols)
                throw new Error("rgergregergerhrtyh")
        }
        section.rows.push({ LL,  cells });

        //console.log(`Table line (${stage}) "${lineContent(LL)}"`, arr);
        //return trimEndSpace(LL) as LogicalLine;
        return LL;
    },

    inlineProcessing(B) {
        if(!castExtensionBlock(B, gfm_table_traits))
            return;


        /*const IPP = this.MDP.MDPT.customInlineParserProviders[tabular_type];
        if(!IPP)    return;*/
        const IPP = this.MDP.MDPT.inlineParser_standard

        inlineProcessTabularSection(this, IPP, B.head);
        inlineProcessTabularSection(this, IPP, B.body);
    },

    allowSoftContinuations: false,
    canBeSoftContinuation: false,
    allowCommentLines: false,
    allowRowContinuations: false,

    allowHeaderless: false,
    allowMultilineHeaders: false,
    arrowAlignmentMarker: false,
    
    defaultBlockInstance: {
        head: { LLs: [],  rows: [] },
        body: { LLs: [],  rows: [] },
        format: [],
        nColumns: 0
    }
}


function gfm_table_render(this: MarkdownRendererInstance, B: Block_Extension, I: Inserter) {
    if(!castExtensionBlock(B, gfm_table_traits))
        return;
    I.add('<table>').add('<thead>');
    for(const R of B.head.rows) {
        I.add('<tr>');
        for(const C of R.cells) {
            quickRow(this, I, `<th>`, C as TableCell & AnyBlock, undefined, `</th>`);
        }
        I.add('</tr>');
    }
    I.add('</thead>');

    I.add('<tbody>'); // No line break befor <tr> !!
    for(const R of B.body.rows) {
        I.add('<tr>');
        for(const C of R.cells) {
            quickRow(this, I, `<td>`, C as TableCell & AnyBlock, undefined, `</td>`);
        }
        I.add('</tr>');
    }
    I.add('</tbody>\n</table>');
}


const spreadContent = (LL: LogicalLine | undefined) => {
    if(!LL)
        return undefined;
    let LL1: LogicalLine_with_cmt | undefined = LL;
    const LLs: LogicalLine_with_cmt[] = [];
    do LLs.push(LL1);
    while(LL1 = LL1.next);
    return LLs;
}


const gfmTable_ParagraphStopper: ParagraphStopper = function(LL, isFirst) {
    const tableTraits = this.MDP.MDPT.getBlockTraits(gfm_table_traits.blockType) as GFM_TableTraits;
    const format = isDelimiterRow.call(tableTraits, LL);
    const content = spreadContent(this.B.content);
    if(!format || !content)
        return undefined;

    if(isFirst)
        return (tableTraits.allowHeaderless ? "reject" : undefined);

    let nHeaderLines = 0;
    for(let i = 0;  tableTraits.allowMultilineHeaders || i < 1;  ++i) {
        const LL = content.pop();
        if(!LL)
            break;
        const row: TableCell[] = [];
        const nHeader = splitRow(LL as LogicalLine, row);
        console.log(`Header has ${nHeader}, expecting ${format.length}.`);
        if(nHeader !== format.length) // column count mismatch between header and delimiter row
            break;
        ++nHeaderLines;
    }
    if(nHeaderLines === 0)
        return (tableTraits.allowHeaderless ? "last" : undefined);
    return endRejectingLines(this, 1); // this line will become the table header
}


export function register_gfm_table(MDPT: MarkdownParserTraits, MDRT?: MarkdownRendererTraits) {
    //MDPT.inlineParser_standard.traits[name_gfm_autolink] = gfm_autolink_traits;
    MDPT.addExtensionBlocks(gfm_table_traits, "before", "sectionHeader_setext");
    if(MDRT)
        MDRT.blockHandler[gfm_table_traits.blockType] = gfm_table_render;
    addParagraphStopper(MDPT, gfmTable_ParagraphStopper);
}
