import { sectionHeader_trimEndMarker } from "../../blocks/sectionHeader.js";
import { measureColOffset, standardBlockStart } from "../../linify.js";
import { BlockTraitsExtended } from "../../traits.js";
import { makeBlockContentIterator, sliceLL_to } from "../../util.js";
import { MarkdownRendererInstance, Inserter } from "../../renderer/renderer.js";
import { AnyBlock, Block_Leaf } from "../../markdown-types.js";


interface NumberingElement { label?: string;  num: number; };

export interface SectionHeader_ext {
	level:      number;
    anon:       boolean; // anonymous section (i.e. without label)
    anchor?:    string;
    label?:     string; // individual label overriding natural numbering
    numbering?: (NumberingElement | { anon: number[]; })[];
}


function anchorify(label: string) {

    return label;
}


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



export function doSectionNumbering(Bs: AnyBlock[]) {
    const numberingStack: NumberingElement[] = [];
    const anonStack: number[] = [];
    let anonLevel = 100;

    for(const B_ of Bs) {
        if(B_.type !== "sectionHeader")
            continue;
        const B = B_ as Block_Leaf<"sectionHeader"> & SectionHeader_ext;

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


/* Rendering stuff */

interface SectionHeader_handle {
    label:  string | undefined;
    anchor: string;
}

const isAnon = (B: SectionHeader_ext) => (B.numbering?.length && "anon" in B.numbering[B.numbering.length - 1]);


export function makeSectionHeader_handle(B: SectionHeader_ext) {
    //console.log(B);
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


export function sectionHeader_ext_render(this: MarkdownRendererInstance, B_: Block_Leaf<"sectionHeader">, I: Inserter) {
    const B = B_ as Block_Leaf<"sectionHeader"> & SectionHeader_ext;
    if(typeof B.anon !== "boolean")
        throw new Error('Wrong rendering function for section header block extension');
    
    const H = makeSectionHeader_handle(B);
    const buf = [ `<h${B.level} id="${H.anchor}">` ];
    if(H.label)
        buf.push(`<span class="sec-tag">${H.label}</span>`);
    buf.push(this.renderBlockContent(B_, null));
    buf.push(`</h${B.level}>`)
    I.add(buf.join(''));
};
