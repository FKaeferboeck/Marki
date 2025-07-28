import { ParsingContext } from "../block-parser.js";
import { InlineContent, inlineContentCategory, Delimiter, InlineElement, InlineElementType, isNestableDelimiter } from "../markdown-types.js";
import { EasyInserter, Inserter } from "./renderer.js";
import { escapeXML } from "./util.js";


export type InlineHandlerList = Partial<{
    [K in InlineElementType]: (this: InlineRenderer, B: InlineElement<K>, ins: Inserter, data: InlineContent, i: number, closing?: boolean) => void | number;
}>;

export type DelimRenderHandler =  (I: Inserter, direction: "open" | "close", type: string, weight: number) => void;

export interface InlineRenderHandler {
    elementHandlers: InlineHandlerList;
    delimHandlers: Record<string, DelimRenderHandler>;
}


export class InlineRenderer implements InlineRenderHandler {
    elementHandlers: InlineHandlerList;
    delimHandlers: Record<string, DelimRenderHandler>
    ctx: ParsingContext;

    constructor(IRH: InlineRenderHandler, ctx: ParsingContext) {
        this.elementHandlers = IRH.elementHandlers;
        this.delimHandlers   = IRH.delimHandlers;
        this.ctx = ctx;
    }

    render(data: InlineContent, I: Inserter, trimmed?: boolean) {
        for(let i = 0, iE = data.length - 1;  i <= iE;  ++i) {
            const elt = data[i];
            switch(inlineContentCategory(elt))
            {
            case "text":
                let s = escapeXML(elt as string);
                if(trimmed && i === 0)
                    s = s.replace(/^[ \t]+/, '');
                if(trimmed && i === iE)
                    s = s.replace(/[ \t]+$/, '');
                I.add(s);
                continue;
            case "delim":
                const delim = elt as Delimiter;
                this.renderDelimiter(I, delim, data, i);
                break;
            case "anyI":
                const H = this.elementHandlers[(elt as InlineElement<InlineElementType>).type];
                if(!H)
                    break;
                (H as any).call(this, elt, I, data, i);
                break;
            }
        }
        return I.join('');
    }

    renderDelimiter(I: Inserter, delim: Delimiter, data: InlineContent, i: number) {
        if(isNestableDelimiter(delim)) {
            if(!delim.isOpener && delim.partnerDelim?.follower) { // closing delimiter of a follower-handled delimited section
                const H = this.elementHandlers[delim.partnerDelim.follower.type];
                (H as any).call(this, delim.partnerDelim.follower, I, data, i, true);
                return;
            }
            I.add(delim.delim);
            return; // TODO!!
        }
        const H = this.delimHandlers[delim.type] || this.delimHandlers['*'] as DelimRenderHandler | undefined;
        if(H && delim.closing?.actualized)
            delim.closing.actualized.forEach(x => H(I, "close", delim.type, x));
        if(delim.remaining > 0)
            I.add(delim.delim.slice(0, delim.remaining));
        if(H && delim.opening?.actualized)
            delim.opening.actualized.forEach(x => H(I, "open", delim.type, x));
    }
} // class InlineRenderer


export function renderInline(data: InlineContent, renderer: InlineRenderer) {
    return renderer.render(data, new EasyInserter());
}
