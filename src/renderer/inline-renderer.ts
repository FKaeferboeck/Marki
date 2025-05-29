import { InlineContent, inlineContentCategory, Delimiter, InlineElement, InlineElementType, isNestableDelimiter } from "../markdown-types.js";
import { EasyInserter, Inserter } from "./renderer.js";
import { escapeXML } from "./util.js";


export type InlineHandlerList = Partial<{
    [K in InlineElementType]: (this: InlineRenderer, B: InlineElement<K>, ins: Inserter, data: InlineContent, i: number) => void | number;
}>;


export class InlineRenderer {
    inlineHandler: InlineHandlerList;

    constructor(inlineHandler: InlineHandlerList) {
        this.inlineHandler = inlineHandler;
    }

    render(data: InlineContent, I: Inserter, trimmed?: boolean) {
        /*if(!I)
            I = new EasyInserter();*/
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
                this.renderDelimiter(I, delim);
                break;
            case "anyI":
                const H = this.inlineHandler[(elt as InlineElement<InlineElementType>).type];
                if(!H)
                    break;
                const i1 = (H as any).call(this, elt, I, data, i);
                if(typeof i1 === "number")
                    i += i1 - 1;
                break;
            }
        }
        return I.join('');
    }

    renderDelimiter(I: Inserter, delim: Delimiter) {
        if(isNestableDelimiter(delim)) {
            if(!delim.isOpener && delim.partnerDelim?.follower)
                return;
            I.add(delim.delim);
            
            return; // TODO!!
        }
        if(delim.closing?.actualized)
            delim.closing.actualized.forEach(x => this.insertDelimiterTag(I, delim.type, x, true));
        if(delim.remaining > 0)
            I.add(delim.delim.slice(0, delim.remaining));
        if(delim.opening?.actualized)
            delim.opening.actualized.forEach(x => this.insertDelimiterTag(I, delim.type, x, false));
    }

    insertDelimiterTag(I: Inserter, type: string, weight: number, closing: boolean) {
        const tags = ['?', 'em', 'strong'];
        I.add(`<${closing ? '/' : ''}${tags[weight]}>`);
    }
} // class InlineRenderer


export function renderInline(data: InlineContent, renderer: InlineRenderer) {
    return renderer.render(data, new EasyInserter());
}
