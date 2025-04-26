import { LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { BlockContentIterator, isLineStart, makeBlockContentIterator, measureIndent, sliceLLD_to } from "../util.js";


export interface SectionHeader {
	level: number;
	//customTag?: string;
}


function trimEndMarker(It: BlockContentIterator) {
    const P = It.newCheckpoint(); // just to make a position instance
    let n = 0, c: string | false = false;

    //trailing space will be trimmed in every case
    while((c = It.peekBack(n + 1)) === ' ' || c === '\t')    ++n;

    if(It.peekBack(n + 1) !== '#') {
        if(n === 0)
            return false;
        It.getPosition(P, -n);
        return P;
    }
    const n0 = n;
        
    while(It.peekBack(n + 1) === '#')    ++n;
    It.getPosition(P, -n);
    if(isLineStart(P)) // -> closing ### with no text before it (rare special case)
        return P;

    // a closing ### must be preceded by space (in the special case above that space was already trimmed from the left as part of the opening ###)
    const n1 = n;
    while((c = It.peekBack(n + 1)) === ' ' || c === '\t')    ++n;
    if(n === n1) { // closing ### not preceded by space -> it isn't a closing ### -> include it in content
        if(n0 === 0)
            return false;
        It.getPosition(P, -n0);
        return P;
    }
    It.getPosition(P, -n);
    return P;
}


export const sectionHeader_traits: BlockTraits<"sectionHeader"> = {
    startsHere(LLD: LogicalLineData, B) {
        if(!(LLD.type === "single" || LLD.type === "text") || LLD.startIndent >= 4)
            return -1;
        const rexres = /^(#{1,6})(\s+|$)/.exec(LLD.startPart);
        if(!rexres)
            return -1;
        B.level = rexres[1].length;
        const n0 = rexres[1].length + LLD.startIndent;
        return n0 + measureIndent(rexres[2], (LLD.preStartIndent || 0) + n0);
    },
    continuesHere() { return "end"; }, // section headers are single-line

    postprocessContentLine(LLD) {
        if(LLD.type === "empty")
            return LLD;
        const It = makeBlockContentIterator(LLD);
        It.goToEnd();

        // Is there perhaps a closing ### ?
        const P = trimEndMarker(It);
        
        return (P ? sliceLLD_to(LLD, P) : LLD);
    },

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { level: -1 }
};
