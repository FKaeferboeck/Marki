import { measureColOffset } from "../../linify.js";
import { Block_Extension } from "../../markdown-types.js";
import { Inserter, Renderer } from "../../renderer/renderer.js";
import { ExtensionBlockTraits, castExtensionBlock } from "../../traits.js";
import { tier2_command_block_start } from "../traits.js";

export const markdown_doc_title_type = "ext_tier2_title" as const;

export interface MarkdownDocTitle {
    title: string;
}


export const markdown_doc_title_traits: ExtensionBlockTraits<MarkdownDocTitle> = {
    blockType: markdown_doc_title_type,

    startsHere(LL) {
        if(!tier2_command_block_start(this.MDP, LL))
            return -1;
        const rexres = /^.title\s+/i.exec(LL.content);
        if(!rexres)
            return -1;
        const start = rexres[0].length;
        this.B.title = LL.content.slice(start).trim();
        return measureColOffset(LL, start) + LL.indent;
    },

    continuesHere: () => "end",

    finalizeBlockHook() {
        this.MDP.customContext['doc_title'] = this.B.title;
    },

    allowSoftContinuations: false,
    allowCommentLines: false,
    defaultBlockInstance: { title: '' }
};



/* Rendering stuff */

export function ext_tier2_title_render(this: Renderer, B: Block_Extension, I: Inserter) {
    if(!castExtensionBlock(B, markdown_doc_title_traits))    return;
    I.add(`<div class="document-title">${this.renderBlockContent(B, null, "trimmed")}</div>`);
};
