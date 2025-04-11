import { BlockParser, BlockParser_Standard } from "../block-parser.js";
import { takeLinkDestination, takeLinkTitle } from "../inline/link.js";
import { AnyInline, LogicalLineData } from "../markdown-types.js";
import { BlockContinuationType, BlockTraits } from "../traits.js";
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

function linkDefStep(this: LinkDefParser, It: BlockContentIterator): BlockContinuationType {
    switch(this.stage) {
    case 0:
        It.skipNobrSpace();
        this.delim = { delim: undefined,  isOpen: true };
        this.stage = 1;
        this.parts = [];
    case 1:
        const label = It.takeDelimited({ '[': ']' }, this.delim);
        if(label === false)
            return "reject";
        this.parts.push(label);
        if(this.delim.isOpen)
            return 0;
        if(It.nextChar() !== ':')
            return "reject";
        // now we finished parsing the label
        this.stage = 2;
        this.B.linkLabel = this.parts.join('\n').slice(1, -1);
        It.skipNobrSpace();
        //console.log(`> Link label  {${this.B.linkLabel}}`)
        if(!It.peekChar()) // line break after link label
            return 0;
    case 2:
        if(!takeLinkDestination(It, this.B.destination))
            return "reject";
        //console.log(`> Destination {${this.B.destination}}`)
        this.stage = 3;
        It.skipNobrSpace();
        if(!It.peekChar()) { // line break after link destination
            this.stage = 4;
            return 0;
        }
    case 3: // looking for link title in the same line as the link destination
    case 4: // looking for link title in the next line
        It.skipNobrSpace();
        this.delim = { delim: undefined,  isOpen: true };
        this.parts = [];
    case 5:
        const title = It.takeDelimited({ '"': '"',  '\'': '\'',  '(': ')' }, this.delim);
        if(title === false) {
            if(this.stage === 4) {
                // we're in a new line and the link title doesn't start -> there is none and that's ok
                this.stage = 6;
                return "end";
            }
            return "reject";
        }
        this.stage = 5;
        this.parts.push(title);
        if(this.delim.isOpen)
            return 0;
        It.skipNobrSpace();
        if(It.peekChar())
            return "reject"; // link definition must end after the link title
        this.stage = 6;
        this.B.linkTitle = [this.parts.join('\n').slice(1, -1)]
        //parseBackslashEscapes(removeDelimiter(title), linkTitle);
        //It.skip({ ' ': true,  '\n': true });
        return "last";
    }
    return "reject"; // unreachable
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
        return (res === "reject" ? -1 : 0); // Even when we know the link def finishes in one line we'll still end it in the next line, because that's how the parser works.
    },

    continuesHere(this: LinkDefParser, LLD: LogicalLineData) {
        if(this.stage === 6) // the whole link definition was in the start line, this is the next line
            return "end";
        if(LLD.type === "empty" || LLD.type === "emptyish")
            return (this.stage === 4 ? "end" : "reject"); // If we encounter an empty line while waiting for the link title to start, that means an ommitted title and is ok.
        const It = makeBlockContentIterator(LLD, true);
        return linkDefStep.call(this, It);
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
