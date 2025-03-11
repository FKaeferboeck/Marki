import { LogicalLineData } from "./markdown-types";
import { LineStructure, LogicalLineType } from "./parser";



function measureIndent(s: string, i0: number = 0) {
    let n = 0;
    for (let i = i0, iN = s.length;  i < iN;  i++)
        switch(s[i]) {
        case ' ':     ++n;       break;
        case '\t':    n += 4;    break;
        default:      return n;
        }
    return n;
}



export function sliceLLD(LLD: LogicalLineData, begin: number): LogicalLineData {
    /*if(begin < 0 || LLD.startPart.length < begin)
        throw new Error('Cannot slice LLD');*/
    const p0 = LLD.startPart.slice(begin);
    const parts = [ ... LLD.parts ];
    if(p0.length > 0)
        parts[0].content = p0;
    else
        parts.splice(0, 1);

    return {
        logl_idx:    LLD.logl_idx,
        parts:       parts,
        startPart:   p0.trimStart(),
        startIndent: measureIndent(p0),
        type:        (LLD.type === "text" ? "single" : LLD.type),
        next:        null
    };
}



function lineData(LS: LineStructure, logl_idx: number): LogicalLineData {
    const LL = LS.logical_lines[logl_idx];
    const P  = LS.all[LL.start];
    const p0 = (P.type === "TextPart" ? P.content : '');
    return {
        logl_idx:    logl_idx,
        parts:       LS.all.slice(LL.start, LL.start + LL.extent),
        startPart:   p0.trimStart(),
        startIndent: measureIndent(p0),
        type:        (LL.type === "text" ? "single" : LL.type),
        next:        null
    };
}

export function lineDataAll(LS: LineStructure, logl_idx_start: number): LogicalLineData {
    let lld = lineData(LS, logl_idx_start);
    const lld0 = lld;
    while(++logl_idx_start < LS.logical_lines.length)
        lld = (lld.next = lineData(LS, logl_idx_start));
    return lld0;
}



const standardBlockLineTypes: Partial<Record<LogicalLineType | "single", boolean>> = { single: true,  text: true };
export const standardBlockStart = (LLD: LogicalLineData) => (!!standardBlockLineTypes[LLD.type] && LLD.startIndent < 4);
