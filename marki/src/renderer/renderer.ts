import { blockIterator } from "../util.js";
import { ParsingContext } from "../block-parser.js";
import { lineContent, LogicalLine_with_cmt, shiftCol } from "../linify.js";
import { AnyBlock, Block, BlockType } from "../markdown-types.js";
import { DelimRenderHandler, InlineHandlerList, InlineRenderer as InlineRendererInstance, InlineRenderHandler } from "./inline-renderer.js";
import { markdownRendererTraits_standard } from "./renderer-standard.js";
import { actualizeTab, escapeXML } from "./util.js";

export interface Inserter {
    add(... S: string[]): void;
    join(sep: string): string;
}

export class EasyInserter implements Inserter {
    buf: string[] = [];
    add(... S: string[]) { this.buf.push(... S); }
    join(sep: string) { return this.buf.join(sep); }
}

export type BlockHandlerList = Partial<{
    [K in BlockType]: (this: MarkdownRendererInstance, B: Block<K>, ins: Inserter) => void;
}>;


export interface LanguageRenderer {
    render(B: Block<"fenced">, I: Inserter): void;
}


export interface MarkdownRendererTraits extends InlineRenderHandler {
    blockHandler:  BlockHandlerList;
    customLanguageRenderer: Record<string, LanguageRenderer>;
}


export class MarkdownRendererInstance implements MarkdownRendererTraits {
    inlineRenderer: InlineRendererInstance;
    ctx: ParsingContext;
    blockHandler:  BlockHandlerList;
    elementHandlers: InlineHandlerList;
    delimHandlers: Record<string, DelimRenderHandler>;

    customLanguageRenderer: Record<string, LanguageRenderer>;

    constructor(ctx: ParsingContext, traits?: MarkdownRendererTraits) {
        this.ctx = ctx;
        traits ||= markdownRendererTraits_standard;
        this.blockHandler           = traits.blockHandler;
        this.elementHandlers        = traits.elementHandlers;
        this.delimHandlers          = traits.delimHandlers;
        this.customLanguageRenderer = traits.customLanguageRenderer;
        this.inlineRenderer = new InlineRendererInstance(this, ctx); // TODO!!
    }

    referenceRender(content: AnyBlock[], verbose?: boolean, appendSpace: boolean = true) {
        const I = new EasyInserter();
        for(const B of blockIterator(content))
            this.renderBlock(B, I);
        if(verbose)
            console.log('rendered blocks:', I);
        const S_joined = I.join('\n');
        return (S_joined && appendSpace ? S_joined + '\n' : S_joined);
    }

    renderBlock(B: AnyBlock, I: Inserter) {
        const H = this.blockHandler[B.type];
        if(!H)
            return I.add('<??>');
        
        (H as any).call(this, B, I);
    }

    fencedOpener(B: Block<"fenced">) {
        return (B.language ? `<code class="language-${B.language}">` : '<code>');
    }

    renderBlockContent(B: AnyBlock, I: Inserter | null, mode?: "literal" | "tightListItem" | "blockquote" | "trimmed"): string {
        if("blocks" in B) {
            const blocks = (B.blocks as AnyBlock[]);
            if(mode === "tightListItem") {
                const I1 = new EasyInserter();
                let type0: BlockType | undefined, type1: BlockType | undefined;
                for(const b of blocks) {
                    if(b.type === "emptySpace")
                        continue;
                    type0 ||= b.type;
                    type1 = b.type;
                    if(b.type === "paragraph")
                        this.renderBlockContent(b, I1);
                    else
                        this.renderBlock(b, I1);
                }
                return (!type0 || type0 === "paragraph" ? '' : '\n') + I1.join('\n') + (!type1 || type1 === "paragraph" ? '' : '\n');
            }
    
            let s = this.referenceRender(blocks, false, false);
            if(mode === "blockquote")
                s = s.trim();
            if(s)
                I?.add(s);
            return s;
        }
    
        let s = '';
        const arr: string[] = [];
        if(mode === "literal") {
            for(let LL: LogicalLine_with_cmt | undefined = B.content;  LL;  LL = LL.next) {
                if(LL.type === "comment")
                    continue;
                if(LL.prefix)
                    arr.push(actualizeTab(LL.prefix, shiftCol(LL)));
                arr.push(lineContent(LL));
                if(B.type !== "htmlBlock" || LL.next)
                    arr.push('\n');
            }
            s = arr.join('');
        } else if(B.inlineContent) {
            const s1 = this.inlineRenderer.render(B.inlineContent, new EasyInserter(), mode === "trimmed");
            I?.add(s1);
            return s1;
        } else {
            for(let LL: LogicalLine_with_cmt | undefined = B.content;  LL;  LL = LL.next)
                arr.push(lineContent(LL));
            s = arr.join('\n');
        }
        const s1 = escapeXML(s);
        I?.add(s);
        return s1;
    }

    // a helper function
    isTheSingleton(B: AnyBlock) { return (B === this.ctx.localCtx.singletons[B.type]); }
} // class MarkdownRendererInstance
