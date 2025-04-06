import { BlockParser, BlockParser_Standard } from "../block-parser.js";
import { takeLinkDestination, takeLinkTitle } from "../inline/link.js";
import { AnyInline, LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { BlockContentIterator, makeBlockContentIterator } from "../util.js";


export interface LinkDef {
    linkLabel:   string;
    destination: AnyInline[];
    linkTitle:   AnyInline[];
}

export type LinkDefParser = BlockParser<"linkDef"> & { stage: number; };

function linkDefStep(this: LinkDefParser, It: BlockContentIterator) {
    switch(this.stage) {
    case 0:
        {
            const rexres = It.regexInPart(/^\[(?:\\\[|\\\]|[^\[\]])+\]:/);
            if(!rexres)
                return false;
            
            this.B.linkLabel = rexres[0].slice(1, -2);
            this.stage = 1;
            It.skipNobrSpace();
            //console.log(`> Link label  {${this.B.linkLabel}}`)
            if(!It.peekChar()) // line break after link label
                break;
        }
    case 1:
        {
            if(!takeLinkDestination(It, this.B.destination))
                return false;
            //console.log(`> Destination {${this.B.destination}}`)
            this.stage = 2;
            if(!It.peekChar()) // line break after link destination
                break;
        }
    case 2:

        if(!takeLinkTitle(It, this.B.linkTitle))
            return false;
        //console.log(`> Link title  {${this.B.linkTitle}}`)
        
        this.stage = 3;
    }
    return true;
}



export const linkDef_traits: BlockTraits<"linkDef"> = {
    startsHere(this: LinkDefParser, LLD: LogicalLineData, B) {
        this.stage = 0;
        if(!(LLD.type === "single" || LLD.type === "text") || LLD.startIndent >= 4)
            return -1;
        if(!LLD.startPart.startsWith('['))
            return -1;
        const It = makeBlockContentIterator(LLD);
        return (linkDefStep.call(this, It) ? 0 : -1);
    },

    continuesHere(this: LinkDefParser, LLD: LogicalLineData) {
        if(this.stage === 3) // the whole link definition was in the start line, this is the next line
            return "end";
        const It = makeBlockContentIterator(LLD);
        if(!linkDefStep.call(this, It))
            return "reject";
        return (this.stage === 3 ? "last" : 0);
    },

    postprocessContentLine(LLD) {
        LLD.startPart = LLD.startPart.replace(/(?:\s+#+|^#+)?\s*$/, ''); // handle trailing space and closing sequences
        return LLD;
    },

    finalizeBlockHook() {
        this.MDP.registerLinkDef(this.B);
    },

    allowSoftContinuations: false,
    allowCommentLines: false,
    hasContent: false,
    defaultBlockInstance: {
        linkLabel: '',
        destination: [],
        linkTitle: []
    }
};
