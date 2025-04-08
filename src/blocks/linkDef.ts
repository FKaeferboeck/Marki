import { BlockParser, BlockParser_Standard } from "../block-parser.js";
import { takeLinkDestination, takeLinkTitle } from "../inline/link.js";
import { AnyInline, LogicalLineData } from "../markdown-types.js";
import { BlockTraits } from "../traits.js";
import { BCI_TakeDelimited_IO, BlockContentIterator, makeBlockContentIterator } from "../util.js";


export interface LinkDef {
    linkLabel:   string;
    destination: AnyInline[];
    linkTitle:   AnyInline[];
}

export type LinkDefParser = BlockParser<"linkDef"> & {
    stage: number;
    parts: string[];             //
    delim: BCI_TakeDelimited_IO; // used consecutively for link label and link title
};

function linkDefStep(this: LinkDefParser, It: BlockContentIterator) {
    switch(this.stage) {
    case 0:
        It.skipNobrSpace();
        this.delim = { delim: undefined,  isOpen: true };
        this.stage = 1;
        this.parts = [];
    case 1:
        const label = It.takeDelimited({ '[': ']' }, this.delim);
        if(label === false)
            return false;
        this.parts.push(label);
        if(this.delim.isOpen)
            return true;
        if(It.nextChar() !== ':')
            return false;
        // now we finished parsing the label
        this.stage = 2;
        this.B.linkLabel = this.parts.join('\n').slice(1, -1);
        It.skipNobrSpace();
        console.log(`> Link label  {${this.B.linkLabel}}`)
        if(!It.peekChar()) // line break after link label
            return true;
    case 2:
        if(!takeLinkDestination(It, this.B.destination))
            return false;
        //console.log(`> Destination {${this.B.destination}}`)
        this.stage = 3;
        It.skipNobrSpace();
        if(!It.peekChar()) // line break after link destination
            return true;
    case 3:
        It.skipNobrSpace();
        this.delim = { delim: undefined,  isOpen: true };
        this.stage = 4;
        this.parts = [];
    case 4:
        const title = It.takeDelimited({ '"': '"',  '\'': '\'',  '(': ')' }, this.delim);
        if(title === false)
            return false;
        this.parts.push(title);
        if(this.delim.isOpen)
            return true;
        It.skipNobrSpace();
        if(It.peekChar())
            return false; // link definition must end after the link title
        this.stage = 5;
        this.B.linkTitle = [this.parts.join('\n').slice(1, -1)]
        //parseBackslashEscapes(removeDelimiter(title), linkTitle);
        //It.skip({ ' ': true,  '\n': true });
        return true;
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
        const It = makeBlockContentIterator(LLD, true);
        const res = linkDefStep.call(this, It);
        return (res ? 0 : -1);;
    },

    continuesHere(this: LinkDefParser, LLD: LogicalLineData) {
        if(this.stage === 5) // the whole link definition was in the start line, this is the next line
            return "end";
        if(LLD.type === "empty" || LLD.type === "emptyish")
            return "reject";
        const It = makeBlockContentIterator(LLD, true);

        if(!linkDefStep.call(this, It))
            return "reject";
        return (this.stage === 5 ? "last" : 0);
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
