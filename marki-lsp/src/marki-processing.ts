import { BlockType, global_MDPT, MarkdownParser, MarkdownParserTraits, MarkdownRendererTraits, markdownRendererTraits_standard, MarkiDocument, ParsingContext } from "marki";
import { doSectionNumbering, extendTier1, extendTier2 } from "marki/extensions";
import { TooltipProvider, tooltipProviderInline, TooltipProviderInline, tooltipProviders } from "./provide-tooltip";
import { InlineElement, InlineElementTraits, InlineElementType } from "marki/inline";
import { inlineDiagnosticProviders, InlineDiagnosticsProvider } from "./provide-diagnostics";


export interface MarkiInstance {
    MDPT: MarkdownParserTraits;
    MDRT: MarkdownRendererTraits;
    MDP: MarkdownParser;
    pluginFiles: string[];
    tooltip: {
        blocks: Partial<{ [K in BlockType]: TooltipProvider<K>; }>;
        inline: Partial<{ [K in InlineElementType]: TooltipProviderInline<K>; }>;
        addInline: <T extends InlineElementType, Elt extends InlineElement<T>>(traits: InlineElementTraits<T, Elt>, fct: InlineDiagnosticsProvider<T, Elt>) => void;
    };
    diagnostics: {
        inline: Partial<{ [K in InlineElementType]: InlineDiagnosticsProvider<K, any>; }>;
        add: <T extends InlineElementType, Elt extends InlineElement<T>>(traits: InlineElementTraits<T, Elt>, fct: InlineDiagnosticsProvider<T, Elt>) => void;
    };
}


const markiInstance: MarkiInstance = {
    MDPT: global_MDPT,
    MDRT: markdownRendererTraits_standard,
    MDP: new MarkdownParser(),
    pluginFiles: [],
    tooltip: {
        blocks: tooltipProviders,
        inline: tooltipProviderInline,
        addInline: function <T extends InlineElementType, Elt extends InlineElement<T>>(traits: InlineElementTraits<T, Elt>, fct: InlineDiagnosticsProvider<T, Elt>): void {
            throw new Error("Function not implemented.");
        }
    },
    diagnostics: {
        inline: inlineDiagnosticProviders,
        add: <T extends InlineElementType, Elt extends InlineElement<T>>(traits: InlineElementTraits<T, Elt>, fct: InlineDiagnosticsProvider<T, Elt>) => {
            markiInstance.diagnostics.inline[traits.defaultElementInstance.type] = fct;
        }
    }
};


/*export interface Marki_LSP_context {
    baseDir: string; // the base directory of the extension; e.g. for locating resource files
}*/

export interface Marki_LSP_plugin {
    context: Record<string, any>;
    registerMarkiExtension?      (this: Marki_LSP_plugin, MDPt:  MarkdownParserTraits): void;
    registerTooltipProviders?    (this: Marki_LSP_plugin, tt:    MarkiInstance["tooltip"]): void;
    registerDiagnosticsProviders?(this: Marki_LSP_plugin, diags: MarkiInstance["diagnostics"]): void;
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
