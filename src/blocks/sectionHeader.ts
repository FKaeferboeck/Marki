import { measureColOffset, standardBlockStart } from "../linify.js";
import { makeBlockTraits } from "../traits.js";
import { BlockContentIterator, isLineStart, makeBlockContentIterator, sliceLL_to } from "../util.js";


export interface SectionHeader {
	level: number;
	//customTag?: string;
}


function trimEndMarker(It: BlockContentIterator) {
    const P = It.newPos(); // just to make a position instance
    let n = 0, c: string | false = false;

    //trailing space will be trimmed in every case
    while((c = It.peekN(-(n + 1))) === ' ' || c === '\t')    ++n;

    if(It.peekN(-(n + 1)) !== '#') {
        if(n === 0)
            return false;
        It.getPosition(P, -n);
        return P;
    }
    const n0 = n;
        
    while(It.peekN(-(n + 1)) === '#')    ++n;
    It.getPosition(P, -n);
    if(isLineStart(P)) // -> closing ### with no text before it (rare special case)
        return P;

    // a closing ### must be preceded by space (in the special case above that space was already trimmed from the left as part of the opening ###)
    const n1 = n;
    while((c = It.peekN(-(n + 1))) === ' ' || c === '\t')    ++n;
    if(n === n1) { // closing ### not preceded by space -> it isn't a closing ### -> include it in content
        if(n0 === 0)
            return false;
        It.getPosition(P, -n0);
        return P;
    }
    It.getPosition(P, -n);
    return P;
}


export const sectionHeader_traits = makeBlockTraits("sectionHeader", {
    startsHere(LL, B) {
        if(!standardBlockStart(LL))
            return -1;
        const rexres = /^(#{1,6})(\s+|$)/.exec(LL.content);
        if(!rexres)
            return -1;
        B.level = rexres[1].length;
        return measureColOffset(LL, rexres[0].length) + LL.indent;
    },
    continuesHere() { return "end"; }, // section headers are single-line

    postprocessContentLine(LL) {
        if(LL.type === "empty")
            return LL;
        const It = makeBlockContentIterator(LL);
        It.goToEnd();

        // Is there perhaps a closing ### ?
        const P = trimEndMarker(It);
        
        return (P ? sliceLL_to(LL, P) : LL);
    },

    allowSoftContinuations: false,
    allowCommentLines: false,
    isInterrupter: true,
    defaultBlockInstance: { level: -1 }
});
