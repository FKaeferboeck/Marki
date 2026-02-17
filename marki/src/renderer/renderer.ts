import { blockIterator } from "../util.js";
import { ParsingContext } from "../block-parser.js";
import { lineContent, LogicalLine_with_cmt, shiftCol } from "../linify.js";
import { AnyBlock, Block, BlockType } from "../markdown-types.js";
import { DelimRenderHandler, InlineHandlerList, InlineRenderer as InlineRendererInstance, InlineRenderHandler } from "./inline-renderer.js";
import { markdownRendererTraits_standard } from "./renderer-standard.js";
import { actualizeTab, escapeXML } from "./util.js";

export type RenderedItem = string | object;

export interface Inserter {
    setMode(mode: "block" | "inline"): this; // default is "inline", which means no line breaks when joining
    add(S: RenderedItem): this;
    suppressNextSep(): void;
    addFront(s: string): void
    appendInserter(I: Inserter): void;
    join(): string; // if all content is strings this is a trivial join, because line breaks were already put in through add() etc.
}

export class EasyInserter implements Inserter {
    buf: RenderedItem[] = [];
    _suppressNext = false;
    mode: "block" | "inline" = "inline";

    setMode(mode: "block" | "inline") { this.mode = mode;    return this; }

    add(S: RenderedItem) {
        if(this._suppressNext)
            this._suppressNext = false;
        else if(this.mode === "block" && this.buf.length > 0)
            this.buf.push('\n');
        this.buf.push(S);
        return this;
    }
    suppressNextSep() { this._suppressNext = true; }

    addFront(s: RenderedItem): void {
        if(this.buf.length > 0)
            this.buf.unshift(s + (this.mode === "block" ? '\n' : ''));
        else
            this.buf.push(s);
    }

    appendInserter(I: Inserter): void {
        if((I as EasyInserter).buf.length === 0) {
            this._suppressNext = false;
            return;
        }
        if(this._suppressNext)
            this._suppressNext = false;
        else if(this.mode === "block" && this.buf.length > 0)
            this.buf.push('\n');
        this.buf.push(... (I as EasyInserter).buf); // TODO!! What if it's a different implementation?
    }

    join() { return this.buf.join(''); }
}

export type BlockHandlerList = Partial<{
    [K in BlockType]: (this: MarkdownRendererInstance, B: Block<K>, ins: Inserter) => void;
}>;


export interface LanguageRenderer {
    render(B: Block<"fenced">, I: Inserter): void;
    useCustomEnvironment?: boolean; // If true the render method will provide the fenced content's surrounding block element instead of the default <pre><code>
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

    renderAsString(content: AnyBlock[], verbose?: boolean, appendSpace: boolean = true) {
        const I = new EasyInserter().setMode("block");
        for(const B of blockIterator(content))
            this.renderBlock(B, I);
        if(verbose)
            console.log('rendered blocks:', I);
        const S_joined = I.join();
        return (S_joined && appendSpace ? S_joined + '\n' : S_joined);
    }

    renderWithObjects(content: AnyBlock[]) {
        const I = new EasyInserter().setMode("block");
        for(const B of blockIterator(content))
            this.renderBlock(B, I);
        const arr: RenderedItem[] = [];
        for(const item of I.buf) {
            if(typeof item === "string" && arr.length > 0 && typeof arr[arr.length - 1] === "string")
                arr[arr.length - 1] += item;
            else
                arr.push(item);
        }
        return arr;
    }

    renderBlock(B: AnyBlock, I: Inserter) {
        const H = this.blockHandler[B.type];
        if(!H)
            return I.add(`<${B.type}>`);
        (H as any).call(this, B, I);
    }

    fencedOpener(B: Block<"fenced">) {
        return (B.language ? `<code class="language-${B.language}">` : '<code>');
    }

    renderBlockContent(B: AnyBlock, I: Inserter, mode?: "literal" | "tightListItem" | "blockquote" | "trimmed"): Inserter {
        if("blocks" in B) {
            const blocks = (B.blocks as AnyBlock[]);
            const I1 = new EasyInserter().setMode("block");
            if(mode === "tightListItem") {
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
                if(type0 && type0 !== "paragraph")
                    I1.addFront(''); // add leading line break
                if(type1 && type1 !== "paragraph")
                    I1.add(''); // add trailine line break
            }
            else {
                for(const B of blockIterator(blocks))
                    this.renderBlock(B, I1);
            }
            I.appendInserter(I1);
            return I;
        }
    
        let s = '';
        const arr: string[] = [];
        if(mode === "literal") {
            const isHTML = (B.type === "htmlBlock");
            for(let LL: LogicalLine_with_cmt | undefined = B.content;  LL;  LL = LL.next) {
                if(LL.type === "comment")
                    continue;
                if(LL.prefix)
                    arr.push(actualizeTab(LL.prefix, shiftCol(LL)));
                arr.push(lineContent(LL));
                if(!isHTML || LL.next)
                    arr.push('\n');
            }
            s = arr.join('');
            if(!isHTML)
                s = escapeXML(s);
        } else if(B.inlineContent) {
            I.appendInserter(this.inlineRenderer.render(B.inlineContent, new EasyInserter(), mode === "trimmed"));
            return I;
        } else {
            for(let LL: LogicalLine_with_cmt | undefined = B.content;  LL;  LL = LL.next)
                arr.push(lineContent(LL));
            s = arr.join('\n');
        }
        return I.add(s);
    }

    // a helper function
    isTheSingleton(B: AnyBlock) { return (B === this.ctx.localCtx.singletons[B.type]); }
} // class MarkdownRendererInstance
