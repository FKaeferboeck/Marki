import { BlockContainer, BlockParser, BlockParser_Container, BlockParser_Standard, ParseState, MarkdownParser } from "../block-parser";
import { BlockType, ExtensionBlockType, Block, LogicalLineData, ListItem } from "../markdown-types";
import { LineStructure, LogicalLineType } from "../parser";
import { ContainerBlockTraits, BlockContinuationType } from "../traits";
import { standardBlockStart } from "../util";


export const listItem_traits: ContainerBlockTraits<"listItem"> = {
    isContainer: true,
    startsHere(LLD: LogicalLineData, B) {
        if(!standardBlockStart(LLD))
            return -1;
        const rexres = /^([\-+*]|\d{1,9}[).])\s{1,3}/.exec(LLD.startPart);
        if(!rexres)
            return -1;
        B.marker = rexres[1].slice(-1) as ListItem["marker"];
        if(B.marker === "." || B.marker === ")")
            B.marker_number = +rexres[1].slice(0, -1);
        B.indent = rexres[0].length;
        this.setCheckpoint(LLD);
        return B.indent;
    },
    
    continuesHere(LLD, B) {
        if(LLD.startIndent >= B.indent) {
            this.setCheckpoint(LLD);
            return B.indent;
        }
        if(LLD.type === "empty")
            return B.indent;

        return (LLD === this.getCheckpoint()?.next ? "soft" : "end");
    },

    acceptLineHook(LLD, bct) {
        if(bct === "soft")
            this.setCheckpoint(LLD);
        return true;
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    
    creator(MDP) { return new BlockParser_Container<"listItem">(MDP, this as ContainerBlockTraits<"listItem">); },
    defaultBlockInstance: {
        type: "listItem",
        isContainer: true,
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        blocks: [],
        marker: "*",
        indent: 0
    }
};
export { BlockParser_Container };

