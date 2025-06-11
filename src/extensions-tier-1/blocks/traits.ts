import { BlockParser } from "../../block-parser";
import { MarkdownParser } from "../../markdown-parser";
import { BlockType, ExtensionBlockType } from "../../markdown-types";
import { AnyBlockTraits, BlockTraits } from "../../traits";
import { markdown_tabular_traits } from "./tabular";


export function extendTier1(this: MarkdownParser) {
    this.addExtensionBlocks(markdown_tabular_traits, "last");

}
