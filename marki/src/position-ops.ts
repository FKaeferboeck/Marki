import { Pos, PosDelta } from "./markdown-types.js";


export interface KnowsEnd {
    startPos: Pos;
    endPos:   Pos;
}
type InlineStream = (KnowsEnd | string)[]; // duck type for AnyInline[] or InlineContent


export namespace PositionOps {
    export function set(P: Pos, P0: Pos): Pos { P.line = P0.line;    P.character = P0.character;    return P; }

	export const equal  = (A: Pos, B: Pos) => (A.line === B.line && A.character === B.character);
    export const before = (A: Pos, B: Pos) => (A.line < B.line || (A.line === B.line && A.character <  B.character));
    export const leq    = (A: Pos, B: Pos) => (A.line < B.line || (A.line === B.line && A.character <= B.character));

	export function advance(P: Pos, text: string): Pos {
		const arr = text.split(/\r\n?|\n/g);
		if(arr.length === 1)
			return { line: P.line,  character: P.character + text.length };
		return { line: P.line + arr.length - 1,  character: arr[arr.length - 1].length };
	}

	export function delta(from: Pos, to: Pos): PosDelta {
		const D = { y: to.line - from.line,  x: to.character - from.character };
		if(D.y < 0)    return delta(to, from);
		if(D.y > 0)    D.x = to.character;
		else if(D.x < 0)    return delta(to, from);
		return D;
	}

	export function add(P: Pos, D: PosDelta): Pos {
		if(D.y !== 0)    return { line: P.line + D.y,  character: D.x };
		else             return { line: P.line,  character: P.character + D.x };
	}

    export function startPos(elts: InlineStream, i: number): Pos {
        if(i <= 0)
            return { line: 0,  character: 0 };
        const elt0 = elts[i - 1];
        if(typeof elt0 !== "string")
            return elt0.endPos;
        // Element follows a string -> go to the start of the string element and advance by it
        const P = { line: 0,  character: 0 };
        if(i > 1) {
            const elt00 = elts[i - 2];
            if(typeof elt00 === "string")
                throw new Error('Two consecutive string elements in inline content stream — this cannot be!');
            set(P, elt00.endPos);
        }
        return advance(P, elt0);
    }

    export const endPos = (elts: InlineStream) => startPos(elts, elts.length);

    export function locateInline(elts: InlineStream, P: Pos): number | undefined {
        const i = elts.findIndex(elt => typeof elt !== "string" && before(P, elt.endPos));
        if(i < 0)
            return undefined; // off end
        // Now we know that P must lie in elts[i] or elts[i - 1] (possible if elts[i] is a string)
        const P0 = startPos(elts, i);
        return (leq(P0, P) ? i : Math.max(i - 1, 0));
    }
}
