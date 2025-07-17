import { BlockType, global_MDPT, MarkdownParser, MarkdownParserTraits, MarkdownRendererTraits, markdownRendererTraits_standard } from "marki";
import { doSectionNumbering, extendTier1, extendTier2 } from "marki/extensions";
import { TooltipProvider, tooltipProviderInline, TooltipProviderInline, tooltipProviders } from "./provide-tooltip";
import { InlineElementType } from "marki/inline";


export interface MarkiInstance {
    MDPT: MarkdownParserTraits;
    MDRT: MarkdownRendererTraits;
    MDP: MarkdownParser;
    pluginFiles: string[];
    tooltip: {
        blocks: Partial<{ [K in BlockType]: TooltipProvider<K>; }>;
        inline: Partial<{ [K in InlineElementType]: TooltipProviderInline<K>; }>;
    }
}

const markiInstance: MarkiInstance = {
    MDPT: global_MDPT,
    MDRT: markdownRendererTraits_standard,
    MDP: new MarkdownParser(),
    pluginFiles: [],
    tooltip: {
        blocks: tooltipProviders,
        inline: tooltipProviderInline
    }
};


export interface Marki_LSP_plugin {
    registerMarkiExtension?   (MDP: MarkdownParser): void;
    registerTooltipProviders? (tt: MarkiInstance["tooltip"]): void;
}


extendTier1(markiInstance.MDPT, markiInstance.MDRT);
extendTier2(markiInstance.MDPT, markiInstance.MDRT);
//register_dataModelRef(MDP, MDR);
//register_taskLinkSection(MDP, MDR);


export function getMarkiInstance() { return markiInstance; }
export function getMarkiParser() { return markiInstance.MDP; }


export function MarkiParse(content: string) {
    return markiInstance.MDP.processDocument(content)
    .then(Bs => {
        doSectionNumbering(Bs);
        return Bs;
    });
}
