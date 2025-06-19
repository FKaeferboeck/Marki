import { PositionOps } from 'marki/util';
import { Range, uinteger } from 'vscode-languageserver';


export interface IncrementalChange {
	range: Range;
	rangeLength?: uinteger;
	text: string;
}


export function condenseChanges(Cs: { changeBuffer: IncrementalChange[]; }) {
	const condensed: IncrementalChange[] = [];
	//console.log(Cs.changeBuffer.map(c => `[${c.range.start.character},${c.range.end.character}]`).join('  '));
	const C2 = Cs.changeBuffer.reduce((C0: IncrementalChange | undefined, C1) => {
		if(!C0)    return C1;
		const R0 = C0.range, R1 = C1.range;
		if(PositionOps.equal(R1.end, R0.start)) { // e.g. repeated backspace
			R0.start = { ... R1.start };
			C0.text = C1.text + C0.text;
		}
		else if(PositionOps.equal(R1.start, PositionOps.advance(R0.start, C0.text))) { // e.g. fast typing
			R0.end = PositionOps.add(R0.end, PositionOps.delta(R1.end, R1.start));
			C0.text += C1.text;
		}
		else {
			condensed.push(C0);
			return C1;
		}
		return C0;
	}, undefined);
	if(C2)
		condensed.push(C2);
	Cs.changeBuffer = condensed;
	//console.log('Condensed to ' + condensed.map(c => `[${c.range.start.character},${c.range.end.character}]`).join('  '));
	return condensed.length;
}
