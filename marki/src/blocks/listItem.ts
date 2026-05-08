import { MarkdownParser, MarkdownParserTraits } from "../markdown-parser.js";
import { BlockParser_Container } from "../block-parser.js";
import { isSpaceLine, measureColOffset, standardBlockStart } from "../linify.js";
import { Block_Container, AnyBlock, isContainer, Block } from "../markdown-types.js";
import { makeBlockContainerTraits } from "../traits.js";
import { blockIterator, LLinfo } from "../util.js";


export interface ListItem_ctx {
    checkboxListItem_active: boolean;
}

/* Reasonable choices for the command char are things like $, #, %, !, or \ — whichever is most appropriate for your syntax style preference */
export const set_checkboxListItem_active = (MDPT: MarkdownParserTraits, active: boolean) => {
    (MDPT.globalCtx as ListItem_ctx).checkboxListItem_active = active;
}

export const checkboxListItem_active = (MDP: MarkdownParser) => ((MDP.globalCtx as ListItem_ctx).checkboxListItem_active || false);


export interface ListItem {
    marker:           "*" | "-" | "+" | "." | ")";
    marker_number?:   number;
    github_checkbox?: boolean; // if feature is active
    indent:           number;
    isLooseItem:      boolean;
    parentList:       List | undefined;
}

export interface List {
    listType:  "Ordered" | "Bullet";
    contents:  Block<"listItem">[];
    startIdx?: number;
    isLoose:   boolean;
}

const markerTypes: Record<ListItem["marker"], "unordered" | "ordered"> = {
    "*": "unordered",  "-": "unordered",  "+": "unordered",
    ".": "ordered",  ")": "ordered"
};


export const listItem_traits = makeBlockContainerTraits("listItem", {
    containerMode: "Container",
    startsHere(LL, B, interrupting?) {
        if(!standardBlockStart(LL))
            return -1;
        let rexres = /^([\-+*]|\d{1,9}[).])([ \t]+|$)/.exec(LL.content);
        if(!rexres)
            return -1;
        B.marker = rexres[1].slice(-1) as ListItem["marker"];
        const markerType = markerTypes[B.marker];
        if(markerType === "ordered") {
            B.marker_number = +rexres[1].slice(0, -1);
            if(interrupting === "paragraph" && B.marker_number !== 1)
                return -1; // orderedlist items may only interrupt a paragraph if they have the starting number 1 (CommonMark just-so rule)
        }

        const markerLength = rexres[1].length;
        let space = Math.max(measureColOffset(LL, rexres[0].length) - markerLength, 1);
        if(rexres[0].length === LL.content.length) {
            if(interrupting === "paragraph")
                return -1; // list items starting with an empty line are not allowed to interrupt paragraph (CommonMark just-so rule)
            space = 1;
        } else if(space > 4)
            space = 1;

        let offs = rexres[1].length + space;
        if(markerType === "unordered" && checkboxListItem_active(this.MDP) &&
           (rexres = /^.[ \t]+\[([ \tx]+)\]/.exec(LL.content)))
        {
            const checked = rexres[1].split('').reduce((p, c) => p + +(c === 'x'), 0);
            if (checked <= 1) {
                offs += 2 + rexres[1].length;
                B.github_checkbox = Boolean(checked);
            }
        }

        B.indent = LL.indent + offs;
        this.setCheckpoint(LL);
        return B.indent;
    },
    
    continuesHere(LL) {
        if(LL.indent >= this.B.indent) {
            this.setCheckpoint(LL);
            return this.B.indent;
        }
        if(isSpaceLine(LL)) {
            //(this.B as ContainerBlockBase<"listItem">)
            if(LL === this.startLine?.next && (this as BlockParser_Container<"listItem">).curContentType() === "emptySpace")
                // the list item started with an empty line (list item marker with no content), we are now in the following line and it's empty too
                return "end"; // CommonMark: "A list item can begin with at most one blank line."
            
            return this.B.indent;
        }

        return (LL === this.getCheckpoint()?.next ? "soft" : "end");
    },

    acceptLineHook(LL, bct) {
        if(bct === "soft")
            this.setCheckpoint(LL);
        return true;
    },

    finalizeBlockHook() {
        this.B.isLooseItem = isLooseItem(this.B as Block_Container<"listItem">);
    },

    processingStep(doc) {
        collectLists(doc.blocks);
        return Promise.resolve();
    },

    allowSoftContinuations: true,
    allowCommentLines: true,
    isInterrupter: true,
    canSelfInterrupt: true,

    defaultBlockInstance: {
        marker: "*",
        indent: 0,
        isLooseItem: false,
        parentList:  undefined
    }
});


function isLooseItem(B: Block_Container<"listItem">) {
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



function collectLists(Bs: AnyBlock[], diagnostics = false) {
    if(diagnostics)    console.log(`collectLists of ${Bs.length} blocks`)
    let spaced = false;
    let L: List | undefined;
    for(const B of blockIterator(Bs)) {
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
            if(diagnostics)    console.log(`L) list item at ${LLinfo(B.content)} is ${B.isLooseItem ? 'loose' : 'tight'}, spaced? ${spaced}`);
            L.isLoose ||= B.isLooseItem || spaced;
            B.parentList = L;
            spaced = false;
        }
        else if(B.type === "emptySpace") {
            if(L)
                spaced = true;
        } else {
            if(L && diagnostics)
                console.log(`L) Ending list at ${LLinfo(B.content)} -> is ${L.isLoose ? 'loose' : 'tight'}`);
            L = undefined;
            spaced = false;
        }

        if(isContainer(B))
            collectLists(B.blocks, diagnostics);
    }
    if(L && diagnostics) {
        const C1 = L.contents[L.contents.length - 1];
        console.log(`L) Ending list at element ${LLinfo(C1.blocks[0].content)} -> list is ${L.isLoose ? 'loose' : 'tight'}`);
    }
}
