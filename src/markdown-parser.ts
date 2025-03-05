import { BlockParserTraits, BlockParserTraitsList, standardBlockParserTraits } from "./block-parser";
import { ExtensionBlockType } from "./markdown-types";



export class MarkdownParser {
    constructor() {
        this.blockParserTraits = standardBlockParserTraits;
    }

    registerExtension(type: "blockParser", traits: BlockParserTraits<ExtensionBlockType>) {
        this.blockParserTraits[traits.defaultBlockInstance.type] = traits;
        return this;
    }


    private blockParserTraits: BlockParserTraitsList;
}
