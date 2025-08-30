import { BlockParser, MarkdownLocalContext, ParsingContext } from "../../block-parser.js";
import { LogicalLine, standardBlockStart } from "../../linify.js";
import { AnyBlock, Block_Extension, Block_SevereErrorHolder, BlockBase_Container_additions, ExtensionBlockType, IncludeFileContext, Marki_SevereError } from "../../markdown-types.js";
import { BlockTraitsExtended, castExtensionBlock, ExtensionBlockTraits } from "../../traits.js";
import { access, readFile, constants } from 'fs';
import { Inserter, MarkdownRendererInstance } from "../../renderer/renderer.js";
import { blockSteps } from "src/markdown-parser.js";

const name_sourceInclude = "ext_tier1_sourceInclude";

export type SourceIncludeResolver = (include_file: string, called_from: string, includeFileContext: IncludeFileContext) => string | Marki_SevereError;

export interface SourceInclude extends BlockBase_Container_additions, Block_SevereErrorHolder {
    target:         string; // as given in the include call
    resolved:       string; // absolute file-path of the included document
    includedFrom:   "main" | SourceInclude; // where did this include take place? For catching infinite include loops
    promise:        Promise<AnyBlock[] | Marki_SevereError> | undefined;
    includeFileCtx: IncludeFileContext;
}

export interface SourceInclude_ctx {
    URL: string;
    allSourceIncludes: SourceInclude[];
}
export function getSourceInclude_ctx(ctx: ParsingContext) {
    const SIctx = ctx.localCtx as MarkdownLocalContext & SourceInclude_ctx;
    SIctx.allSourceIncludes ||= [];
    SIctx.URL || '';
    return SIctx;
}

export interface SourceIncludeTraits_extra {
    command: RegExp; // the include command; default is #include (as in C++)
    sourceIncludeResolve: SourceIncludeResolver | undefined;
    sourceIncludeResolve_II: (ctx_: ParsingContext, B_caller: SourceInclude) => Promise<boolean>; // reject with Marki_SevereError in case of problems
}

type SourceIncludeBlockParser = BlockParser<ExtensionBlockType, BlockTraitsExtended<ExtensionBlockType, SourceInclude, SourceIncludeTraits_extra>>;


export function circularIncludeGuard(ctx_: ParsingContext, B_caller: SourceInclude) {
    const ctx = getSourceInclude_ctx(ctx_);
    let B0 = B_caller;
    const filepath = B_caller.resolved;
    while(B0.includedFrom !== "main") {
        if(filepath === B0.includedFrom.resolved)
            return false;
        B0 = B0.includedFrom;
    }
    return (filepath !== ctx.URL);
}


export function sourceIncludeResolve_II(ctx_: ParsingContext, B_caller: SourceInclude) {
    return new Promise<true>((resolve, reject) => access(B_caller.resolved, constants.F_OK, (err) => {
        if(err)    return reject({ exc_msg: err.toString() });
        if(!circularIncludeGuard(ctx_, B_caller))
                return reject({ exc_msg: `Circular include of "${B_caller.target}": skipping it` } as Marki_SevereError);
        return resolve(true);
    })).catch((exc: Marki_SevereError) => {
        B_caller.severeError = exc;
        return false;
    });
}


function perform_Marki_sourceInclude(this: SourceIncludeBlockParser, B_caller: Block_Extension & SourceInclude): Promise<AnyBlock[] | Marki_SevereError> {
    return this.traits.sourceIncludeResolve_II(this, B_caller)
    .then(ok => new Promise<AnyBlock[] | Marki_SevereError>((resolve, reject) => {
        if(!ok)
            return resolve(B_caller.severeError!);
        readFile(B_caller.resolved, "utf-8", async (err_, data) => {
            if(err_)    return reject(B_caller.severeError = { exc_msg: err_.toString() });
            // make modified parsing context for the content of the included file:
            const ctx: ParsingContext = { MDP: this.MDP,  globalCtx: this.globalCtx,  localCtx: this.localCtx,  includeFileCtx: B_caller.includeFileCtx };
            const Bs = blockSteps.call(ctx, data);
            // This links includes of includes to their respective parent; includes of main have includeFrom === "main" set by default:
            for(const B of Bs)
                if(castExtensionBlock(B, sourceInclude_traits))
                    B.includedFrom = B_caller;
            resolve(Bs);
        });
    }))
    .catch((err: Marki_SevereError) => Promise.resolve(err));
}


function processingStep(this: ParsingContext): Promise<void> {
    const all = getSourceInclude_ctx(this).allSourceIncludes;
    const Bs = all.filter(B => B.promise); // only those with open promises are relevant
    if(Bs.length === 0)
        return Promise.resolve();
    return Promise.all(Bs.map(B => B.promise!)).then(Xs => {
        Xs.forEach((X, i) => {
            const B = Bs[i];
            if("exc_msg" in X) {
                B.severeError = X;
                B.blocks      = [];
            }
            else
                B.blocks = X;
            B.promise = undefined;
        });
        return processingStep.call(this); // recursion for imports inside imports
    });
}


export const sourceInclude_traits: ExtensionBlockTraits<SourceInclude, SourceIncludeTraits_extra> = {
    blockType: name_sourceInclude,

    startsHere(LL: LogicalLine, B) {
        if(!this.traits.sourceIncludeResolve) // the extension is inactive unless a filepath resolver function is provided
            return -1;
        if(!standardBlockStart(LL))
            return -1;
        let rexres = this.traits.command.exec(LL.content);
        if(!rexres)
            return -1;
        let str = LL.content.slice(rexres[0].length).trim();
        rexres = /^(?:<[^>]+>|"[^"]+"|[^<"]+)$/.exec(str);
        if(!rexres)
            return -1;
        const ctx = getSourceInclude_ctx(this);
        str = rexres[0];
        if(str.startsWith('<') || str.startsWith('"'))
            str = str.slice(1, -1).trim();
        B.target = str;
        B.includeFileCtx = { ... this.includeFileCtx };
        const resol = this.traits.sourceIncludeResolve(str, ctx.URL, B.includeFileCtx);
        if(typeof resol !== "string")
            B.severeError = resol;
        else {
            B.resolved = resol;
            B.promise  = perform_Marki_sourceInclude.call(this as SourceIncludeBlockParser, B);
        }
       ctx.allSourceIncludes.push(B);
        return LL.content.length;
    },
    continuesHere() { return "end"; }, // single-line

    processingStep,
    processingStepMode: "structural", // important! imports must be finished before other processing steps so imported blocks can be included in those steps

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: {
        containerMode: "Wrapper",  target: '',  resolved: '',  includedFrom: "main",  promise: undefined,  blocks: [],
        includeFileCtx: { prefix: '',  mode: "relative" }
    },
    inlineProcessing: false,

    command: /^#include\b/i,
    sourceIncludeResolve: undefined,
    sourceIncludeResolve_II
};



// Only gets used when there is a severe error and the included file couldn't be read, because otherwise the included content is rendered instead.
export function sourceInclude_render(this: MarkdownRendererInstance, B_: Block_Extension, I: Inserter) {
    const B = B_ as Block_Extension & SourceInclude;
    let msg = B.severeError?.exc_msg.trim() || '';
    msg = msg.replace(/^Error:\s*/, '');
    I.add(`<div>Could not include file: ${msg || 'unknown reason'}</div>`);
};
