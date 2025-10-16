import { AnyBlock } from "marki";


const endLine = (B: AnyBlock) => (B.lineIdx + B.logical_line_extent);

// find which block the given line lies in, using binary search
/*export function findBlock(Bs: AnyBlock[], lineIdx: number): AnyBlock | null {
    let i0 = 0, i1 = Bs.length;
    if(i0 === i1 || lineIdx < 0 || lineIdx >= endLine(Bs[i1 - 1]))
        return null;
    while(i1 - i0 > 1) {
        const i = Math.floor((i0 + i1) / 2);
        if(lineIdx < Bs[i].lineIdx)
            i1 = i;
        else
            i0 = i;
    }
    return (lineIdx < endLine(Bs[i0]) ? Bs[i0] : null);
}*/


export function blockDistributionInfo(Bs: AnyBlock[]) {
    return Bs.map(B => ({ i0: B.lineIdx,  n: B.logical_line_extent,  type: B.type }))
        .filter(B => B.type !== "emptySpace");
}