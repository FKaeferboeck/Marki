import { MarkdownParser, Renderer } from "marki";
import { doSectionNumbering, extendTier1, extendTier2 } from "marki/extensions";

const MDP = new MarkdownParser();
const MDR = new Renderer();

extendTier1(MDP, MDR);
extendTier2(MDP, MDR);
//register_dataModelRef(MDP, MDR);
//register_taskLinkSection(MDP, MDR);


export function getMarkiParser() { return MDP; }


export function MarkiParse(content: string) {
    const Bs = MDP.processDocument(content);
    doSectionNumbering(Bs);
    return Bs;
}

