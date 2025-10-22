import { AnyBlock, Block, Block_Leaf, BlockType, ParsingContext } from "marki";
import { makeSectionHeader_handle, SectionHeader_ext } from "marki/extensions";
import { InlineElement, InlineElementType } from "marki/inline";
import { Pos, PositionOps } from "marki/util";


export type TooltipProvider<T extends BlockType> = (B: Block<T>, P: Pos, ctx: ParsingContext) => null | string | Promise<string>;
export type TooltipProviderInline<T extends InlineElementType> = (elt: InlineElement<T>, ctx: ParsingContext) => null | string | Promise<string>;


export const tooltipProviderInline: Partial<{ [K in InlineElementType]: TooltipProviderInline<K>; }> = {
    htmlEntity: elt => {
        return `HTML Entität ${elt.code} = ${elt.codePoint}`;
    }
};


export const tooltipProviders: Partial<{ [K in BlockType]: TooltipProvider<K>; }> = {
    sectionHeader: B_ => {
        const B = B_ as Block_Leaf<"sectionHeader"> & SectionHeader_ext;
        const H = makeSectionHeader_handle(B);
        const buf = [];
        if(H.label)
            buf.push(`Section **${H.label}**`);
        else
            buf.push(`Anonymous section (level ${B.level})`);
        buf.push(`Link anchor "\`${H.anchor}\`"`)
        return buf.join('\\\n');
    },
    paragraph: (B, P, ctx) => {
        if(!B.inlineContent)
            return null;
        const i = PositionOps.locateInline(B.inlineContent, P);
        if(i === undefined)
            return null;
        const elt = B.inlineContent[i];
        if(typeof elt === "string")
            return null;
        const fct = tooltipProviderInline[elt.type as any];
        if(!fct) // this inline element type isn't being handled
            return null;
        return fct(elt as any, ctx);
    },
    listItem: (B, P, ctx) => {
        if(!B.inlineContent)
            return null;
        const i = PositionOps.locateInline(B.inlineContent, P);
        if(i === undefined)
            return null;
        const elt = B.inlineContent[i];
        if(typeof elt === "string")
            return null;
        const fct = tooltipProviderInline[elt.type as any];
        if(!fct) // this inline element type isn't being handled
            return null;
        return fct(elt as any, ctx);
    }
}



export function provideTooltip(B: AnyBlock, P: Pos, blockIdx: number) {
    const fct = tooltipProviders[B.type];
    const tt = fct ? (fct as any)(B, P) as null | string | Promise<string> : null;
    if(tt)
        return tt;

    return `Block ${blockIdx + 1} "${B.type}"`;
}
