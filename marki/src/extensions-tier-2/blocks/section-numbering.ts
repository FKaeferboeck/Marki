import { sectionHeader_trimEndMarker } from "../../blocks/sectionHeader.js";
import { lineContent, measureColOffset, standardBlockStart } from "../../linify.js";
import { BlockTraitsExtended, castExtensionBlock, ExtensionBlockTraits } from "../../traits.js";
import { makeBlockContentIterator, sliceLL_to } from "../../util.js";
import { MarkdownRendererInstance, Inserter } from "../../renderer/renderer.js";
import { AnyBlock, Block_Extension, Block_Leaf } from "../../markdown-types.js";
import { ParsingContext } from "src/block-parser.js";
import { tier2_command_block_start } from "../traits.js";


export interface SectionHeaderNumberingElement { label?: string;  num: number; };

export interface SectionHeader_ext {
	level:      number;
    anon:       boolean; // anonymous section (i.e. without label)
    anchor?:    string;
    label?:     string; // individual label overriding natural numbering
    numbering?: (SectionHeaderNumberingElement | { anon: number[]; })[];
}


interface TableOfContents_ctx {
    table_of_contents_title: string;
    section_headers: (Block_Leaf<"sectionHeader"> & SectionHeader_ext)[];
}

export function getTableOfContents_ctx(ctx: ParsingContext) {
    const t_o_c = (ctx.globalCtx as TableOfContents_ctx);
    t_o_c.table_of_contents_title ||= 'Table of Contents';
    t_o_c.section_headers ||= [];
    return t_o_c;
}

const markdown_major_section_type = "ext_tier2_major_section" as const;


export const sectionHeader_ext_traits: BlockTraitsExtended<"sectionHeader", SectionHeader_ext> = {
    blockType: "sectionHeader",

    startsHere(LL, B) {
        if(!standardBlockStart(LL))
            return -1;
        let rexres = /^(#{1,6})(\*?)((?:@[A-Za-z\d\-_]+|:(?!\{)[^\s@]+|:\{[^\}]+\})*)(?:\s+|$)/.exec(LL.content);
        if(!rexres)
            return -1;

        B.level = rexres[1].length;
        B.anon = !!rexres[2];
        const extras = rexres[3];
        const rex = /(?:@[A-Za-z\d\-_]+|:(?!\{)[^\s@]+|:\{[^\}]+\})/g;
        for(const m of extras.matchAll(rex)) {
            const extra = m[0];
            if(extra.startsWith('@'))
                B.anchor = extra.slice(1);
            else if(extra[1] === '{')
                B.label = extra.slice(2, -1);
            else
                B.label = extra.slice(1);
        }
        return measureColOffset(LL, rexres[0].length) + LL.indent;
    },

    continuesHere() { return "end"; }, // section headers are single-line

    postprocessContentLine(LL) {
        if(LL.type === "empty")
            return LL;
        const It = makeBlockContentIterator(LL);
        It.goToEnd();

        // Is there perhaps a closing ### ?
        const P = sectionHeader_trimEndMarker(It);
        
        return (P ? sliceLL_to(LL, P) : LL);
    },

    allowSoftContinuations: false,
    allowCommentLines: false,
    isInterrupter: true,

    defaultBlockInstance: {
        level: -1,
        anon: false
    }
};


const header_types: Record<string, true> = { sectionHeader: true };
header_types[markdown_major_section_type] = true;

export function doSectionNumbering(ctx: ParsingContext, Bs: AnyBlock[]) {
    const toc_ctx = getTableOfContents_ctx(ctx);
    const numberingStack: SectionHeaderNumberingElement[] = [];
    const anonStack: number[] = [];
    let anonLevel = 100, nMajorSections = 0;
    toc_ctx.section_headers = []; // reset

    for(const B_ of Bs) {
        if(!(B_.type in header_types))
            continue;
        const B = B_ as Block_Leaf<"sectionHeader"> & SectionHeader_ext;
        toc_ctx.section_headers.push(B);

        if(B.level === 0) { // major section
            B.label = String.fromCharCode(0x41 + nMajorSections++); // A, B, C, ...
            continue;
        }

        // Section is anonymous if it is explicitly anonymous or has an anonymous ancestor
        const isAnon = (() => {
            if(B.anon)
                anonLevel = Math.min(anonLevel, B.level);
            else if(B.level <= anonLevel)
                anonLevel = 100;
            return (B.anon || B.level >= anonLevel);
        })();

        while(anonStack.length > B.level)
            anonStack.pop();
        if(isAnon) {
            while(anonStack.length < B.level)
                anonStack.push(0);
            ++anonStack[anonStack.length - 1];
        }

        while(numberingStack.length > B.level)
            numberingStack.pop();
        while(numberingStack.length < B.level)
            numberingStack.push({ num: 0 });

        const I = numberingStack[numberingStack.length - 1];
        if(isAnon) {
            B.numbering = numberingStack.slice(0, anonLevel - 1).map(I => ({ ... I }));
            B.numbering.push({ anon: anonStack.slice(anonLevel - 1) });
            continue;
        }

        if(B.label)
            I.label = B.label;
        else {
            ++I.num;
            I.label = undefined;
        }
        B.numbering = numberingStack.map(I => ({ ... I }));
    }
}


/******************************************************************************************************************************************/

export const major_section_ext_traits: ExtensionBlockTraits<SectionHeader_ext> = {
    blockType: markdown_major_section_type,

    startsHere(LL, B) {
        if(!tier2_command_block_start(this.MDP, LL))
            return -1;
        const rexres = /^.section\s*/i.exec(LL.content);
        if(!rexres)
            return -1;
        B.level = 0;
        return measureColOffset(LL, rexres[0].length) + LL.indent;
    },

    continuesHere: () => "end",

    allowSoftContinuations: false,
    allowCommentLines: false,
    isInterrupter: true,

    defaultBlockInstance: {
        level: -1,
        anon: false
    }
};


/******************************************************************************************************************************************/

const markdown_table_of_contents_type = "ext_tier2_table_of_contents" as const;

interface TableOfContentsParams {
    levels: number;
}

export const markdown_table_of_contents_traits: ExtensionBlockTraits<TableOfContentsParams> = {
    blockType: markdown_table_of_contents_type,

    startsHere(LL, B) {
        if(!tier2_command_block_start(this.MDP, LL))
            return -1;
        const rexres = /^.tableofcontents(\s*\(\s*\d+\s*\)|\s*\[\s*\d+\s*\]|\s*\{\s*\d+\s*\}|\s+\d+)?\s*/i.exec(LL.content);
        if(!rexres)
            return -1;
        if(rexres[1]) {
            let level = rexres[1].trim();
            if(level[0] in { '(': true,  '[': true,  '{': true })
                level = level.slice(1, -1);
            B.levels = +level;
        }
        return measureColOffset(LL, rexres[0].length) + LL.indent;
    },

    continuesHere: () => "end",

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { levels: 3 }
};



/*********************************************************** Rendering stuff **************************************************************/

interface SectionHeader_handle {
    label:  string | undefined;
    anchor: string;
}

const isAnon = (B: SectionHeader_ext) => (B.numbering?.length && "anon" in B.numbering[B.numbering.length - 1]);


export function makeSectionHeader_handle(B: SectionHeader_ext) : SectionHeader_handle {
    if(B.level == 0)
        return {
            label: B.label,
            anchor: `major-sec-${B.label}`
        };
    
    const X: SectionHeader_handle = {
        label:  undefined,
        anchor: (B.anchor ? 'sec-' + B.anchor : '')
    };
    if(!B.numbering?.length) // should be impossible
        return X;

    const label = B.numbering.map(I => ("anon" in I ? 'anon-' + I.anon.join('.') : I.label || I.num)).join('.');
    if(!isAnon(B))
        X.label = label;
    if(!X.anchor)
        X.anchor = 'sec-' + label;
    return X;
}


export function sectionHeader_ext_render(this: MarkdownRendererInstance, B_: Block_Leaf<"sectionHeader"> | Block_Extension, I: Inserter) {
    const B = B_ as Block_Leaf<"sectionHeader"> & SectionHeader_ext;
    if(typeof B.anon !== "boolean")
        throw new Error('Wrong rendering function for section header block extension');
    
    const H = makeSectionHeader_handle(B);
    const buf = [ B.level === 0 ? `<h1 id="${H.anchor}" class="major-section-header">` : `<h${B.level} id="${H.anchor}">` ];
    if(H.label)
        buf.push(`<span class="sec-tag">${H.label}</span>`);
    buf.push(this.renderBlockContent(B_, null));
    buf.push(`</h${Math.max(B.level, 1)}>`)
    I.add(buf.join(''));
};


export function ext_tier2_table_of_contents_render(this: MarkdownRendererInstance, B: Block_Extension, I: Inserter) {
    if(!castExtensionBlock(B, markdown_table_of_contents_traits))    return;
    const ctx = getTableOfContents_ctx(this.ctx);
    I.add('<fieldset class="table-of-content">');
    I.add(`<legend>${B.inlineContent?.length ? this.renderBlockContent(B, null, "trimmed") : ctx.table_of_contents_title}</legend>`);
    for(const B1 of ctx.section_headers) {
        const H = makeSectionHeader_handle(B1);
        I.add(`<div class="level-${B1.level}"><div>${H.label || ''}</div><div><a href="#${H.anchor}">${this.renderBlockContent(B1, null)}</a></div></div>`);
    }
    I.add('</fieldset>');
};
