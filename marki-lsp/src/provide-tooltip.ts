import { AnyBlock, Block, Block_Leaf, BlockType } from "marki";
import { makeSectionHeader_handle, SectionHeader_ext } from "marki/extensions";
import { InlineElement, InlineElementType } from "marki/inline";
import { Pos, PositionOps } from "marki/util";


export type TooltipProvider<T extends BlockType> = (B: Block<T>, P: Pos) => null | string | Promise<string>;
export type TooltipProviderInline<T extends InlineElementType> = (elt: InlineElement<T>) => null | string | Promise<string>;


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
    paragraph: (B, P) => {
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
        return fct(elt as any);
    }
}



export function provideTooltip(B: AnyBlock, P: Pos) {
    const fct = tooltipProviders[B.type];
    if(!fct)
        return null;
    return (fct as any)(B, P) as null | string | Promise<string>;
}
