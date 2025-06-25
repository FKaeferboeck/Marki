import { BlockType, MarkdownParser, Renderer } from "marki";
import { doSectionNumbering, extendTier1, extendTier2 } from "marki/extensions";
import { TooltipProvider, tooltipProviderInline, TooltipProviderInline, tooltipProviders } from "./provide-tooltip";
import { InlineElementType } from "marki/inline";

const MDR = new Renderer();

export interface MarkiInstance {
    MDP: MarkdownParser;
    pluginFiles: string[];
    tooltip: {
        blocks: Partial<{ [K in BlockType]: TooltipProvider<K>; }>;
        inline: Partial<{ [K in InlineElementType]: TooltipProviderInline<K>; }>;
    }
}

const markiInstance: MarkiInstance = {
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


extendTier1(markiInstance.MDP, MDR);
extendTier2(markiInstance.MDP, MDR);
//register_dataModelRef(MDP, MDR);
//register_taskLinkSection(MDP, MDR);


export function getMarkiInstance() { return markiInstance; }
export function getMarkiParser() { return markiInstance.MDP; }


export function MarkiParse(content: string) {
    const Bs = markiInstance.MDP.processDocument(content);
    doSectionNumbering(Bs);
    return Bs;
}

