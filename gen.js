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
    let newW = stack.pop();
    if (!(newW instanceof Widget) || typeof align_number != "number" || typeof align_type != "number") return "align requires (widget: Widget, align_number: number, align_type: number)"
    switch (align_number) {
    case 0: newW.align1=ALIGN_TYPES[align_type]; break;
    case 1: newW.align2=ALIGN_TYPES[align_type]; break;
    }
    stack.push(newW);
}

function pxt_proc_text(stack)
{
    let usage = "text requires (weight:number, opt: {color: number, bold, italic, underlined, strikethrough: bool}, content: string)";
    let content = stack.pop();
    let opt = stack.pop();
    let weight = stack.pop();
    if (typeof weight != "number" || typeof content != "string" || !isObject(opt)) return usage+` but (${weight}, ${opt}, ${content})`;

    let color = opt.color ?? 0;
    let bold = opt.bold ?? false;
    let italic = opt.italic ?? false;
    let underlined = opt.underlined ?? false;
    let strikethrough = opt.strikethrough ?? false;
    if (typeof color != "number" ||
       typeof bold != "boolean" || typeof italic != "boolean" ||
       typeof underlined != "boolean" || typeof strikethrough != "boolean") return usage+` but (${weight}, ${opt}, ${content})`;

    let newW = new Widget(TEXT,weight,content);
    newW.color = color;
    newW.is_bold = opt.bold ?? false;
    newW.is_italic = opt.italic ?? false;
    newW.is_underlined = opt.underlined ?? false;
    newW.is_strikethrough = opt.strikethrough ?? false;
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
    if (typeof color != "number" || typeof content != "string" || typeof weight != "number") return "text3 requires (weight: number, color: number, content: string)";
    let newW = new Widget(TEXT,weight,content);
    newW.color = color;
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
    if (typeof color != "number" || typeof content != "string" || !isObject(style) || typeof weight != "number")
        return "text4 requires (weight: number, style: object, color: number, content: string)";
    let newW = new Widget(TEXT,weight,content);
    newW.color = color;
    newW.is_bold = style.bold ?? false;
    newW.is_italic = style.italic ?? false;
    newW.is_underlined = style.underlined ?? false;
    newW.is_strikethrough = style.strikethrough ?? false;
    stack.push(newW)
}

function pxt_proc_space(stack)
{
    let weight = stack.pop();
    if (typeof weight != "number") return "space requires (weight: number)";
    stack.push(new Widget(SPACE, 0, weight + "rem"));
}

function pxt_proc_img(stack)
{
    let img_path = stack.pop();
    let weight = stack.pop();
    if (typeof weight != "number" || typeof img_path != "string") return "img requires (widget: Widget, img_path: string)";
    stack.push(new Widget(IMG, weight, img_path));
}

function pxt_proc_bg(stack)
{
    let img_path = stack.pop();
    let widget = stack.pop();
    console.log(widget);
    if (!(widget instanceof Widget) || typeof img_path != "string") return "bg requires (widget: Widget, img_path: string)";
    widget.bg=img_path;
    stack.push(widget);
}

function pxt_proc_binding(stack)
{
    let weight = stack.pop();
    if (typeof weight != "number") return "binding requires (weight: number)";
    let newGroup = new Widget(BINDING,weight,"");
    stack.push(newGroup);
}

function pxt_proc_group(stack)
{
    let vertical = stack.pop();
    let weight = stack.pop();
    if (typeof weight != "number" || (typeof vertical != "boolean" && typeof vertical != "number")) return "group requires (weight: number, vertical: bool)";
    let newGroup = new Widget(GROUP,weight,vertical ? "|" : "");
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
            newSlide.Push(item,back=true);
        }
    }
    slides.push(newSlide);
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

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) {
        output.textContent = "Can't Find File";
        return;
    }

    slides = []; // 이미 어딘가에서 선언됨.

    const reader = new FileReader();

    error = undefined;
    reader.onload = (event) => {
        let t = event.target.result;
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
        let presentation = [];
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
                else if (token.value == "img") error = pxt_proc_img(stack);
                else if (token.value == "bg") error = pxt_proc_bg(stack);
                else if (token.value == "space") error = pxt_proc_space(stack);
                else if (token.value == "text") error = pxt_proc_text(stack);
                else if (token.value == "text2") error = pxt_proc_text2(stack);
                else if (token.value == "text3") error = pxt_proc_text3(stack);
                else if (token.value == "text4") error = pxt_proc_text4(stack);
                else if (token.value == "group") error = pxt_proc_group(stack);
                else if (token.value == "binding") error = pxt_proc_binding(stack);
                else if (token.value == "begin") error = pxt_proc_begin(stack);
                else if (token.value == "end") error = pxt_proc_end(stack);
                else if (token.value == "align-group") error = pxt_proc_align_group(stack);
                else if (token.value == "slide-bg") {
                    let slide_bg = stack.pop();
                    if (typeof slide_bg != "string") error = "slide-bg requires (slide_bg: string)";
                    else pxt_proc_slide(stack,slides,slide_bg);
                }
                else if (token.value == "slide") pxt_proc_slide(stack,slides,"");
                else error = `unexpected token: ${token}`;
                if (error) {
                    console.error(error);
                    return;
                }
            }
            console.log(slides);
        }
        {
            slides.forEach((s, i) => {
                presentation[i] = "";
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
                        let all_weight = cur().Parent.all_weight;
                        let weight_cnt = cur().Parent.weight_cnt;
                        let avg_weight = all_weight / weight_cnt;
                        if (cur().type == TEXT) {
                            if (cur().value == "") continue;
                            let tag = "span";
                            let txt_color = "#"+cur().color.toString(16).padStart(6,"0");
                            let txt_bold = cur().is_bold ? "bold" : "normal";
                            let txt_italic = cur().is_italic ? "font-style: italic" : "";
                            let txt_deco = (cur().is_underlined ? "underline " : "")+(cur().is_strikethrough ? "line-through" : "");
                            if (txt_deco) {
                                txt_deco = "text-decoration-line:"+txt_deco+";";
                            }
                            result += `<${tag} style="color: ${txt_color}; font-weight: ${txt_bold}; order: ${idx}`;
                            result += `${txt_italic}; ${txt_deco}`;
                            result += `font-size: ${cur().weight}rem;">${cur().value}</${tag}>`;
                        }
                        if (cur().type == GROUP || cur().type == BOX) {
                            let tag = "div";
                            let flex_dir = cur().value == "|" ? "column" : "row";
                            let style = "";
                            if (cur().align1) {
                                style += "align-items: " + cur().align1 + ";";
                            }
                            if (cur().align2) {
                                style += "justify-content: " + cur().align2 + ";";
                            }
                            result += `<${tag} class="group ${
                cur().type == BOX ? "box" : ""
              } ${
                cur().bg ? "img-" + cur().bg : ""
              }" style="${style}flex-direction: ${flex_dir}; order: ${idx}; flex-grow: ${
                cur().weight
              };">${DoSomething(cur().body)}</${tag}>`;
                        }
                        if (cur().type == SPACE) {
                            let tag = "span";
                            result += `<${tag} style="margin: ${cur().value};"></${tag}>`;
                        }
                        if (cur().type == IMG) result += `<img style="flex-grow: ${cur().weight}" data-src="${cur().value}"/>`;
                        if (cur().type == BINDING) {
                            let tag = "span";
                            result += `<${tag} class="binding">${DoSomething(cur().body)}</${tag}>`;
                        }
                    }
                    return result;
                }
                presentation[i] += DoSomething(s.body);
            });
        }

        real_output.innerHTML="";
        presentation.forEach((ppp,i) => {
            let new_ppp = document.createElement("div");
            new_ppp.classList.add("output");
            if (slides[i].value)
                new_ppp.classList.add("img-" + slides[i].value);
            new_ppp.innerHTML = ppp;
            real_output.appendChild(new_ppp);
            document.querySelectorAll("img").forEach(el=>{
                el.src=assets[el.dataset.src];
            });
        });
        dwBtn.onclick = () => downloadPtt(presentation);
    };

    reader.onerror = () => {
        output.textContent = "error";
    };

    // M�� �<\ }0
    reader.readAsText(file, "UTF-8");
});
