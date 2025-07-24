//import { weblang } from "./weblang.js";
//import { svglang } from "./svglang.js";
//import { genailang } from "./genailang.js";

export function cons(car,cdr) {
    return {car,cdr};
}
export function empty() {
    return null;
}
export function isEmpty(ls) {
    return ls === null;
}
export function list(...args) {
    return append(args, empty());
}
export function append(arr, ls) {
    for (let i = arr.length-1; i >= 0; --i) {
        ls = cons(arr[i], ls);
    }
    return ls;
}

function word(w) {
    return {t: 'word', value: w, s: w};
}
function number(s) {
    return {t: 'number', value: +s, s: s};
}
function whitespace(s) {
    return {t: 'ws', value: s, s: s};
}
function group(g) {
    return {t: g, value: [], s: g};
}
function tagopen(w) {
    let s = w.substring(1,w.length-1);
    return {t: '<>', value: s, s: s};
}
function tagclose(w) {
    let s = w.substring(2,w.length-1);
    return {t: '</>', value: s, s: s};
}
function tagselfclosed(w) {
    let s = w.substring(1,w.length-2);
    return {t: '<./>', value: s, s: s};
}


export function psTokens(ps) {
    const tagWords = /^(<([-a-zA-Z]+)>|<[/]([-a-zA-Z]+)>|<([-a-zA-Z]+)[/]>)$/;
    ps = ps.trim();
    let re = /([-+]?[0-9]+([.][0-9]+)?)|([^\s()\[\]{},;]+)|([(][:])|([(])|([)])|([\[])|([\]])|([{])|([}])|([,])|([;])|(\s+)/gu;
    let words = [...ps.matchAll(re)]
    let mwords = [];
    for (let i = 0; i < words.length; ++i) {
        let w = words[i];
        if (w[3]) {
            let word = w[3];
            if (word.length > 1 && word[word.length-1] === '.') {
                // #lang: Words don't end with a period character, but can contain
                // a period in the middle. If they do end with a period, then
                // the period is separated out as a word.
                mwords.push({t: 'w', s: word.substring(0, word.length-1)});
                mwords.push({t: 'w', s: '.'});
            } else {
                mwords.push({t: 'w', s: word});
            }
        } else if (w[1]) {
            mwords.push({t: 'n', s: w[1]});
        } else if (w[4]) {
            mwords.push({t: '(:', s: w[4]});
        } else if (w[5]) {
            mwords.push({t: '(', s: w[5]});
        } else if (w[6]) {
            mwords.push({t: ')', s: w[6]});
        } else if (w[7]) {
            mwords.push({t: '[', s: w[7]});
        } else if (w[8]) {
            mwords.push({t: ']', s: w[8]});
        } else if (w[9]) {
            mwords.push({t: '{', s: w[9]});
        } else if (w[10]) {
            mwords.push({t: '}', s: w[10]});
        } else if (w[11]) {
            mwords.push({t: 'w', s: w[11]}); // ,
        } else if (w[12]) {
            mwords.push({t: 'w', s: w[12]}); // ;
        } else if (w[13]) {
            mwords.push({t: ' ', s: w[13]});
        } else {
            mwords.push({t: '?', s: w[0]});
        }

        // If a word matches a tag start or tag end pattern,
        // mark it with the appropriate token type other than
        // word, because the parser deals with it differently.
        let wordToCheckForTag = mwords[mwords.length-1];
        if (wordToCheckForTag.t === 'w') {
            if (wordToCheckForTag.s === '.') {
                wordToCheckForTag = mwords[mwords.length-2];
                if (wordToCheckForTag.t !== 'w') {
                    wordToCheckForTag = null;
                }
            }
            if (wordToCheckForTag) {
                let m = wordToCheckForTag.s.match(tagWords);
                if (m) {
                    if (m[2]) {
                        wordToCheckForTag.t = '<>';
                        wordToCheckForTag.tag = m[2];
                    } else if (m[3]) {
                        wordToCheckForTag.t = '</>';
                        wordToCheckForTag.tag = m[3];
                    } else if (m[4]) {
                        wordToCheckForTag.t = '<./>';
                        wordToCheckForTag.tag = m[4];
                    } else {
                        throw new Error("Impossible condition");
                    }
                }
            }
        }
    }
    return mwords;
}

function bracket(b) {
    switch (b) {
        case '(:': return ')';
        case '(': return ')';
        case ')': return '(';
        case '[': return ']';
        case ']': return '[';
        case '{': return '}';
        case '}': return '{';
        default:
            throw new Error("Not a supported bracket");
    }
}

export function psParse(tokens) {
    let nodes = [];
    let state = false;
    let acc= [];
    let nesting = [];
    for (let i = 0; i < tokens.length; ++i) {
        let t = tokens[i];
        if (t.t === '?') {
            throw new Error("Unknown term " + t.s);
        }
        if (t.t === '(' || t.t === '(:' || t.t === '[' || t.t === '{') {
            state = t.t;
            nesting.push(group(t.t));
            if (nesting.length === 1 && nesting[0].s === '{') {
                nesting[0].s = '';
            }
            continue;
        }
        switch (state) {
            case false:
                if (t.t === 'w') {
                    nodes.push(word(t.s));
                    continue;
                }
                if (t.t === '<>') {
                    nodes.push(tagopen(t.s));
                    continue;
                }
                if (t.t === '</>') {
                    nodes.push(tagclose(t.s));
                    continue;
                }
                if (t.t === '<./>') {
                    nodes.push(tagselfclosed(t.s));
                    continue;
                }
                if (t.t === 'n') {
                    nodes.push(number(t.s));
                    continue;
                }
                if (t.t === ' ') {
                    continue;
                }
                continue;
            case '(':
            case '(:':
            case '[':
            case '{':
                if (t.t === ')' || t.t === ']' || t.t === '}') {
                    if (nesting.length > 0 && nesting[nesting.length-1].t[0] == bracket(t.t)) {
                        let n = nesting[nesting.length-1];
                        nesting.pop();
                        if (nesting.length > 0) {
                            nesting[nesting.length-1].value.push(n);
                            nesting[nesting.length-1].s += n.s + t.s;
                        } else {
                            nodes.push(n);
                        }
                        if (nesting.length === 0) {
                            state = false;
                        } else {
                            state = nesting[nesting.length-1].t;
                        }
                    } else {
                        throw new Error("Mismatched brackets " + t.t);
                    }
                    continue;
                }
                if (nesting.length === 0) {
                    throw new Error("Weird state");
                }
                if (t.t === 'w') {
                    nesting[nesting.length-1].value.push(word(t.s));
                    nesting[nesting.length-1].s += t.s;
                    continue;
                }
                if (t.t === 'n') {
                    nesting[nesting.length-1].value.push(number(t.s));
                    nesting[nesting.length-1].s += t.s;
                    continue;
                }
                if (t.t === ' ') {
                    if (state === '{') {
                        nesting[nesting.length-1].value.push(whitespace(t.s));
                    }
                    nesting[nesting.length-1].s += t.s;
                    continue;
                }
                continue;
            default:
                throw new Error("Invalid fall through");
        }
    }

    if (nesting.length > 0) {
        throw new Error("Brackets not matched");
    }
    return nodes;
}

function program(p, i=0, i_end=-1) {
    return {program: p, i: i, i_end: (i_end < 0 ? p.length : i_end)};
}

export function psProg(script, pstack=empty()) {
    return cons(program(psParse(psTokens(script))), pstack);
}

export async function forth(sel, pstack, dstack, defns) {
    if (isEmpty(pstack)) {
        return dstack;
    }

    let pc = pstack.car;
    if (typeof(pc) === 'function') {
        return pc(sel, pstack.cdr, dstack, defns);
    }

    if (pc.i >= pc.i_end) {
        return forth(sel, pstack.cdr, dstack, defns);
    }

    let instr = pc.program[pc.i];
    pstack = cons(program(pc.program, pc.i+1, pc.i_end), pstack.cdr);
    switch (instr.t) {
        case 'word':
            // #lang:
            // :word defines the word to mean the next block on the stack.
            // It defines the word for the current element as well as globally
            // as a fallback.
            // :.word will define it for the current element only.
            // If a string is on the stack above the block, that'll be used to
            // as a selector to query the DOM and define methods on the found
            // elements. For :word, that query will be at root level and for :.word,
            // it'll be from the element's children.
            if (instr.value[0] === ':') {
                // define new word
                let word = instr.value.substring(1);
                let code = dstack.car;
                dstack = dstack.cdr;
                let sel2 = (sel.length === 0) ? [{defns}] : sel;
                if (code.t === '{') {
                    if (word[0] === '.') {
                        let sel3 = [];
                        for (let el of sel) {
                            let qs = el.querySelectorAll(code.s);
                            for (let q of qs) {
                                sel3.push(q);
                            }
                        }
                        word = word.substring(1);
                        sel2 = sel3;
                    } else {
                        sel2 = [...document.querySelectorAll(code.s)];
                    }
                    code = dstack.car;
                    dstack = dstack.cdr;
                }
                if (code.t[0] !== '(') {
                    throw new Error("Expected block on stack");
                }
                if (sel2.length === 0) {
                    throw new Error("Selection of length zero for method definition.");
                }
                let block = code.value;
                let fn = async function (sel, pstack, dstack, defns) {
                    return forth(sel, cons(program(block),pstack), dstack, defns);
                };
                let count = 0;
                for (let obj of sel2) {
                    if (obj.defns) {
                        obj.defns[word] = fn;
                        count++;
                    }
                }
                if (count === 0) {
                    defns[word] = fn;
                }
                return forth(sel, pstack, dstack, defns);
            } else if (instr.value[0] === '@') {
                // #lang:
                // @attr gets attribute of first of current selection.
                // @=attr sets attributes `attr` of current selection to stack top.
                if (instr.value[1] === '=') {
                    let attrName = inst.value.substring(2);
                    for (let el of sel) {
                        sel.setAttribute(attrName, dstack.car)
                    }
                    return forth(sel, pstack, dstack.cdr, defns);
                } else {
                    let attrName = instr.value.substring(1);
                    if (sel.length > 0) {
                        return forth(sel, pstack, cons(sel[0].getAttribute(attrName), dstack), defns);
                    } else {
                        throw new Error("No element to get attribute of");
                    }
                }
            } else if (instr.value[0] === '.' && instr.value.length > 1) {
                // #lang:
                // .varname will get field if present before considering it as a word.
                // .=varname will set field of selection.
                if (instr.value[1] === '=' && instr.value.length > 2) {
                    let field = instr.value.substring(2);
                    for (let el of sel) {
                        if (!el.fields) {
                            el.fields = {};
                        }
                        el.fields[field] = dstack.car;
                    }
                    return forth(sel, pstack, dstack.cdr, defns);
                } else {
                    let field = instr.value.substring(1);
                    for (let el of sel) {
                        if (el.fields && field in el.fields) {
                            return forth(sel, pstack, cons(el.fields[field], dstack), defns);
                        }
                    }
                    return forth(sel, pstack, dstack, defns);
                }
            } else if (instr.value.substring(0,3) === "~on") {
                // #lang:
                // ( ... ) ~on<event> will set the block as the handler for the given event,
                // and give the event object on top of the stack when invoking it.
                // ( ... ) {selector} ~on<event> will set the event handler on the given selection
                // of elements.
                let eventName = instr.value.substring(3);
                let code = dstack.car;
                dstack = dstack.cdr;
                if (code.t === '{') {
                    sel = [...document.querySelectorAll(code.s)];
                    code = dstack.car;
                    dstack = dstack.cdr;
                }
                if (code.t !== '(:') {
                    throw new Error("Need code block for event handler");
                }
                let codeblock = code.value;
                for (let el of sel) {
                    if (!(el && el.addEventListener)) {
                        throw new Error("Not an element on which we can set an event handler");
                    }
                    el.addEventListener(eventName, async function handler(event) {
                        await forth([el], cons(program(codeblock),empty()), cons(event, dstack), defns);
                    });
                }
                return forth(sel, pstack, dstack, defns);
            } else {
                let w = instr.value;
                if (sel.length > 0) {
                    let dstack2 = dstack;
                    let count = 0;
                    for (let el of sel) {
                        if (el && el.defns && el.defns[w]) {
                            dstack2 = await el.defns[w]([el], pstack, dstack2, defns);
                            count++;
                        }
                    }
                    if (count > 0) {
                        return dstack2;
                    } else {
                        if (! defns[w]) {
                            throw new Error("Unknown word " + w);
                        }
                        return defns[w](sel, pstack, dstack, defns);
                    }
                } else {
                    return defns[w](sel, pstack, dstack, defns);
                }
            }
        case 'number':
            return forth(sel, pstack, cons(instr.value, dstack), defns);
        case '<>': {
            // Open tag. Create a new element and push it on to the stack.
            // Also make it the current selection while remembering the
            // previous selection.
            let el = document.createElement(instr.value);
            el.f_sel = sel;
            el.f_maybeparent = sel[0];
            el.f_isopen = true;
            return forth([el], pstack, cons(el, dstack), defns);
        }
        case '<./>': {
            // Self closed tag. Nothing to walk.
            let el = document.createElement(instr.value);
            el.f_sel = sel;
            el.f_maybeparent = sel[0];
            el.f_isopen = false;
            return forth(sel, pstack, cons(el, dstack), defns);
        }
        case '</>': {
            // Close tag. Walk the stack backwards until you encounter 
            // the corresponding open tag and add as children anything
            // you encounter on the way.
            while (!(dstack.car instanceof Element 
                     && dstack.car.tagName === sel[0].tagName
                     && dstack.car.f_isopen)) {
                if (dstack.car instanceof Element) {
                    if (dstack.car.f_isopen) {
                        throw new Error("Mismatched tag " + dstack.car.tagName);
                    }
                    sel[0].prepend(dstack.car);
                } else {
                    sel[0].prepend(dstack.car.toString());
                }
                dstack = dstack.cdr;
            }
            dstack.car.f_isopen = false;
            return forth(dstack.car.f_sel, pstack, dstack, defns);
        }
        case '[': {
            let n = dstack;
            pstack = cons(function (sel, pstack, dstack, defns) {
                let arr = [];
                let ds = dstack;
                while (ds != n) {
                    arr.unshift(ds.car);
                    ds = ds.cdr;
                }
                return forth(sel, pstack, cons(arr, n), defns);
            }, pstack);
            return forth(sel, cons(program(instr.value), pstack), dstack, defns);
        }
        case '{':
            // #lang:
            // Saves a string to the stack.
            return forth(sel, pstack, cons(instr.s, dstack), defns);
        case '(:':
            // #lang:
            // Saves a block of code on the stack.
            return forth(sel, pstack, cons(instr, dstack), defns);
        case '(':
            // #lang:
            // Runs the block of code.
            return forth(sel, cons(program(instr), pstack), dstack, defns);
    }
}

function stdlib(defns) {
    defns.dup = function (sel, pstack, dstack, defns) {
        return forth(sel, pstack, cons(dstack.car, dstack), defns);
    };
    defns.drop = function (sel, pstack, dstack, defns) {
        return forth(sel, pstack, dstack.cdr, defns);
    };
    defns.swap = function (sel, pstack, dstack, defns) {
        return forth(sel, pstack, cons(dstack.cdr.car, cons(dstack.car, dstack.cdr.cdr)), defns);
    };
    function rot(ds, n) {
        if (n < 0) { throw new Error("Rotation cannot be negative"); }
        if (n === 0) { return ds; }
        if (n === 1) { return cons(ds.cdr.car, cons(ds.car, ds.cdr.cdr)); }
        return rot(rot(ds.cdr, n-1), 1);
    }
    defns.rot = function (sel, pstack, ds, defns) {
        // #lang:
        // v1 v2 v3 rot -> v2 v3 v1
        return forth(sel, pstack, rot(ds, 2), defns);
    };
    defns.rotn = function (sel, ps, ds, defns) {
        let n = ds.car;
        return forth(sel, ps, rot(ds.cdr, n), defns);
    };
    defns['+'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.car + ds.cdr.car, ds.cdr.cdr), defns);
    };
    defns['incr'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.car + 1, ds.cdr), defns);
    };
    defns['-'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car - ds.car, ds.cdr.cdr), defns);
    };
    defns['decr'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.car - 1, ds.cdr), defns);
    };
    defns['neg'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(-ds.car, ds.cdr), defns);
    };
    defns['*'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car * ds.car, ds.cdr.cdr), defns);
    };
    defns['/'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car / ds.car, ds.cdr.cdr), defns);
    };
    defns['pow'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(Math.pow(ds.cdr.car, ds.car), ds.cdr.cdr), defns);
    };
    function defUnaryMath(defns, Math) {
        function mkUnaryFn(fn) {
            return function (sel, pstack, ds, defns) {
                return forth(sel, pstack, cons(fn(ds.car), ds.cdr), defns);
            };
        }
        let fns = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'log', 'log10', 'log2',
            'floor', 'ceil', 'abs', 'round', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
            'sqrt', 'sign', 'trunc'];
        for (let fname of fns) {
            defns[fname] = mkUnaryFn(Math[fname]);
        }
    }
    defUnaryMath(defns, Math);
    defns['<'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car < ds.car, ds.cdr.cdr), defns);
    };
    defns['<='] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car <= ds.car, ds.cdr.cdr), defns);
    };
    defns['>'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car > ds.car, ds.cdr.cdr), defns);
    };
    defns['>='] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car >= ds.car, ds.cdr.cdr), defns);
    };
    defns['='] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.cdr.car === ds.car, ds.cdr.cdr), defns);
    };
    defns[','] = function (sel, pstack, ds, defns) {
        // #lang:
        // ',' is an "and-ing word" and exits the current block if
        // the value on the stack is false. Therefore it serves as
        // a short-circuiting conjunction.
        // Conjunctions are to be used within () blocks.
        // Exits the block with false if the stack top is false.
        if (ds.car) {
            return forth(sel, pstack, ds.cdr, defns);
        } else {
            return forth(sel, pstack.cdr, ds, defns);
        }
    };
    defns[';'] = function (sel, pstack, ds, defns) {
        // #lang:
        // ';' is an 'or-ing word' and exits the current block
        // if the value on the stack turns out to be true.
        // So it short circuits as well.
        // Disjunctions are to be used within () blocks.
        // Exits the block with true if the stack top is true.
        if (ds.car) {
            return forth(sel, pstack.cdr, ds, defns);
        } else {
            return forth(sel, pstack, ds.cdr, defns);
        }
    };
    defns['->'] = function (sel, ps, ds, defns) {
        // #lang:
        // ( <cond> -> <then> ; <else> )
        // should work like if-then-else. Kind of equivalent to
        // ( ( <cond> , <then>, <cond> ) ; <else> )
        if (ds.car) {
            for (let i = ps.car.i; i < ps.car.i_end; ++i) {
                let instr = ps.car.program[i];
                if (instr.t === 'word' && instr.value === ';') {
                    return forth(sel, cons(program(ps.car.program, ps.car.i, i), ps.cdr), ds.cdr, defns);
                }
            }
            return forth(sel, cons(program(ps.car.program, ps.car.i, ps.car.i_end), ps.cdr), ds.cdr, defns);
        } else {
            for (let i = ps.car.i; i < ps.car.i_end; ++i) {
                let instr = ps.car.program[i];
                if (instr.t === 'w' && instr.value === ';') {
                    return forth(sel, cons(program(ps.car.program, i+1, ps.car.i_end), ps.cdr), ds.cdr, defns);
                }
            }
            return forth(sel, ps.cdr, ds.cdr, defns);
        }
    };
    // Commits the element on the top of the stack as an appended child
    // of the current selection. If there is no current selection, uses the
    // document.body
    defns['.'] = function (sel, pstack, ds, defns) {
        let parent = document.body;
        if (sel && sel.length > 0) {
            parent = sel[0];
        }
        if (ds.car instanceof Element) {
            if (ds.car.f_isopen) {
                throw new Error(`Tried to commit element ${ds.car.tagName} in the middle of being defined.`);
            }
            parent.append(ds.car);
        } else {
            parent.append(ds.car.toString());
        }
        return forth(sel, pstack, ds.cdr, defns);
    };
    defns['not'] = function (sel, pstack, ds, defns) {
        return forth(sel, pstack, cons(ds.car ? false : true, ds.cdr), defns);
    };
    defns['#t'] = function (sel, ps, ds, defns) {
        return forth(sel, ps, cons(true, ds), defns);
    };
    defns['#f'] = function (sel, ps, ds, defns) {
        return forth(sel, ps, cons(false, ds), defns);
    };
    defns.its = function (sel, ps, ds, defns) {
        // #lang:
        // its
        // will get the first of current selection and place it on the stack.
        // Idea is to do `its {property} get`
        if (sel && sel.length > 0) {
            return forth(sel, ps, cons(sel[0], dstack), defns);
        } else {
            throw new Error("Empty current selection for 'its'");
        }
    };
    defns.object = function (sel, ps, ds, defns) {
        // #lang:
        // object
        // Places a new empty object on the stack.
        return forth(sel, ps, cons({}, ds), defns);
    };
    function getprop(obj, propname) {
        let val = obj;
        let parts = propname.split(".");
        for (let i = 0; i < parts.length; ++i) {
            if (!(parts[i] in val)) {
                throw new Error("Property not found");
            }
            val = val[parts[i]];
        }
        return val;
    }
    function setprop(obj, propname, val) {
        let target = obj;
        let parts = propname.split(".");
        for (let i = 1; i < parts.length; ++i) {
            if (!(parts[i-1] in target)) {
                throw new Error("Property not found");
            }
            target = target[parts[i-1]];
        }
        target[parts[parts.length-1]] = val;
    }
    defns.get = function (sel, ps, ds, defns) {
        // #lang:
        // obj propname get -> val obj
        // Leaves the obj on the stack with the property value immediately below the object.
        // Leaving the object on top lets you get multiple properties at one shot on
        // the stack before performing operations.
        let propname = ds.car;
        let obj = ds.cdr.car;
        let val = getprop(obj, propname);
        return forth(sel, ps, cons(obj, cons(val, ds.cdr.cdr)), defns);
    };
    defns.get1 = function (sel, ps, ds, defns) {
        // #lang:
        // obj propname get1 -> val
        // Gets one property and leaves it on the stack, dropping the
        // object and the property name.
        let propname = ds.car;
        let obj = ds.cdr.car;
        let val = getprop(obj, propname);
        return forth(sel, ps, cons(val, ds.cdr.cdr), defns);
    };
    defns.set = function (sel, ps, ds, defns) {
        // #lang:
        // obj val propname set -> obj
        // Short for (swap propname put)
        // This permits multiple consecutive set operations with
        // computed values.
        let propname = ds.car;
        let val = ds.cdr.car;
        let obj = ds.cdr.cdr.car;
        setprop(obj, propname, val);
        return forth(sel, ps, cons(obj, ds.cdr.cdr.cdr), defns);
    };
    defns.put = function (sel, ps, ds, defns) {
        // #lang:
        // val obj propname put -> obj
        // Sets the specified property of the object, consuming
        // the value but leaving the obj on top. This permits
        // multiple consecutive put operations that consume
        // the stack incrementally.
        let propname = ds.car;
        let obj = ds.cdr.car;
        let val = ds.cdr.cdr.car;
        setprop(obj, propname, val);
        return forth(sel, ps, cons(obj, ds.cdr.cdr.cdr), defns);
    };
    defns.s = function (sel, pstack, dstack, defns) {
        // #lang:
        // Concatenates array of strings on stack top into a single string
        // with an optional separator.
        // [1 2 3] s 
        //  => {123}
        // [1 2 3] {,} s
        //  => {1,2,3}
        let ls = dstack.car;
        let sep = '';
        if (typeof(ls) === 'string') {
            sep = dstack.car;
            ls = dstack.cdr.car;
            dstack = dstack.cdr.cdr;
        } else {
            dstack = dstack.cdr;
        }

        let lsstr = ls.map(item => item.toString());
        return forth(sel, pstack, cons(lsstr.join(sep), dstack), defns);
    };
    defns['&'] = function (sel, pstack, dstack, defns) {
        // #lang:
        // Executes the block on top of the stack as an async process.
        // Analogous to shell & operator.
        let code = dstack.car;
        if (code.t[0] !== '(') {
            throw new Error("Expecting code block to spawn task");
        }
        let block = code.value;
        // TODO: How to communicate with the async launched task? Perhaps via channels?
        // let chan = new MessageChannel();
        forth(sel, cons(program(block), empty()), dstack.cdr, defns);
        return forth(sel, pstack, dstack.cdr, defns);
    };
    defns['!'] = function (sel, pstack, dstack, defns) {
        // #lang:
        // Pops the code block off the stack and runs it.
        let code = dstack.car;
        if (typeof(code) === 'function') {
            return code(sel, pstack, dstack.cdr, defns);
        }
        if (code.t[0] !== '(') {
            throw new Error("Expecting code block to run");
        }
        let block = code.value;
        return forth(sel, cons(program(block), pstack), dstack.cdr, defns);
    };
    defns['repeat'] = function (sel, ps, ds, defns) {
        // #lang:
        // Do the current block again. So you have (.... repeat).
        // To exit the current block, you can use the conditional end `?end`.
        return forth(sel, cons(program(ps.car.program), ps.cdr), ds, defns);
    };
    defns['while'] = function (sel, ps, ds, defns) {
        // #lang:
        // Equivalent to (... not ?end repeat)
        if (ds.car === true) {
            return forth(sel, cons(program(ps.car.program), ps.cdr), ds.cdr, defns);
        } else {
            return forth(sel, ps, ds.cdr, defns);
        }
    };
    defns['times'] = function (sel, ps, ds, defns) {
        // #lang:
        // (: ... ) 5 times
        // will run the block 5 times, passing 1..5 on the stack each iteration.
        // If the index is not needed, the block must take care of dropping it.
        // Note that `end` within such a block will behave like "continue" in
        // imperative languages and not like "break".
        let n = ds.car, i = 0;
        let block = ds.cdr.car.value;
        ds = ds.cdr.cdr;
        function next(sel, _ps, ds, defns) {
            i += 1;
            if (i <= n) {
                return forth(sel, cons(program(block), cons(next, ps)), cons(i, ds), defns);
            } else {
                return forth(sel, ps, ds, defns);
            }
        }
        return next(sel, ps, ds, defns);

    };
    defns['end'] = function (sel, ps, ds, defns) {
        // #lang:
        // breaks out of the current block.
        return forth(sel, ps.cdr, ds, defns);
    };
    defns['?end'] = function (sel, ps, ds, defns) {
        // #lang:
        // breaks out of the current block depending on whether the 
        // top of the stack contains boolean true.
        return forth(sel, ds.car === true ? ps.cdr : ps, ds.cdr, defns);
    };
    defns.log = function (sel, pstack, dstack, defns) {
        console.log(dstack.car);
        // log doesn't consume the stack element since it is
        // expected to be used for diagnostic/debugging purposes.
        return forth(sel, pstack, dstack, defns);
    };
    return defns;
}

const kLangNames = ["weblang", "svglang", "genailang"];
const langMods = {};
async function load_vocabs(langNames = kLangNames, refresh = false) {
    let defns = stdlib({});
    let api = {forth, cons, empty, psProg};
    for (let modName of langNames) {
        if (!refresh && langMods[modName]) {
            langMods[modName](defns, api);
        } else {
            let mod = (await import("./" + modName + ".js")).pslang;
            langMods[modName] = mod;
            mod(defns, api);
        }
    }
    return defns;
}

export async function install(document, langNames = kLangNames, refresh = false) {
    let defns = await load_vocabs(langNames, refresh);
    let scripts = document.querySelectorAll('script[type="text/f"]');
    for (let script of scripts) {
        let prog = psParse(psTokens(script.innerText));
        await forth([], cons(program(prog), empty()), empty(), defns);
    }

    // #lang:
    // The attribute "f" specifies the script to run on the element.
    let sel = document.querySelectorAll('[f]');
    for (let el of sel) {
        let prog = psParse(psTokens(el.getAttribute("f")));
        await forth([el], cons(program(prog), empty()), empty(), defns);
    }

    // #lang:
    // If the attribute "f&" is used instead, then the script
    // will be run asynchronously.
    let sel = document.querySelectorAll('[f\\&]');
    for (let el of sel) {
        let prog = psParse(psTokens(el.getAttribute("f&")));
        forth([el], cons(program(prog), empty()), empty(), defns);
    }
}

export async function frun(programText, sel = null, langNames = kLangNames, refresh = false) {
    let defns = await load_vocabs(langNames, refresh);
    return forth(sel ? [...document.querySelectorAll(sel)] : [], psProg(programText), empty(), defns);
}

const isBrowser = (function () { return typeof(window) !== 'undefined'; })();

if (isBrowser) {
    let myScript = document.querySelector('[src$="pjs.js"]');
    window.addEventListener("load", function (event) {
        let langs = ["weblang"];
        if (myScript.hasAttribute("lang")) {
            langs = langs.concat(myScript.getAttribute("lang").trim().split(/\s+/));
            langs = [...(new Set(langs))];
        }
        console.log(langs);
        install(document, langs);
    });
}
