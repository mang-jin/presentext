const TEXT = 0;
const GROUP = 1;
const SLIDE = 2;
const BOX = 3;
const IMG = 4;
const SPACE = 5;
const BINDING = 6;

class Widget {
    constructor(type, weight, value) {
        this.type = type;
        this.weight = weight;
        this.all_weight = 0;
        this.weight_cnt = 0;
        this.value = value;
        this.Parent = null;
        this.align1 = "";
        this.align2 = "";
        this.bg = "";
        this.body = [];
        this.color = 0;
        this.is_bold = false;
        this.is_italic = false;
        this.is_underlined = false;
        this.is_strikethrough = false;
    }
    Push(value, back=false) {
        if (value.weight != 0) {
            this.all_weight += value.weight;
            this.weight_cnt += 1;
        }
        value.Parent = this;
        if (back) {
            this.body.unshift(value);
            return 0;
        } else {
            this.body.push(value);
            return this.Len() - 1;
        }
    }
    Get(idx) {
        return this.body[idx];
    }
    Len() {
        return this.body.length;
    }
}

let slides = [];

function SetSlide(line) {
    curSlide = slides.push(new Widget(-1, SLIDE, ""));
    return slides[curSlide];
}

let NewTextCondition = /^([0-9]+(?:\.[0-9]+)?)(b)?\"(.*)\"/;
function NewText(line) {
    let match = line.match(NewTextCondition);
    let weight = parseFloat(match[1]);
    let is_bold = match[2] == "b" ? true : false;
    let value = match[3];
    if (weight <= 0) {
        alert("Widget weight should be over 0");
    }
    let newW = new Widget(TEXT, weight, value);
    newW.is_bold = is_bold;
    return newW;
}

let NewGroupCondition = /^([0-9]+(?:\.[0-9]+)?)(_|\|)(<|-|>)?(<|-|>)?\(/;
let NewBoxCondition = /^([0-9]+(?:\.[0-9]+)?)(_|\|)(<|-|>)?(<|-|>)?\[/;
let NewBindingCondition = /^([0-9]+(?:\.[0-9]+)?)\{/;
let NewImgCondition = /^img\"(.*)\"/;
function NewImg(line) {
    let match = line.match(NewImgCondition);
    let img_path = match[1];
    return new Widget(IMG, 0, img_path);
}

let NewSpaceCondition = /^space\s(-?[0-9]+(?:\.[0-9]+)?)/;
function NewSpace(line) {
    let match = line.match(NewSpaceCondition);
    let space = match[1];
    return new Widget(SPACE, 0, space + "rem");
}

function fileNameToClassName(name) {
    return name;
}

function makePtt(sss) {
    let asset_preloads = `
        let assets = {};
		function base64ToBlob(dataUrl) {
			const [header, base64] = dataUrl.split(',');
			const mime = header.match(/:(.*?);/)[1];
			const binary = atob(base64);
			const len = binary.length;
			const bytes = new Uint8Array(len);
			for (let i = 0; i < len; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			return new Blob([bytes], { type: mime });
		}
	  `;
    Object.entries(assets).forEach(([filename, img_data]) => {
        let converted_img_data = img_data.replace(/\'/g, "\\'").split(",");
        let class_name = ".img-" + filename.replace(/\./g, "\\\\.");

        asset_preloads += `
	  {
	    let blob = base64ToBlob('${converted_img_data}');
		let url = URL.createObjectURL(blob);
        assets["${filename}"]=url;

		let preload = document.createElement("div");
		preload.style.display = "block";
		preload.style.position = "absolute";
		preload.style.background = \`url('\$\{url\}') no-repeat -9999px -9999px\`;
		preload.style.width = "1px";
		preload.style.height = "1px";
		awesome_style.textContent+=\`
			${class_name} {
				background-image: url('\$\{url\}');
				background-size: cover;
				background-position: center;
				background-repeat: no-repeat;
			}
		\`;
		document.body.appendChild(preload);
	  }
	  `;
    });
    return `
  <html>
  <head>
      <style id="awesome_style">
      span {
        text-align: center;
      }

      @font-face {
          font-family: "Paperlogy";
	  src: url('data:font/ttf;base64,${embedded_font}') format("truetype");
	  font-weight: normal;
      }

      @font-face {
      	  font-family: "Paperlogy";
	  src: url('data:font/ttf;base64,${embedded_font_bold}') format("truetype");
	  font-weight: bold;
      }

      html {
      	font-family: "Paperlogy";
      }

      html, body, .body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      }

      .body {
	      flex-direction: column;
        background: #f4f4f4;
        padding: 1rem;
        box-sizing: border-box;
      }

      .body, .group {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        flex-basis: 0;
        flex-shrink: 1;
      }

      .group {
          align-self: stretch;
          margin: 0.5rem;
          padding: 1rem;
      }

      .box {
          background: #f9f9f9;
          outline: 2px solid black;
      }

    </style>
  </head>
  <body></body>

<script type="text/javascript">
  ${asset_preloads}

  let backgrounds = ${JSON.stringify(slides.map((c)=>c.value))}
  let slides = [${sss
    .map((something) => "'" + something.replace(/\'/g, "\\'") + "'")
    .join(",")}];
  slides.forEach((sss,i)=>{
	  let new_slide = document.createElement("div");
	  new_slide.classList.add("body");
      if (backgrounds[i]) new_slide.classList.add("img-"+backgrounds[i]);
	  new_slide.id = i.toString();
	  new_slide.innerHTML=sss;
	  new_slide.style.display="none";
	  document.body.appendChild(new_slide);
  });
  document.querySelectorAll("img").forEach(el=>{
      el.src=assets[el.dataset.src];
  });
</script>

<script>
  let idx = -1;
  function next() {
    if (idx == slides.length - 1) return;
    idx++;
    Array.from(document.getElementsByClassName("body")).forEach(element=>{
    	element.style.display="none";
    });
    document.getElementById(idx.toString()).style.display="flex";
  }
  function prev() {
    if (idx < 1) return;
    idx--;
    Array.from(document.getElementsByClassName("body")).forEach(element=>{
    	element.style.display="none";
    });
    document.getElementById(idx.toString()).style.display="flex";
  }

  window.onload = () => next();

  document.addEventListener("click", () => {
    next();
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      next();
    }
    if (event.code === "ArrowRight") {
      next();
    }
    if (event.code === "ArrowLeft") {
      prev();
    }
  });
</script>
</html>
  `;
}

function downloadPtt(sss) {
    const blob = new Blob([makePtt(sss)], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "untitled.html";
    a.click();

    URL.revokeObjectURL(url);
}
