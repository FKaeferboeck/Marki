import { AnyInline, InlineElement } from "../markdown-types.js";

export function renderHTML_entity(elt: InlineElement<"htmlEntity">) {
    if(elt.codePoint === undefined)
        return `&${elt.code};`;
    return (typeof elt.codePoint === "number" ? String.fromCodePoint(elt.codePoint)
                                              : String.fromCodePoint(... elt.codePoint));
}

const replacements: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
};
export const escapeXML = (s: string) => s.replaceAll(/[<>&"]/g, x => replacements[x]);

export function escapeXML_all(C: AnyInline[]) {
    return escapeXML(C.map(s => {
        if(typeof s === "string")
            return s;
        switch(s.type) {
        case "escaped":     return s.character;
        case "htmlEntity":  return renderHTML_entity(s);
        default:            return '';
        }
    }).join(''));
}


const digits = '0123456789ABCDEF';
const hexByte = (n: number) => '%' + digits[(n >> 4) & 0x0F] + digits[n & 0x0F];

export const urlEncode = (S: AnyInline[]) => {
    const joined = S.map(s => {
        if(typeof s === "string")
            return s;
        switch(s.type) {
        case "escaped":     return s.character;
        case "htmlEntity":  return renderHTML_entity(s);
        default:            return '';
        }
    }).join('');
    return joined.replaceAll(/[^A-Za-z\d-._~!#$&'()*+,/:;=?@]/g, (c, i: number) => {
    //return joined.replaceAll(/[^A-Za-z\d-._~!#$&'()*+,/:;=?@\[\]]/g, (c, i: number) => {
        if(c === '%' && /^%[\dA-F]{2}/.test(joined.slice(i, i + 3)))
            return c; // skip already present character code
        const n = c.charCodeAt(0);
        if (n <= 0x7F)
            return hexByte(n);
        if (n <= 0x7FF)
            return hexByte(0xC0 | (n >> 6)) + hexByte(0x80 | (n & 0x3F));
        if (n <= 0xFFFF)
            return hexByte(0xE0 | (n >> 12)) + hexByte(0x80 | ((n >> 6) & 0x3F)) + hexByte(0x80 | (n & 0x3F));
        return hexByte(0xF0 | (n >> 18)) + hexByte(0x80 | ((n >> 12) & 0x3F)) + hexByte(0x80 | ((n >> 6) & 0x3F)) + hexByte(0x80 | (n & 0x3F));
    });
}
