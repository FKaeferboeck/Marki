import { LogicalLine, standardBlockStart } from "../../linify.js";
import { Block_Extension, BlockIndividualData, ExtensionBlockType } from "../../markdown-types.js";
import { BlockTraits } from "../../traits.js";


export interface MarkdownTabularRow {
    txt: string;
}

export interface MarkdownTabular {
    tableHead: MarkdownTabularRow[];
    tableBody: MarkdownTabularRow[];
    format: string;
}


function isFormatLine(LL: LogicalLine) {
    return LL.type === "text" && LL.content.startsWith('|=');
}


export const markdown_tabular_traits: BlockTraits<ExtensionBlockType, MarkdownTabular> = {
    blockType: "ext_tier1_table",

    startsHere(LL) {
        if(!standardBlockStart(LL))
            return -1;
        if(!LL.content.startsWith('|'))
            return -1;
        if(isFormatLine(LL))
            this.B.format = LL.content;
        else
            this.B.tableHead.push({ txt: LL.content });
        return 0;
    },

    continuesHere(LL) {
        const hadFormat = !!this.B.format;
        if(!standardBlockStart(LL) || !LL.content.startsWith('|'))
            return (hadFormat ? "end" : "reject");
        if(!hadFormat && isFormatLine(LL))
            this.B.format = LL.content;
        else
            (hadFormat ? this.B.tableBody : this.B.tableHead).push({ txt: LL.content });
        return 0;
    },

    /*acceptLineHook(_LL, bct) {
        return (bct !== "start");
    },*/

    allowSoftContinuations: false,
    allowCommentLines: true,
    inlineProcessing: false,

    defaultBlockInstance: {
        tableHead: [],
        tableBody: [],
        format: ''
    }
};
