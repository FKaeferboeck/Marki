import { BlockContainer, BlockParser, BlockParser_Container, BlockParser_Standard, ParseState, MarkdownParser } from "../block-parser";
import { BlockType, ExtensionBlockType, Block, LogicalLineData, ListItem, ContainerBlockBase } from "../markdown-types";
import { LineStructure, LogicalLineType } from "../parser";
import { ContainerBlockTraits, BlockContinuationType } from "../traits";
import { LLDinfo, standardBlockStart } from "../util";


export const listItem_traits: ContainerBlockTraits<"listItem"> = {
    isContainer: true,
    startsHere(LLD: LogicalLineData, B, interrupting?) {
        if(!standardBlockStart(LLD))
            return -1;
        const rexres = /^([\-+*]|\d{1,9}[).])(\s+|$)/.exec(LLD.startPart);
        if(!rexres)
            return -1;
        B.marker = rexres[1].slice(-1) as ListItem["marker"];
        if(B.marker === "." || B.marker === ")")
            B.marker_number = +rexres[1].slice(0, -1);

        let space = Math.max(rexres[2].length, 1);
        if(rexres[0].length === LLD.startPart.length) {
            if(interrupting === "paragraph")
                return -1; // list items starting with an empty line are not allowed to interrupt paragraph (CommonMark just-so rule)
            space = 1;
        } else if(space > 4)
            space = 1;

        B.indent = LLD.startIndent + rexres[1].length + space;
        this.setCheckpoint(LLD);
        return B.indent;
    },
    
    continuesHere(LLD) {
        if(LLD.startIndent >= this.B.indent) {
            this.setCheckpoint(LLD);
            return this.B.indent;
        }
        if(LLD.type === "empty" || LLD.type === "emptyish") {
            //(this.B as ContainerBlockBase<"listItem">)
            if(LLD === this.startLine?.next && (this as BlockParser_Container<"listItem">).curContentType() === "emptySpace")
                // the list item started with an empty line (list item marker with no content), we are now in the following line and it's empty too
                return "end"; // CommonMark: "A list item can begin with at most one blank line."
            
            return this.B.indent;
        }

        return (LLD === this.getCheckpoint()?.next ? "soft" : "end");
    },

    acceptLineHook(LLD, bct) {
        if(bct === "soft")
            this.setCheckpoint(LLD);
        return true;
    },

    finalizeBlockHook() {
        this.B.isLooseItem = isLooseItem(this.B as ContainerBlockBase<"listItem">);
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    canSelfInterrupt: true,
    
    creator(MDP) { return new BlockParser_Container<"listItem">(MDP, this as ContainerBlockTraits<"listItem">); },
    defaultBlockInstance: {
        type: "listItem",
        isContainer: true,
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        blocks: [],
        marker: "*",
        indent: 0,
        isLooseItem: false
    }
};


function isLooseItem(B: ContainerBlockBase<"listItem">) {
    const blocks = B.blocks;
    let i = 0, iN = B.blocks.length;
    while(i < iN && blocks[i].type === "emptySpace")    ++i;
    let inSpace = false;
    for(;  i < iN;  ++i) {
        if(blocks[i].type === "emptySpace")
            inSpace = true;
        else if(inSpace) // a non-space block following space which isn't initial space -> there is space between two blocks
            return true;
    }
    return false;
}
