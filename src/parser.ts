import { Position, Range, uinteger } from 'vscode-languageserver';

export interface IncrementalChange {
	range: Range;
	rangeLength?: uinteger;
	text: string;
}

export interface XML_Comment extends Position {
	type:      "XML_Comment";
	content:   string;
	continues: boolean; // is it a multiline comment that continues after this entity (i.e. in the next line)?
}

export interface HTML_Tag extends Position {
	type:      "HTML_Tag";
	content:   string; // not content in the HTML sense, just the tag itself
	continues: boolean; // a HTML tag can span multiple lines
}

export interface TextPart extends Position {
	type:     "TextPart";
	content:  string;
}

export type HTML_Markup = XML_Comment | HTML_Tag;
export type LinePart = TextPart | HTML_Markup;

const htmlMarkup = { XML_Comment: true,  HTML_Tag: true,  TextPart: false } as const;
function isHTML_Markup(P: LinePart | null | undefined): P is HTML_Markup { return (P ? htmlMarkup[P.type] : false); }


export type LogicalLineType = "empty" | "emptyish" | "comment" | "text" | "single";

export interface LogicalLine {
	start:  number; // part index where this logical line begins
	extent: number; // number of parts in this logical line; will be 1 most of the time
	type:   LogicalLineType;
}


export interface LineStructure {
	all: LinePart[]; // the physical structure
	logical_lines: LogicalLine[];
}

export interface LinifyUpdateResult {
    logical_line_start:    number;
    logical_lines_removed: number;
    logical_lines_added:   number;
}


export function lineType(L: LogicalLine, LS: LineStructure): LogicalLineType {
	if(L.extent === 0)    return "empty";
	if(L.extent === 1) {
		const P = LS.all[L.start];
		if(P.type === "XML_Comment")    return "comment";
		if(P.content.length === 0)    return "empty";
		if(P.content.trimEnd().length === 0)    return "emptyish";
		return "text";
	}
	// now there are multiple parts, which means that at least some of them are comments -> can only be all comment or mixed content
	return (LS.all.slice(L.start, L.start + L.extent).some(P => P.type !== "XML_Comment" && P.content.trimEnd().length !== 0) ? "text" : "comment");
}


export function linify(text: string): LineStructure {
	const A = linify_(text, { line: 0,  character: 0 }, false);
	return layoutLogicalLines(A, [0, A.length]);
}


// exported for unit testing
export function spliceContent(parts: LinePart[], pos: Range, text: string) {
    if(parts.length === 0)    return '';
    const AA: string[] = [];
    const {start, end} = pos;
    let line = parts[0].line;
    const push = (P: LinePart) => {
        if(P.line > line)    { line = P.line;    AA.push('\n'); }
        AA.push(P.content);
    };
    let i = 0, iN = parts.length;
    let P: LinePart | undefined;

    // I. Push the parts that come before the insertion range — there should be exactly one usually
    while(i < iN && ((P = parts[i]).line < start.line || P.character + P.content.length < start.character))
        { ++i;    push(P); }

    // II. Push the piece leading up to the start of the insertion range
    if(i < iN) {
        P = parts[i];
        if(P.line > line)    { line = P.line;    AA.push('\n'); }
        AA.push(P.content.slice(0, start.character - P.character));
    }

    AA.push(text); // III. Insert text. If there is a newline associated with the insertion it is contained in the text.

    // IV. skip parts that were swallowed up by the given removal range
    while(i < iN && ((P = parts[i]).line < end.line || P.character + P.content.length < end.character))    ++i;

    // V. Push the piece coming out of the insertion range
    if(i < iN) {
        P = parts[i++];
        AA.push(P.content.slice(end.character - P.character));
    }

    // VI. push the remainder of the parts
    while(i < iN)    push(parts[i++]);
    return AA.join('');
}


const endPart = (L: LogicalLine) => (L.start + L.extent);


export function linify_update(LS: LineStructure, D: IncrementalChange): LinifyUpdateResult {
	const A = LS.all;

	// 1. Identify range of line parts that are affected. Often this will only be a single one (i0 == i1)
	const ar = findAffectedRange(LS, D.range);
	const [part0, part1] = ar.part_range;
	//console.log(ar);
	// total part range of the affected logical lines; may be slightly larger than the affected part range:
	const ar2 = [        LS.logical_lines[ar.logical_range[0]].start,
                 endPart(LS.logical_lines[ar.logical_range[1] - 1])];
    //console.log(ar2);
	
	// 2. Assemble text of the affected part with the new text inserted
	const P0 = A[part0], P1 = A[part1 - 1];
	const new_content = spliceContent(A.slice(part0, part1), D.range, D.text);// P0.content.slice(0, start.character - P0.character) + D.text + P1.content.slice(end.character - P1.character);
	//console.log(end.character, P1.character, `[[${new_content}]]`);
	
	// 3. parse the new text
	const new_parts = linify_(new_content, { line: P0.line,  character: P0.character }, ar.start_in);
	if(new_parts.length === 0)    throw new Error('Illegal line range');
	const last_new_part = new_parts[new_parts.length - 1];
	const R1: Position = { line: last_new_part.line,  character: endchar(last_new_part) };
	//console.log(new_parts, R1)

	if(isContinuation(last_new_part) != ar.end_in && part1 < A.length) {
		// mismatch: We used to end in an open comment and don't any more, or vice versa => need to reparse the rest of the file
		// If this occurs at the end of the file it's not relevant.
		const AA: string[] = [];
		let line = P1.line;
		for(let i = part1, iN = A.length;  i < iN;  ++i) {
			const P = A[i];
			if(P.line > line)    { line = P.line;    AA.push('\n'); }
			AA.push(P.content);
		}
		const s = new_content + AA.join('');
        
		const rest_of_file = linify_(s, { line: P0.line,  character: P0.character },
                                     part0 > 0 && isContinuation(A[part0]));
        //console.log(`Remainder text [[${s}]]`, rest_of_file)
		A.splice(part0);
		//console.log(all, new_parts, rest_of_file);
		Array.prototype.push.apply(A, rest_of_file);
		const LS2 = layoutLogicalLines(A, [ar2[0], A.length]);
        const res = {
            logical_line_start:    ar.logical_range[0],
            logical_lines_removed: LS.logical_lines.length - ar.logical_range[0],
            logical_lines_added:   LS2.logical_lines.length
        };
		LS.logical_lines.splice(ar.logical_range[0]);
		Array.prototype.push.apply(LS.logical_lines, LS2.logical_lines);
		//console.log(all)
		return res;
	}

	// 4. splice the new part into the structure, adjusting the line parts that come after the new content
	const part_delta = new_parts.length - (part1 - part0); // how does the number of parts change from this update?
	const line_delta = R1.line - P1.line;
	const char_delta = R1.character - endchar(P1);
	//console.log(line_delta, character_delta);
	let i = part1, iN = A.length;
	while(i < iN && A[i].line === P1.line) {
		const P = A[i++];
		P.character += char_delta;
		P.line = R1.line;
	}
	if(line_delta !== 0)
		while(i < iN)    A[i++].line += line_delta;
	A.splice(part0, part1 - part0, ... new_parts);
    //console.log(ar2, part_delta, new_parts, part0, part1)
	ar2[1] += part_delta;

	// 5. adjust the logical line structure
	const LS2 = layoutLogicalLines(A, ar2);
    //console.log(LS2);

    //console.log(`Adjusting logical lines [${ar.logical_range[1]},${LS.logical_lines.length}) by delta ${part_delta} ...`);
	if(part_delta !== 0)
		for(let i = ar.logical_range[1], iN = LS.logical_lines.length;  i < iN;  ++i)
			LS.logical_lines[i].start += part_delta;
	LS.logical_lines.splice(ar.logical_range[0], ar.logical_range[1] - ar.logical_range[0],
		                    ... LS2.logical_lines);
    return {
        logical_line_start:    ar.logical_range[0],
        logical_lines_removed: ar.logical_range[1] - ar.logical_range[0],
        logical_lines_added:   LS2.logical_lines.length
    };
}



const isCmt          = (P: LinePart | null): P is XML_Comment => (P ? P.type === "XML_Comment" : false);
const endchar        = (P: LinePart) => (P.character + P.content.length);
const isContinuation = (P: LinePart) => (isHTML_Markup(P) && P.continues ? P.type : false);


export function linify_(text: string, pos: Position, inCmt: false | HTML_Markup["type"]) {
	let curStart = 0;
	let curEntity: LinePart | null = null;
	let all: LinePart[] = [];

	const startEntity = (i: number, type: LinePart["type"]): LinePart => {
		const P: LinePart = {
            type:    type,
            line:    pos.line,  character: i - curStart,
            content: ''
        } as LinePart;
		if(isHTML_Markup(P))
			P.continues = false;
		return P;
	};

	const finishEntity = (i: number | undefined, skip_empty: boolean = false) => {
		if(!curEntity)    return;
		const i0 = curStart + curEntity.character;
		if(i === i0 && (skip_empty || curEntity.character > 0)) { // empty part
			curEntity = null;
			return;
		}
		curEntity.content = text.slice(i0, i);
		curEntity.character += pos.character;
		all.push(curEntity);
		curEntity = null;
	};

	curEntity = startEntity(0, inCmt ? "XML_Comment" : "TextPart");
	for(let i = 0, iN = text.length;  i < iN;  ++i) {
		switch(text[i]) {
		case '\r':
		case '\n':
			++pos.line;
			if(inCmt = (isHTML_Markup(curEntity) && curEntity.type))
				curEntity.continues = true;
			finishEntity(i);
			pos.character = 0;
			if(text[i] === '\r' && i + 1 < iN && text[i + 1] === '\n')    ++i; // handle \r\n line break
			curEntity = startEntity(curStart = i + 1, inCmt || "TextPart");
			break;
		case '<':
			if(isHTML_Markup(curEntity))    break;
			if(text.startsWith('<!--', i)) {
				finishEntity(i, true);
				curEntity = startEntity(i, "XML_Comment");
				i += 3;
			}
			/*else if(/^<[\/:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]/u.test(text.slice(i, i + 2))) { // html tag (we are very loose with the syntax)
				finishEntity(i, true);
				curEntity = startEntity(i, "HTML_Tag");
				i += 1;
			}*/
			break;
		case '-':
			if(text.startsWith('-->', i) && isCmt(curEntity)) {
				finishEntity(i + 3);
				i += 2;
				// start new LinePart after the comment
				curEntity = startEntity(i + 1, "TextPart");
			}
			break;
		case '>':
			if(curEntity?.type === "HTML_Tag") {
				finishEntity(i + 1);
				// start new LinePart after the HTML tag
				curEntity = startEntity(i + 1, "TextPart");
			}
			break;
		}
	}

	++pos.line;
	if(inCmt = (isCmt(curEntity) && curEntity.type))
		curEntity.continues = true;
	finishEntity(undefined);
	return all;
}



function findAffectedRange(LS: LineStructure, R: Range) {
	const LL = LS.logical_lines, A = LS.all;
	let i0 = 0, iN = LL.length, jN = A.length;
	let {start, end} = R;
    //console.log('findAffecgtedRange', R)
	const continuingCmt = (j: number) => (j >= 0 && isContinuation(A[j]));
    const lastLine = (lol: LogicalLine) => A[lol.start + lol.extent - 1].line;

	// skip logical lines before the correct one
	while(i0 < iN && lastLine(LL[i0]) < start.line)    ++i0;

	// skip line parts inside the logical line that come before the change range
	let i1 = i0, j0 = LL[i0].start;
	while(j0 < jN && (A[j0].line < start.line || endchar(A[j0]) < start.character))    ++j0;

    // Special case: If the part is an XML comment, and the preceding element is in the same row then the part is that comment's opening;
    // in that case it's possible that it won't be a comment after the update, in which case it becomes regular text and should be merged with the preceding text element.
    // Therefore we include that text element in the affected range.
    if(htmlMarkup[A[j0].type] && LL[i0].start < j0)    --j0;

	let j1 = j0;
	// go to end of change range
	while(j1 < jN && A[j1].line <   end.line)    ++j1;
	while(j1 < jN && A[j1].line === end.line && A[j1].character <= end.character)    ++j1;

	// find logical end line for the already identified physical end part
	while(i1 < iN && LL[i1].start < j1)    ++i1;
	
	return {
		logical_range: [i0, i1], // second element is off-end index
		part_range:    [j0, j1], //
		start_in:      continuingCmt(j0 - 1),
		end_in:        continuingCmt(j1 - 1)
	};
}


// the function trusts that part_range is the total part range of a span of logical lines
export function layoutLogicalLines(A: LinePart[], part_range: number[]): LineStructure {
	const LL: LogicalLine[] = [];
	const [i0, i1] = part_range;
    if(i1 <= i0)
        throw new Error(`Empty range [${i0},${i1}) for layoutLogicalLines()`);
    //console.log(`layout [${i0},${i1})`);

	let isCont = false, line = -1;
	for(let i = i0;  i < i1;  ++i) {
		const P = A[i];
		if(P.line > line && !isCont)
			LL.push({ start: i,  extent: -i,  type: "text" }); // extent and type will be properly set below
		line = P.line;
		isCont = !!isContinuation(P);
	}

	for(let i = 0, iN = LL.length - 1;  i < iN;  ++i)
		LL[i].extent += LL[i + 1].start;
	LL[LL.length - 1].extent += i1;

	const LS = {
		all: A,
		logical_lines: LL
	};

	for(const L of LL)
		L.type = lineType(L, LS);

	return LS;
}
