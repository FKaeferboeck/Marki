import { MarkdownParser } from "../../markdown-parser.js";
import { ParsingContext } from "../../block-parser.js";
import { LogicalLine, standardBlockStart } from "../../linify.js";
import { AnyBlock, Block_Extension, Block_SevereErrorHolder, BlockBase_Container_additions, Marki_SevereError } from "../../markdown-types.js";
import { ExtensionBlockTraits } from "../../traits.js";
import { access, readFile, constants } from 'fs';
import { Inserter, MarkdownRendererInstance } from "src/renderer/renderer.js";

const name_sourceInclude = "ext_tier1_sourceInclude";

export type SourceIncludeResolver = (include_file: string, called_from: string) => string | Marki_SevereError;

export interface SourceInclude extends BlockBase_Container_additions, Block_SevereErrorHolder {
    target:   string;
    resolved: string;
    promise: Promise<AnyBlock[] | Marki_SevereError> | undefined;
}

export interface SourceInclude_ctx {
    allSourceIncludes: SourceInclude[];
}
export function getSourceInclude_ctx(ctx: ParsingContext) {
    const SIctx = ctx.localCtx as SourceInclude_ctx;
    SIctx.allSourceIncludes ||= [];
    return SIctx;
}

export interface SourceIncludeTraits_extra {
    command: RegExp; // the include command; default is #include (as in C++)
    sourceIncludeResolve: SourceIncludeResolver;
}


function load_SDSMD_file_blocks(this: MarkdownParser, filePath: string): Promise<AnyBlock[] | Marki_SevereError> {
    return new Promise<void>((resolve, reject) => access(filePath, constants.F_OK, (err) => {
        if(err)    reject({ exc_msg: err.toString() });
        return resolve();
    }))
    .then(() => new Promise<AnyBlock[]>((resolve, reject) => {
        readFile(filePath, "utf-8", async (err_, data) => {
            if(err_)    return reject({ exc_msg: err_.toString() });
            resolve(this.blockSteps(data));
        });
    }))
    .catch((err: Marki_SevereError) => Promise.resolve(err));
}


function processingStep(this: ParsingContext): Promise<void> {
    const all = getSourceInclude_ctx(this).allSourceIncludes;
    const Bs = all.filter(B => B.promise);
    if(Bs.length === 0)
        return Promise.resolve();
    return Promise.all(Bs.map(B => B.promise!)).then(Xs => {
        Xs.forEach((X, i) => {
            const B = Bs[0];
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
        if(!standardBlockStart(LL))
            return -1;
        let rexres = this.traits.command.exec(LL.content);
        if(!rexres)
            return -1;
        let str = LL.content.slice(rexres[0].length).trim();
        rexres = /^(?:<[^>]+>|"[^"]+"|[^<"]+)$/.exec(str);
        if(!rexres)
            return -1;
        str = rexres[0];
        if(str.startsWith('<') || str.startsWith('"'))
            str = str.slice(1, -1).trim();
        B.target = str;
        const resol = this.traits.sourceIncludeResolve(str, '');
        if(typeof resol !== "string")
            B.severeError = resol;
        else {
            B.resolved = resol;
            B.promise  = load_SDSMD_file_blocks.call(this.MDP, B.resolved);
        }
        getSourceInclude_ctx(this).allSourceIncludes.push(B);
        return LL.content.length;
    },
    continuesHere() { return "end"; }, // single-line

    processingStep,
    processingStepParallelable: false, // important! imports must be finished before other processing steps so imported blocks can be included in those steps

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { containerMode: "Wrapper",  target: '',  resolved: '',  promise: undefined,  blocks: [] },
    inlineProcessing: false,

    command: /^#include\b/i,
    sourceIncludeResolve: () => ({ exc_msg: 'Method sourceIncludeResolve is not implemented, feature not available!'})
};



// Only gets used when there is a severe error and the included file couldn't be read, because otherwise the included content is rendered instead.
export function sourceInclude_render(this: MarkdownRendererInstance, B_: Block_Extension, I: Inserter) {
    const B = B_ as Block_Extension & SourceInclude;
    let msg = B.severeError?.exc_msg.trim() || '';
    msg = msg.replace(/^Error:\s*/, '');
    I.add(`<div>Could not include file: ${msg || 'unknown reason'}</div>`);
};
