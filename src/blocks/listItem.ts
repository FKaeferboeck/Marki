import { BlockParser_Container } from "../block-parser.js";
import { LogicalLineData, ListItem, BlockBase_Container, AnyBlock, List, isContainer } from "../markdown-types.js";
import { BlockTraits_Container } from "../traits.js";
import { LLDinfo, standardBlockStart } from "../util.js";


export const listItem_traits: BlockTraits_Container<"listItem"> = {
    isContainer: true,
    startsHere(LLD: LogicalLineData, B, interrupting?) {
        if(!standardBlockStart(LLD))
            return -1;
        const rexres = /^([\-+*]|\d{1,9}[).])(\s+|$)/.exec(LLD.startPart);
        if(!rexres)
            return -1;
        B.marker = rexres[1].slice(-1) as ListItem["marker"];
        if(B.marker === "." || B.marker === ")") {
            B.marker_number = +rexres[1].slice(0, -1);
            if(interrupting === "paragraph" && B.marker_number !== 1)
                return -1; // orderedlist items may only interrupt a paragraph if they have the starting number 1 (CommonMark just-so rule)
        }

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
        this.B.isLooseItem = isLooseItem(this.B as BlockBase_Container<"listItem">);
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    canSelfInterrupt: true,
    
    creator(MDP) { return new BlockParser_Container<"listItem">(MDP, this as BlockTraits_Container<"listItem">); },
    defaultBlockInstance: {
        type: "listItem",
        isContainer: true,
        logical_line_start: -1,
        logical_line_extent: 0,
        contents: [],
        blocks: [],
        marker: "*",
        indent: 0,
        isLooseItem: false,
        parentList:  undefined
    }
};


function isLooseItem(B: BlockBase_Container<"listItem">) {
    const blocks = B.blocks;
    let i = 0, iN = B.blocks.length;
    while(i < iN && blocks[i].type === "emptySpace")    ++i; // skip leading space
    let inSpace = false;
    for(;  i < iN;  ++i) {
        if(blocks[i].type === "emptySpace")
            inSpace = true;
        else if(inSpace) // a non-space block following space which isn't initial space -> there is space between two blocks
            return true;
    }
    return false;
}



export function collectLists(Bs: AnyBlock[], diagnostics = false) {
    if(diagnostics)    console.log('Collect lists!');
    let spaced = false;
    let L: List | undefined;
    for(const B of Bs) {
        if(B.type === "listItem") {
            if(L && L.contents[0].marker !== B.marker) {
                if(diagnostics)    console.log(`L) Marker difference "${L.contents[0].marker}" -> "${B.marker}"`);
                L = undefined;
            }
            if(!L)
                L = {
                    listType: (B.marker === "." || B.marker === ")" ? "Ordered" : "Bullet"),
                    contents: [],
                    isLoose:  false
                };
            L.contents.push(B);
            if(diagnostics)    console.log(`L) list item at ${LLDinfo(B.contents[0] as LogicalLineData)} is ${B.isLooseItem ? 'loose' : 'tight'}, spaced? ${spaced}`);
            L.isLoose ||= B.isLooseItem || spaced;
            B.parentList = L;
            spaced = false;
        }
        else if(B.type === "emptySpace") {
            if(L)
                spaced = true;
        } else {
            if(L && diagnostics)
                console.log(`L) Ending list at ${LLDinfo(B.contents[0] as LogicalLineData)} -> is ${L.isLoose ? 'loose' : 'tight'}`);
            L = undefined;
            spaced = false;
        }

        if(isContainer(B))
            collectLists(B.blocks, diagnostics);
    }
    if(L && diagnostics) {
        const C1 = L.contents[L.contents.length - 1];
        console.log(`L) Ending list at element ${LLDinfo(C1.blocks[0].contents[0] as LogicalLineData)} -> list is ${L.isLoose ? 'loose' : 'tight'}`);
    }
}
