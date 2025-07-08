/**
 * #lang:
 * The way you build up an svg element is to incremental
 * construct it (same with its children) and then "commit"
 * it to its parent element. So an svg with one line and a circle
 * will look something like this -
 *
 * {div.canvas} sel
 * svg 100 width 100 height
 *      line 10 x1 10 y1 90 x2 90 y2 {red} stroke .
 *      circle 50 cx 50 cy 20 r {black} stroke .
 * .
 *
 * .... where the "." word commits each element to its parent.
 * The vocabulary available for each element is different depending
 * on which element is being constructed. While being constructed,
 * the element becomes the "current selection" and therefore influences
 * the vocabulary available. A (hopefully) useful subset of the svg language
 * is made available in this manner. There are also words that are common
 * to multiple svg elements as per the spec.
 *
 * A rule of thumb is that the code between an svg element's start and its
 * commit point does not change the current selection just before the final
 * commit point. Otherwise, it is free to do whatever is needed as per the
 * normal language.
 *
 * Elements like <g>, <defs> and <symbol> permit other elements to be contained in
 * them and elements like <g> can have an "id" attribute.
 *
 * Transforms are treated specially. You have separate words for
 * ``translate``, ``rotate``, ``scale``, ``skewX``` and ``skewY``
 * which build up a transformation which gets committed at the final
 * commit point. For an already mounted element, the commit operation
 * does not change its parent. If the element is not mounted, it will
 * mount it under its parent.
 */
export function pslang(defns, api) {
    let {forth} = api;
    const ns =  "http://www.w3.org/2000/svg";
    defns.svg = function (sel, pstack, dstack, defns) {
        // Inserts a new svg tag into the currently selected element.
        // svg 100 width 100 height
        //      line 10 x1 10 y1 20 x2 20 y2 .
        // .
        if (sel.length === 0) {
            throw new Error("svg: Current selection must be a HTML element into which the svg element is being inserted.");
        }
        let svg = document.createElementNS(ns, "svg");
        svg.svgParent = sel[0];
        svg.defns = svgdefns;
        return forth([svg], pstack, dstack, defns);
    };

    const svgdefns = {};

    function vecSetterForAttr(attr) {
        return function (sel, stack, dstack, defns) {
            let el = sel[0];
            let rect = dstack.car;
            el.setAttribute(attr, rect.map((x) => x.toString()).join(" "));
            return forth(sel, pstack, dstack.cdr, defns);
        };
    }

    const viewBox = vecSetterForAttr("viewBox");

    svgdefns.viewBox = viewBox;

    function setterForAttr(attr) {
        if (attr[0] === "*") {
            return vecSetterForAttr(attr.substring(1));
        } else {
            return function (sel, pstack, dstack, defns) {
                let el = sel[0];
                el.setAttribute(attr, dstack.car);
                return forth(sel, pstack, dstack.cdr, defns);
            };
        }
    }
    
    svgdefns.width = setterForAttr("width");
    svgdefns.height = setterForAttr("height");

    function commitElement(sel, pstack, dstack, defns) {
        let parents = [];
        for (let el of sel) {
            if (!el.parentElement) {
                let parent = el.svgParent || document.body;
                parent.appendChild(el);
            }
            if (el.transforms) {
                el.setAttribute("transform", el.transforms.map((t) => t.op + "(" + t.val + ")").join(" "));
            }
            parents.push(el.svgParent);
        }
        return forth(parents, pstack, dstack, defns);
    }

    const commondefns = {};
    commondefns['.'] = commitElement;
    const attrSet = `id fill stroke fill-opacity stroke-opacity
                      stroke-width stroke-linecap stroke-linejoin
                      stroke-dasharray paint-order transform-origin`.split(/\s+/);
    for (let attr of attrSet) {
        commondefns[attr] = setterForAttr(attr);
    }


    function transformOp(name) {
        return function (sel, pstack, dstack, defns) {
            let el = sel[0];
            if (!el.transforms) {
                el.transforms = [];
            }
            el.transforms.push({op: name, val: dstack.car});
            return forth(sel, pstack, dstack.cdr, defns);
        };
    }
    for (let op of "translate scale rorate skewX skewY matrix".split(" ")) {
        commondefns[op] = transformOp(op);
    }

    function svgelem(name, attrs, base) {
        let eldefns = Object.create(base);
        return function (sel, pstack, dstack, defns) {
            let pel = sel[0];
            let el = document.createElementNS(ns, name);
            el.svgParent = pel;
            el.defns = eldefns;
            for (let attr of attrs) {
                el.defns[attr] = setterForAttr(attr);
            }
            return forth([el], pstack, dstack, defns);
        };
    }

    // Example:
    // 100 100 svg rect 20 x 30 y 40 width 50 height {red} fill .
    const gdefns = Object.create(commondefns);
    const animatable = Object.create(commondefns);
    animatable.animate = svgelem("animate", ["attributeName", "from", "to", "dur", "repeatCount"], {});

    svgdefns.g = svgelem("g", [], gdefns);
    svgdefns.clipPath = svgelem("clipPath", [], svgdefns);
    svgdefns.defs = svgelem("defs", [], svgdefns);
    svgdefns.symbol = svgelem("symbol", ["id", "x", "y", "width", "height", "viewBox", "refX", "refY", "preserveAspectRatio"], svgdefns);
    svgdefns.rect = svgelem("rect", ["x", "y", "width", "height"], animatable);
    svgdefns.circle = svgelem("circle", ["cx", "cy", "r"], animatable);
    svgdefns.ellipse = svgelem("ellipse", ["cx", "cy", "rx", "ry", "pathLength"], animatable);
    svgdefns.path = svgelem("path", ["d", "pathLength"], animatable);
    svgdefns.polygon = svgelem("polygon", ["points", "pathLength"], animatable);
    svgdefns.polyline = svgelem("polyline", ["points", "pathLength"], animatable);
    svgdefns.text = svgelem("text", ["x", "y", "dx", "dy", "rotate", "textAdjust", "textLength"], animatable);
    svgdefns.textPath = svgelem("textPath", ["href", "lengthAdjust", "method", "path", "side", "spacing", "startOffset", "textLength"], animatable);
    svgdefns.tspan = svgelem("tspan", ["x", "y", "dx", "dy", "rotate", "textAdjust", "textLength"], animatable);
    svgdefns.image = svgelem("image", [
        "x", "y", "width", "height",
        "href", "preserveAspectRatio",
        "crossorigin", "decoding",
        "fetchpriority"
    ], animatable);
    svgdefns.line = svgelem("line", ["x1", "y1", "x2", "y2", "pathLength"], animatable);
    svgdefns.use = svgelem("use", ["href", "x", "y", "width", "height"], animatable);

    svgdefns['id'] = commondefns['id'];
    svgdefns['.'] = commitElement;
    Object.assign(gdefns, svgdefns);
    return defns;
}
