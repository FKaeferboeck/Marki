import { BlockType, global_MDPT, MarkdownParser, MarkdownParserTraits, MarkdownRendererTraits, markdownRendererTraits_standard, MarkiDocument } from "marki";
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


/*export interface Marki_LSP_context {
    baseDir: string; // the base directory of the extension; e.g. for locating resource files
}*/

export interface Marki_LSP_plugin {
    context: Record<string, any>;
    registerMarkiExtension?   (this: Marki_LSP_plugin, MDPt: MarkdownParserTraits): void;
    registerTooltipProviders? (this: Marki_LSP_plugin, tt: MarkiInstance["tooltip"]): void;
}


extendTier1(markiInstance.MDPT, markiInstance.MDRT);
extendTier2(markiInstance.MDPT, markiInstance.MDRT);
//register_dataModelRef(MDP, MDR);
//register_taskLinkSection(MDP, MDR);


export function getMarkiInstance() { return markiInstance; }
export function getMarkiParser() { return markiInstance.MDP; }


export function MarkiParse(content: string) {
    const doc: MarkiDocument = {
        URL: '',  title: '',
        input: content,
        LLs: [],
        blocks: [],
        localCtx: { }
    }
    return markiInstance.MDP.processDocument(doc)
    .then(Bs => {
        doSectionNumbering(markiInstance.MDP, Bs.blocks);
        return Bs;
    });
}
