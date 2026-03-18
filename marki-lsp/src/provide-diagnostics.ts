import { AnyBlock, isDelimiter, ParsingContext } from "marki";
import { InlineContentElement, InlineElement, InlineElementType } from "marki/inline";
import { blockIterator } from "marki/util";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";


export interface InlineDiagnostic {
    message:  string;
    severity: DiagnosticSeverity;
};

export type InlineDiagnosticsProvider<T extends InlineElementType, Elt extends InlineElement<T>> = (elt: Elt, ctx: ParsingContext) => null | InlineDiagnostic;

export const inlineDiagnosticProviders: Partial<{ [K in InlineElementType]: InlineDiagnosticsProvider<K, any>; }> = { };


export function provideInlineDiagnostics(Bs: AnyBlock[], ctx: ParsingContext) {
    const diags: Diagnostic[] = [];
    for(const B of blockIterator(Bs, "full")) {
        if(!B.inlineContent)
            continue;
        for(const elt of B.inlineContent) {
            if(typeof elt === "string" || isDelimiter(elt))
                continue;
            const diag = inlineDiagnosticProviders[elt.type]?.(elt as any, ctx);
            if (diag)
                diags.push({
                    range: {
                        start: { line: B.lineIdx + elt.startPos.line,  character: elt.startPos.character },
                        end:   { line: B.lineIdx + elt.endPos.line,    character: elt.endPos.character },
                    },
                    ... diag
                });
        }
    }
    return diags;
}


export { DiagnosticSeverity } from "vscode-languageserver";