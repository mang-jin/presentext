const fileInput = document.getElementById("fileInput");
const output = document.getElementById("output");
const dwBtn = document.getElementById("download");

let DEFAULT_TEXT_WEIGHT = 1;

let iota = (() => {
    let cnt = 0;
    return (reset) => {
        if (reset) cnt = 0;
        return cnt++;
    }
})();

const token_type = {
    STRING: iota(true),
    NUMBER: iota(),
    OBJECT: iota(),
    IDENTIFIER: iota(),
    BOOLEAN: iota(),
};

const PUSHABLE_TOKENS = [token_type.STRING,token_type.NUMBER,token_type.OBJECT,token_type.BOOLEAN];

class Token {
    constructor(type,value) {
        this.type = type;
        this.value = value;
    }
    toString() {
        return `'${this.value}'[${this.type}]`
    }
}

const ALIGN_TYPES = ["flex-start", "center", "flex-end"];


function pxt_proc_align_group(stack)
{
    let align_type = stack.pop();
    let align_number = stack.pop();
    let widget = stack.pop();
    if (!(widget instanceof Widget) || typeof align_number != "number" || typeof align_type != "number")
        return "align requires (widget: Widget, align_number: number, align_type: number)"
    switch (align_number) {
    case 0: widget.style.push("align-items: " + ALIGN_TYPES[align_type]); break;
    case 1: widget.style.push("justify-content: " + ALIGN_TYPES[align_type]); break;
    }
    stack.push(widget);
}

function pxt_proc_text(stack)
{
    let usage = "text requires (weight: number, opt: {color: string, bold, italic, underlined, strikethrough: bool}, content: string)";
    let content = stack.pop();
    let opt = stack.pop();
    let weight = stack.pop();
    if (typeof weight != "number" || typeof content != "string" || !isObject(opt)) return usage+` but (${weight}, ${opt}, ${content})`;
    let color = opt.color ?? "#000000";
    let bold = opt.bold ?? false;
    let italic = opt.italic ?? false;
    let underlined = opt.underlined ?? false;
    let strikethrough = opt.strikethrough ?? false;
    if (typeof color != "string" ||
        typeof bold != "boolean" || typeof italic != "boolean" ||
        typeof underlined != "boolean" || typeof strikethrough != "boolean") return usage+` but (${weight}, ${opt}, ${content})`;
    let newW = new Widget(TEXT,weight,content);
    newW.style.push("color: "+color);
    if (opt.bold) newW.style.push("font-weight: bold");
    if (opt.italic) newW.style.push("font-style: italic");
    let deco = "";
    if (opt.underlined) deco+="underline ";
    if (opt.strikethrough) deco+="strikethrough";
    if (deco) newW.style.push("text-decoration-line: "+deco);
    stack.push(newW)
}

function pxt_proc_text2(stack)
{
    let content = stack.pop();
    let weight = stack.pop();
    if (typeof content != "string" || typeof weight != "number") return "text requires (weight: number,content: string)";
    stack.push(new Widget(TEXT,weight,content));
}

function pxt_proc_text3(stack)
{
    let content = stack.pop();
    let color = stack.pop();
    let weight = stack.pop();
    if (typeof color != "string" || typeof content != "string" || typeof weight != "number") return "text3 requires (weight: number, color: string, content: string)";
    let newW = new Widget(TEXT,weight,content);
    newW.style.push("color: "+color);
    stack.push(newW)
}

function isObject(val) {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function pxt_proc_text4(stack)
{
    let content = stack.pop();
    let color = stack.pop();
    let style = stack.pop();
    let weight = stack.pop();
    if (typeof color != "string" || typeof content != "string" || !isObject(style) || typeof weight != "number")
        return "text4 requires (weight: number, style: object, color: string, content: string)";
    let newW = new Widget(TEXT,weight,content);
    newW.style.push("color: "+color);
    if (style.bold) newW.style.push("font-weight: bold");
    if (style.italic) newW.style.push("font-style: italic");
    let deco = "";
    if (style.underlined) deco+="underline ";
    if (style.strikethrough) deco+="strikethrough";
    if (deco) newW.style.push("text-decoration-line: "+deco);
    stack.push(newW)
}

function pxt_proc_space(stack)
{
    let size = stack.pop();
    if (typeof size != "number") return "space requires (size: number)";
    stack.push(new Widget(SPACE, 0, "", [`margin: ${size/2}vh ${size/2}vw;`]));
}

function pxt_proc_img(stack,pixel=false)
{
    let img_path = stack.pop();
    let weight = stack.pop();
    if (typeof weight != "number" || typeof img_path != "string") return "img requires (widget: Widget, img_path: string)";
    let newW = new Widget(IMG, weight, img_path);
    if (pixel)
        newW.style.push("image-rendering: pixelated");
    stack.push(newW);
}

function pxt_proc_bg_clr(stack)
{
    let color_code = stack.pop();
    let widget = stack.pop();
    if (!(widget instanceof Widget) || typeof color_code != "string") return "bg-clr requires (widget: Widget, color_code: string)";
    widget.style.push(`background-color: ${color_code}`);
    stack.push(widget);
}

function pxt_proc_bg_img(stack)
{
    let img_path = stack.pop();
    let widget = stack.pop();
    if (!(widget instanceof Widget) || typeof img_path != "string") return "bg-img requires (widget: Widget, img_path: string)";
    widget.class_list.push("img-"+img_path);
    stack.push(widget);
}

function pxt_proc_binding(stack)
{
    let weight = stack.pop();
    if (typeof weight != "number") return "binding requires (weight: number)";
    let newGroup = new Widget(BINDING,weight,"");
    stack.push(newGroup);
}

function pxt_proc_frame(stack)
{
    let vertical = stack.pop();
    let weight = stack.pop();
    if (typeof weight != "number" || (typeof vertical != "boolean" && typeof vertical != "number")) return "frame requires (weight: number, vertical: bool)";
    let newGroup = new Widget(FRAME,weight,"",[vertical ? "flex-direction: column" : "flex-direction: row"]);
    stack.push(newGroup);
}

function pxt_proc_begin(stack)
{
    stack.push(null);
}

function pxt_proc_end(stack)
{
    let item = stack.pop();
    let body = [];
    while (item !== null && stack.length != 0) {
        if (item instanceof Widget) {
            body.push(item);
        }
        item = stack.pop();
    }
    let newGroup = stack.pop();
    if (newGroup instanceof Widget) body.forEach((child) => newGroup.Push(child,back=true));
    else return "end proc couldn't find Widget to merge";
    stack.push(newGroup);
}

function pxt_proc_slide(stack,slides,value)
{
    let item = null;
    let newSlide = new Widget(SLIDE,0,value);
    while (item = stack.pop()) {
        if (item instanceof Widget) {
            if (item.type == SLIDE) {
                stack.push(item);
                break;
            }
            newSlide.Push(item,back=true);
        }
    }
    stack.push(newSlide);
}

function pxt_proc_group(stack)
{
    let vertical = stack.pop();
    let weight = stack.pop();
    if (typeof weight != "number" || (typeof vertical != "boolean" && typeof vertical != "number")) return "group requires (weight: number, vertical: bool)";
    let newGroup = new Widget(GROUP,weight,"",[vertical ? "flex-direction: column" : "flex-direction: row"]);
    stack.push(newGroup);
}

let error = undefined;

function find(line,start,predicate) {
    while (start < line.length && !predicate(line[start])) {
        if (line[start]=="\\") start++;
        start++;
    }
    return start;
}
function find_str_end(line,start) {
    while (start < line.length && line[start]!="\"") {
        if (line[start]=="\\") start++;
        start++;
    }
    return start;
}

function readSrc(file) {
    slides = []; // 이미 어딘가에서 선언됨.

    error = undefined;
    file.text().then(pxt_src => {
        let t = pxt_src;
        let splited = [];
        let i = 0;
        i = find(t,i,(chr) => (!/\s/.test(chr)));
        let str_mode = false;
        while (i < t.length) {
            let i_end = undefined;
            if (t[i]=="\"") {
                i_end = find_str_end(t,i+1);
                splited.push(new Token(token_type.STRING,JSON.parse(`"${t.slice(i+1,i_end)}"`)));
                i = find(t,i_end+1,(chr) => (!/\s/.test(chr)));
            } else if (t[i]=="{") {
                i_end = find(t,i+1,(chr) => (chr=="}"));
                splited.push(new Token(token_type.OBJECT,JSON.parse("{"+t.slice(i+1,i_end)+"}")));
                i = find(t,i_end+1,(chr) => (!/\s/.test(chr)));
            } else {
                i_end = find(t,i,(chr) => (/\s/.test(chr)));
                let tok=t.slice(i,i_end);
                if (!isNaN(tok))                      splited.push(new Token(token_type.NUMBER,Number(tok)));
                else if (tok=='true' || tok=='false') splited.push(new Token(token_type.BOOLEAN,tok=='true'));
                else                                  splited.push(new Token(token_type.IDENTIFIER,tok));
                i = find(t,i_end,(chr) => (!/\s/.test(chr)));
            }
        }
        console.log(splited);
        // let curSlide = Widget(SLIDE,);
        let presentation = "";
        let curGroups = [-1];
        let curG = () => curGroups[curGroups.length - 1];
        {
            let idx = -1;
            function next() {
                idx++;
                if (splited[idx]) {
                    return splited[idx];
                } else {
                    return null;
                }
            }
            function cur() {
                return splited[idx];
            }
            let stack = [];
            // #001
            while (next()) {
                let token = cur();
                // console.log(token);
                if (token == null) throw new Error("something went wrong");
                else if (PUSHABLE_TOKENS.indexOf(token.type)!=-1) stack.push(token.value);
                else if (token.value == "group") error = pxt_proc_group(stack);
                else if (token.value == "img") error = pxt_proc_img(stack);
                else if (token.value == "img-pixel") error = pxt_proc_img(stack,pixel=true);
                else if (token.value == "bg-img") error = pxt_proc_bg_img(stack);
                else if (token.value == "bg-clr") error = pxt_proc_bg_clr(stack);
                else if (token.value == "space") error = pxt_proc_space(stack);
                else if (token.value == "text") error = pxt_proc_text(stack);
                else if (token.value == "text2") error = pxt_proc_text2(stack);
                else if (token.value == "text3") error = pxt_proc_text3(stack);
                else if (token.value == "text4") error = pxt_proc_text4(stack);
                else if (token.value == "frame") error = pxt_proc_frame(stack);
                else if (token.value == "binding") error = pxt_proc_binding(stack);
                else if (token.value == "begin") error = pxt_proc_begin(stack);
                else if (token.value == "end") error = pxt_proc_end(stack);
                else if (token.value == "align-group") error = pxt_proc_align_group(stack);
                else if (token.value == "slide-bg") {
                    let slide_bg = stack.pop();
                    if (typeof slide_bg != "string") error = "slide-bg requires (slide_bg: string)";
                    else pxt_proc_slide(stack,slides,slide_bg);
                } else if (token.value == "slide") pxt_proc_slide(stack,slides,"");
                else error = `unexpected token: ${token}`;
                if (error) {
                    alert("error occured");
                    console.error(error);
                    return;
                }
            }
            let item = stack.pop();
            while (item!==undefined) {
                console.log(item);
                if (item == null) {
                    console.error("found not closed begin proc");
                    alert("error occured");
                    return
                }
                if (item instanceof Widget && item.type == SLIDE) {
                    slides.unshift(item);
                }
                item = stack.pop();
            }
            console.log(slides);
        }
        {
            slides.forEach((s, i) => {
                // if (s.bg!="") {
                // 	presentation[i]+=`<style> .bg { background-image: url('${assets[s.bg]}'); </style>`;
                // }

                function DoSomething(target) {
                    let result = "";
                    let idx = -1;
                    function next() {
                        idx++;
                        return target[idx];
                    }
                    function cur() {
                        return target[idx];
                    }
                    while (next()) {
                        // let all_weight = cur().Parent.all_weight;
                        // let weight_cnt = cur().Parent.weight_cnt;
                        // let avg_weight = all_weight / weight_cnt;
                        let tag = "";
                        let single = false;
                        let style = [`order: ${idx}`];
                        let class_list = [];
                        let props = [];
                        let body = "";
                        if (cur().type == TEXT) {
                            if (cur().value == "") continue;
                            tag = "span";
                            // style.push(`flex-grow: 1`);
                            style.push(`font-size: ${cur().weight}vh`);
                            body = cur().value;
                        }
                        if (cur().type == FRAME || cur().type == GROUP || cur().type == BOX) {
                            tag = "div";
                            class_list.push(cur().type == GROUP ? "group" : "frame");
                            style.push(`flex-grow: ${cur().weight}`);
                            body = DoSomething(cur().body);
                        }
                        if (cur().type == SPACE) {
                            tag = "span";
                        }
                        if (cur().type == IMG) {
                            single = true;
                            tag = "img";
                            style.push(`flex-grow: ${cur().weight}`);
                            props.push(`data-src="${cur().value}"`);
                        }
                        if (cur().type == BINDING) {
                            tag = "span";
                            class_list.push("binding");
                            body = DoSomething(cur().body);
                        }
                        style=style.concat(cur().style);
                        class_list=class_list.concat(cur().class_list);
                        let inner = `style="${style.join(';')}" ${props.join(" ")} class=${class_list.join(" ")}`;
                        if (single)
                            result+=`<${tag} ${inner}>`;
                        else
                            result+=`<${tag} ${inner}>${body}</${tag}>`;
                    }
                    return result;
                }
                presentation += `<div id="${i}" style="${s.style.join(";")}" class="output body ${s.class_list.join(" ")}">`+DoSomething(s.body)+"</div>";
            });
        }

        real_output.innerHTML=presentation;
        document.querySelectorAll("img").forEach(el=>{
            el.src=assets[el.dataset.src];
        });
        dwBtn.onclick = () => downloadPtt(presentation);
    });
}

let file = null;
fileInput.addEventListener("change", () => {
    file = fileInput.files[0];
    if (!file) {
        alert("Couldn't Find File");
        return;
    }
    readSrc(file);
});
document.addEventListener("keydown", (event) => {
    if (event.key == "r") {
        readSrc(file);
    }
});
