import { BlockParser } from "../block-parser.js";
import { InlineParsingContext } from "../inline-parsing-context.js";
import { takeLinkDestination } from "../inline/link.js";
import { isSpaceLine, LogicalLine, standardBlockStart } from "../linify.js";
import { AnyInline } from "../markdown-types.js";
import { BlockContinuationType, makeBlockTraits } from "../traits.js";
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
    hadSpace: boolean; // space between link destination and link link title (it must exist)
};

const stageProgression = [-1, -1, -1, 5, 6, 5, 6 ];

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
        if(It.pop() !== ':')
            return "reject";
        // now we finished parsing the label
        this.stage = 2;
        this.B.linkLabel = this.parts.join('\n').slice(1, -1);
        if(/^[ \t\r\n]*$/.test(this.B.linkLabel))
            return "reject";
        It.skipNobrSpace();
        if(!It.peek()) // line break after link label
            return 0;
    case 2:
        if(!takeLinkDestination(It, this.B.destination))
            return "reject";
        this.stage = 3;
        this.hadSpace = (It.skipNobrSpace() > 0);
        if(!It.peek()) { // line break after link destination
            this.stage = 4;
            this.hadSpace = true;
            return 0;
        }
    case 3: // looking for link title in the same line as the link destination
    case 4: // looking for link title in the next line
        It.skipNobrSpace();
        this.delim = { delim: undefined,  isOpen: true };
        this.parts = [];
    case 5:
    case 6:
        const title = It.takeDelimited({ '"': '"',  '\'': '\'',  '(': ')' }, this.delim);
        if(title === false) {
            if(this.stage === 4) {
                // we're in a new line and the link title doesn't start -> there is none and that's ok
                this.stage = 6;
                return "end";
            }
            return "reject";
        }
        if(!this.hadSpace)
            return "reject"; // there must be whitespace between link destination and link title, if there is a link title
        this.stage = stageProgression[this.stage]; // 3 -> 5,  4 -> 6
        this.parts.push(title);
        if(this.delim.isOpen)
            return 0;
        It.skipNobrSpace();
        if(It.peek())
            return (this.stage === 5 ? "reject" : "end"); // link definition must end after the link title
                                                          // if it doesn't but the potential link title was after a line break we accept the part before the checkpoint (== link without title)
        this.stage = 7;

        // TODO!! Improve LLD construction
        const LL: LogicalLine = {
            lineIdx: -1,  type: "text",
            content: this.parts.join('\n').slice(1, -1),
            indent: 0,  prefix: ''
        };
        const context = new InlineParsingContext(this.MDP.inlineParser_standard);
        context.inlineParseLoop(makeBlockContentIterator(LL),
                                this.B.linkTitle = []);
        return "last";
    }
    return "reject"; // unreachable
}



export const linkDef_traits = makeBlockTraits("linkDef", {
    startsHere(this: LinkDefParser, LL, B) {
        this.stage = 0;
        if(!standardBlockStart(LL))
            return -1;
        if(!LL.content.startsWith('['))
            return -1;
        if(this.MDP.diagnostics)
            console.log('Link def block', this.B)
        const It = makeBlockContentIterator(LL, true);
        const res = linkDefStep.call(this, It);
        if(res === "reject") {
		    this.resetBlock(); // if we abort in the first line the parser doesn't get a chance to release the parser from the reuse cache, so we need to reset it for the next use
            return -1;
        }
        if(this.stage === 4)
            this.setCheckpoint(LL);
        return 0; // Even when we know the link def finishes in one line we'll still end it in the next line, because that's how the parser works.
    },

    continuesHere(this: LinkDefParser, LL) {
        if(this.stage === 7) // the whole link definition was in the start line, this is the next line
            return "end";
        if(isSpaceLine(LL))
            return (this.stage === 4 ? "end" : "reject"); // If we encounter an empty line while waiting for the link title to start, that means an ommitted title and is ok.
        const It = makeBlockContentIterator(LL, true);
        const ret = linkDefStep.call(this, It);
        if(ret !== "reject" && (this.stage === 4 || this.stage === 7))
            this.setCheckpoint(LL);
        return ret;
    },

    postprocessContentLine(LL) {
        if(LL.type === "text")
            LL.content = LL.content.replace(/(?:\s+#+|^#+)?\s*$/, ''); // handle trailing space and closing sequences
        return LL;
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
});
