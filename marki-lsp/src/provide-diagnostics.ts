import { AnyBlock, isDelimiter } from "marki";
import { blockIterator } from "marki/util";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";


export function provideInlineDiagnostics(Bs: AnyBlock[]) {
    const diags: Diagnostic[] = [];
    for(const B of blockIterator(Bs, "full")) {
        //console.log('B:', B.type, B.lineIdx, B.logical_line_extent, !!B.inlineContent)
        if(!B.inlineContent)
            continue;
        for(const elt of B.inlineContent) {
            //console.log("  Elt:", typeof elt === "string" ? `txt [${elt.slice(0, 40)}...]` : elt.type);
            if(typeof elt === "string" || isDelimiter(elt))
                continue;
            if (elt.type.startsWith("ext_")) {
                //console.log('Diacks', elt)
                diags.push({
                    range: {
                        start: { line: B.lineIdx + elt.startPos.line,  character: elt.startPos.character },
                        end:   { line: B.lineIdx + elt.endPos.line,    character: elt.endPos.character },
                    },
                    message: 'Diacks',
                    severity: DiagnosticSeverity.Warning
                });
            }
        }
    }
    return diags;
}
