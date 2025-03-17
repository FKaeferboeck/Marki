import { LogicalLineData } from "./markdown-types.js";
import { LinePart, LineStructure, LogicalLineType } from "./parser.js";



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


export function lineTypeLP(L: LinePart[]): LogicalLineType {
    if(L.length === 0)    return "empty";
    if(L.length === 1) {
        const P = L[0];
        if(P.type === "XML_Comment")    return "comment";
        if(P.content.length === 0)    return "empty";
        if(P.content.trimEnd().length === 0)    return "emptyish";
        return "single";
    }
    // now there are multiple parts, which means that at least some of them are comments -> can only be all comment or mixed content
    return (L.some(P => P.type !== "XML_Comment" && P.content.trimEnd().length !== 0) ? "text" : "comment");
}



export function sliceLLD(LLD: LogicalLineData, begin: number): LogicalLineData {
    const p0 = (' '.repeat(LLD.startIndent) + LLD.startPart).slice(begin);
    const parts = [ ... LLD.parts ];
    if(p0.length > 0)
        parts[0].content = p0;
    else
        parts.splice(0, 1);

    const LLD_c: LogicalLineData = {
        logl_idx:    LLD.logl_idx,
        parts:       parts,
        startPart:   p0.trimStart(),
        startIndent: measureIndent(p0),
        type:        lineTypeLP(parts),
        next:        null
    };
    LLD.contentSlice = LLD_c;
    if(LLD.isSoftContainerContinuation)
        LLD_c.isSoftContainerContinuation = true;
    return LLD_c;
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


export function LLDinfo(LLD: LogicalLineData | null | undefined) {
    if(!LLD)
        return '[EOF]';
    return `[${LLD.logl_idx}:${LLD.startIndent ? `(${LLD.startIndent})+` : ''}${LLD.startPart}${LLD.isSoftContainerContinuation ? '\\SCC' : ''}]`;
}
